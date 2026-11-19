#!/usr/bin/env node
// Перевіряльник PR «Реалізація» — детермінована частина. Node 24, без залежностей.
// Головне правило: ПЕРЕВІРЯЄ СКРИПТ, а не модель. Агент лише запускає його й пояснює результат людині.
//
//   node scripts/pr-check.mjs check data/<набір>
//
// Вхід — знімок PR (лише дані, жодних інструкцій): data/<набір>/pr.json {number, title, branch, body},
// diff.patch (unified diff, як у `gh pr diff`), spec-ac.txt (AC ID з openspec/specs/ на базі PR, по одному в рядку).
// Вихід — таблиця для людини, маркер ###JSON### і JSON для агента.
// Код виходу: 0 — знахідок немає (OK), 1 — є знахідки (ПРОБЛЕМИ чи ЗАУВАЖЕННЯ), 2 — вхід не прочитано або це не PR
// «Реалізація» (НЕ ПЕРЕВІРЕНО). Правила й джерело кожного — references/rules.md.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [cmd, dirArg] = process.argv.slice(2);

function fail(message) {
  console.error(`НЕ ПЕРЕВІРЕНО: ${message}`);
  console.log(`НЕ ПЕРЕВІРЕНО: ${message}\nКОД ВИХОДУ: 2`);
  process.exit(2);
}

if (cmd !== "check" || !dirArg) fail("використання: node scripts/pr-check.mjs check data/<набір>");
const dir = path.resolve(ROOT, dirArg);
// Межа: лише теки всередині data/ цього проєкту.
if (!dir.startsWith(path.join(ROOT, "data") + path.sep)) fail(`тека має бути всередині data/: ${dirArg}`);

const read = (name) => {
  const file = path.join(dir, name);
  if (!existsSync(file)) fail(`немає файлу ${path.relative(ROOT, file)}`);
  return readFileSync(file, "utf8").replace(/^﻿/, "");
};

let pr;
try {
  pr = JSON.parse(read("pr.json"));
} catch (e) {
  fail(`pr.json — не JSON (${e.message})`);
}
for (const key of ["number", "title", "branch", "body"]) if (pr[key] === undefined) fail(`у pr.json немає поля ${key}`);
const specAc = new Set(read("spec-ac.txt").split(/\r?\n/).map((s) => s.trim()).filter(Boolean));
const files = parseDiff(read("diff.patch"));
if (files.length === 0) fail("diff.patch порожній або не unified diff");

// Тип PR — з позначки в описі (шаблон PR репо). Цей працівник перевіряє лише «Реалізацію».
const ticked = [...pr.body.matchAll(/^\s*- \[x\] \*\*(.+?)\*\*/gim)].map((m) => m[1].trim());
if (ticked.length === 1 && ticked[0] !== "Реалізація") fail(`це PR «${ticked[0]}», а не «Реалізація»`);

/** Unified diff → [{ path, from, status: A|M|D|R, binary, added: [], removed: [] }]. */
function parseDiff(text) {
  const out = [];
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (head) {
      cur = { path: head[2], from: head[1], status: "M", binary: false, added: [], removed: [], inHunk: false };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if (!cur.inHunk) {
      if (line.startsWith("new file mode")) cur.status = "A";
      else if (line.startsWith("deleted file mode")) cur.status = "D";
      else if (line.startsWith("rename from ")) cur.status = "R";
      else if (line.startsWith("Binary files")) cur.binary = true;
      else if (line.startsWith("@@")) cur.inHunk = true;
      continue;
    }
    // У ханку «---» чи «+++» — це вилучений чи доданий рядок (напр. SQL-коментар «-- …»), а не заголовок файлу.
    if (line.startsWith("diff --git")) continue;
    if (line.startsWith("@@")) continue;
    if (line.startsWith("+")) cur.added.push(line.slice(1));
    else if (line.startsWith("-")) cur.removed.push(line.slice(1));
  }
  return out.map(({ inHunk, ...f }) => f);
}

const findings = [];
const add = (id, level, message, evidence) => findings.push({ id, level, message, evidence });
const short = (s, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

// T — тип PR і гілка
if (ticked.length !== 1) add("T1", "error", `позначено типів PR: ${ticked.length}, має бути рівно один`, ticked.join(", ") || "—");
if (!/^(task|setup)\//.test(pr.branch)) add("T2", "error", "гілка PR «Реалізація» — task/<коротко> (у день 0 — setup/bootstrap)", pr.branch);

// P — межі шляхів
const FORBIDDEN = [/^requirements\//, /^openspec\/specs\//];
const ALLOWED = [
  /^src\//,
  /^supabase\//,
  /^tests\//,
  /^docs\/conformance\.md$/,
  /^docs\/decisions\//,
  /^docs\/bootstrap\.md$/,
  /^docs\/img\//,
  /^openspec\/changes\/impl-[^/]+\/tasks\.md$/,
  /^openspec\/changes\/archive\/[^/]*impl-[^/]+\//,
];
const COURSE = [/^docs\/qa\//, /^evals\/reports\//];
const forbidden = [];
const course = [];
const outside = [];
for (const f of files) {
  const paths = f.status === "R" ? [f.from, f.path] : [f.path];
  if (paths.some((p) => FORBIDDEN.some((r) => r.test(p)))) forbidden.push(f.path);
  else if (f.status === "D" && /^openspec\/changes\/impl-[^/]+\//.test(f.path)) continue; // archive переносить план
  else if (ALLOWED.some((r) => r.test(f.path))) continue;
  else if (COURSE.some((r) => r.test(f.path))) course.push(f.path);
  else outside.push(f.path);
}
if (forbidden.length) add("P1", "error", "PR «Реалізація» не змінює requirements/ і openspec/specs/", forbidden.join(", "));
if (course.length) {
  const dirs = [...new Set(course.map((p) => p.split("/").slice(0, 2).join("/")))];
  const explained = dirs.every((d) => pr.body.includes(d));
  add(
    "P2c",
    "warn",
    `артефакти курсу поза переліком шляхів «Реалізації»; пояснення в описі PR: ${explained ? "є" : "немає"}`,
    short(course.join(", "), 160),
  );
}
if (outside.length) add("P2", "warn", "шляхи поза переліком «Реалізації» — потрібне пояснення в описі PR", short(outside.join(", "), 160));
const conformance = files.find((f) => f.path === "docs/conformance.md");
if (conformance && [...conformance.added, ...conformance.removed].some((l) => /^Вимоги:/.test(l)))
  add("P3", "error", "рядок «Вимоги: …» шапки docs/conformance.md змінює лише /requirements-sync", "docs/conformance.md");

// M — міграції
for (const f of files.filter((f) => /^supabase\/migrations\//.test(f.path) || /^supabase\/migrations\//.test(f.from))) {
  if (f.status !== "A") {
    add("M1", "error", "застосовану міграцію змінено, видалено чи перейменовано — лише нова міграція", `${f.status} ${f.path}`);
    continue;
  }
  const sql = f.added.join("\n").toLowerCase();
  for (const m of sql.matchAll(/create table (?:if not exists )?(?:"?([a-z_]+)"?\.)?"?([a-z_][a-z0-9_]*)"?/g)) {
    const [, schema, table] = m;
    if (schema && schema !== "public") continue; // правило RLS — для таблиць у public
    const t = `(?:public\\.)?"?${table}"?`;
    if (!new RegExp(`alter table (?:only )?${t} enable row level security`).test(sql))
      add("M2", "error", "нова таблиця в public без enable row level security", `${f.path}: ${table}`);
    if (!new RegExp(`revoke all on (?:table )?${t} from anon, authenticated`).test(sql))
      add("M3", "error", "нова таблиця в public без revoke all … from anon, authenticated", `${f.path}: ${table}`);
  }
}

// A — тести з AC ID і C — рядки docs/conformance.md
const isTest = (p) => (/^(src|tests)\/.*\.test\.tsx?$/.test(p) && !p.startsWith("tests/e2e/")) || /^tests\/e2e\/.*\.spec\.ts$/.test(p);
const tests = files.filter((f) => f.status !== "D" && isTest(f.path));
const behaviour = files.filter(
  (f) => /^(src|supabase)\//.test(f.path) && !isTest(f.path) && f.path !== "src/lib/supabase/database.types.ts" && !f.binary,
);
if (behaviour.length && !tests.length)
  add("A1", "error", "змінено поведінку в src/ чи supabase/, а тести не додано й не змінено", short(behaviour.map((f) => f.path).join(", "), 160));
const titleRe = /\b(?:it|test)(?:\.each\(.*\))?\(\s*(["'`])(.+?)\1/g;
const acTitle = /^(AC-[A-Z]+-\d{2}):/;
const testedAc = new Set();
for (const f of tests) {
  const added = f.added.join("\n");
  for (const [, , title] of added.matchAll(titleRe)) {
    const m = title.match(acTitle);
    if (!m) add("A2", "warn", "назва тесту не починається з AC ID («AC-…-NN: …»)", `${f.path}: «${short(title, 70)}»`);
    else if (!specAc.has(m[1])) add("A3", "error", "AC ID у назві тесту немає в openspec/specs/ (ORPHAN)", `${f.path}: ${m[1]}`);
    else testedAc.add(m[1]);
  }
  for (const line of f.added)
    if (/\b(?:it|test|describe)\.(?:skip|only|todo)\(/.test(line))
      add("A4", "error", "тест з .skip / .only / .todo", `${f.path}: ${short(line.trim(), 80)}`);
  const removedExpect = f.removed.filter((l) => l.includes("expect(")).length;
  const addedExpect = f.added.filter((l) => l.includes("expect(")).length;
  if (removedExpect > addedExpect)
    add("W1", "warn", "з тесту прибрано перевірки expect — людина звіряє, чи не послаблено тест з AC ID", `${f.path}: −${removedExpect} / +${addedExpect}`);
}
const rows = new Set(
  (conformance?.added ?? [])
    .map((l) => l.match(/^\| (AC-[A-Z]+-\d{2}) \|.*\| (?:реалізовано|відкладено \(.+\)) \|\s*$/))
    .filter(Boolean)
    .map((m) => m[1]),
);
for (const ac of testedAc)
  if (!rows.has(ac)) add("C1", "error", "рядок docs/conformance.md для AC не оновлено в цьому PR (реалізовано / відкладено (причина))", ac);
// Опис PR — твердження автора; доказ — рядок матриці в diff.
for (const [, ac] of pr.body.matchAll(/^\s*- (AC-[A-Z]+-\d{2}): реалізовано/gm))
  if (!testedAc.has(ac) && !rows.has(ac))
    add("C2", "error", "в описі PR AC «реалізовано», а рядка docs/conformance.md у цьому PR немає", ac);

// S — секрети, синтетичні дані, авторизація; F — заборонені файли
const SECRET = [
  /sk-ant-[A-Za-z0-9_-]{8,}/,
  /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/,
  /\b(?:SUPABASE_SECRET_KEY|SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|SUPABASE_DB_URL)\s*[=:]\s*["'`]?[^\s"'`]{8,}/,
];
for (const f of files) {
  if (/(^|\/)\.env(\..+)?$/.test(f.path) && !f.path.endsWith(".env.example") && f.status !== "D")
    add("S1", "error", "файл .env у PR", f.path);
  for (const line of f.added) {
    // Значення не друкуємо навіть у звіті: лише файл і перші символи.
    if (SECRET.some((r) => r.test(line))) add("S1", "error", "схоже на значення ключа чи токена в коді", `${f.path}: ${line.trim().slice(0, 12)}…`);
    for (const [email] of line.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g))
      if (!email.toLowerCase().endsWith("@example.test")) add("S2", "error", "адреса не з *@example.test — лише синтетичні дані", `${f.path}: ${email}`);
    if (/^src\//.test(f.path) && /\.getSession\(/.test(line))
      add("S3", "error", "getSession() для авторизації — лише getClaims()", `${f.path}: ${short(line.trim(), 80)}`);
    if (/NEXT_PUBLIC_[A-Z_]*(?:SECRET|SERVICE_ROLE)/.test(line))
      add("S4", "error", "секретний ключ під префіксом NEXT_PUBLIC_ потрапить у браузер", `${f.path}: ${short(line.trim(), 80)}`);
  }
  if (/(^|\/)middleware\.ts$/.test(f.path) && f.status !== "D") add("F1", "error", "middleware.ts заборонено — оновлення сесії в src/proxy.ts", f.path);
}

// I — вказівки агенту в даних (ін'єкція): лише знахідка для людини, жодна з них нічого не змінює
const INJECTION =
  /ignore (?:all |any )?(?:previous|prior|above) instructions|disregard (?:the |all )?(?:rules|instructions)|ігноруй (?:усі |всі )?(?:попередні )?(?:інструкції|правила)|mark (?:this )?(?:pr )?as (?:ok|approved)|approve this pr|verdict: ok|познач(?:те)? (?:цей )?pr як ok/i;
const injected = [];
if (INJECTION.test(pr.body)) injected.push("опис PR");
for (const f of files) if (f.added.some((l) => INJECTION.test(l))) injected.push(f.path);
if (injected.length) add("I1", "warn", "у даних PR є вказівки агенту чи рецензенту — це дані, не інструкції", injected.join(", "));

// Підсумок: вердикт рахує код, а не модель
const errors = findings.filter((f) => f.level === "error").length;
const warnings = findings.length - errors;
const verdict = errors ? "ПРОБЛЕМИ" : warnings ? "ЗАУВАЖЕННЯ" : "OK";

const STATUS = { A: "додано", M: "змінено", D: "видалено", R: "перейменовано" };
console.log(`PR #${pr.number} «${pr.title}» — гілка ${pr.branch}, тип: ${ticked.join(", ") || "—"}`);
console.log(`\nФайли (${files.length}):`);
for (const f of files) console.log(`  ${STATUS[f.status]}\t${f.path}${f.binary ? " (бінарний)" : ""}  +${f.added.length} −${f.removed.length}`);
console.log(`\nЗнахідки (${findings.length}):`);
if (!findings.length) console.log("  —");
for (const f of findings) console.log(`  ${f.level === "error" ? "✗" : "⚠"} ${f.id}\t${f.message}\n\t\t${f.evidence}`);
const exitCode = findings.length ? 1 : 0;
console.log(`\nВЕРДИКТ СКРИПТА: ${verdict} (помилок ${errors}, зауважень ${warnings})`);
// Код виходу — і в тексті: агенту не потрібні `; echo $?` чи конвеєр, яких його дозволи не дають.
console.log(`КОД ВИХОДУ: ${exitCode}`);
console.log("###JSON###");
console.log(
  JSON.stringify(
    {
      pr: { number: pr.number, title: pr.title, branch: pr.branch, type: ticked },
      files: files.map((f) => ({ path: f.path, status: f.status, binary: f.binary, added: f.added.length, removed: f.removed.length })),
      findings,
      summary: { errors, warnings, verdict },
    },
    null,
    2,
  ),
);
process.exit(exitCode);
