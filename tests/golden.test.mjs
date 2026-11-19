// Golden data працівника без моделі: кожен набір у data/ → відомий вердикт і набір знахідок скрипта.
// Відповіді — тут, поза досяжністю працівника: .claude/settings.json забороняє йому Read(/tests/**).
//   node --test tests/*.test.mjs
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

const expected = JSON.parse(readFileSync(new URL("./golden/expected.json", import.meta.url), "utf8"));
const run = (args) => spawnSync(process.execPath, ["scripts/pr-check.mjs", ...args], { encoding: "utf8" });

for (const [set, want] of Object.entries(expected)) {
  test(`${set}: ${want.verdict}, знахідки ${want.ids.join(", ") || "—"}`, () => {
    const r = run(["check", `data/${set}`]);
    assert.equal(r.status, want.exit, r.stderr);
    const json = JSON.parse(r.stdout.split("###JSON###")[1]);
    assert.equal(json.summary.verdict, want.verdict);
    assert.deepEqual([...new Set(json.findings.map((f) => f.id))].sort(), want.ids);
  });
}

test("значення ключа не потрапляє у вивід скрипта", () => {
  const r = run(["check", "data/pr-103-injection"]);
  assert.ok(!r.stdout.includes("EXAMPLE0000fake"), "вивід містить значення ключа");
});

test("тека поза data/ — відмова з кодом 2", () => {
  assert.equal(run(["check", "../"]).status, 2);
});

test("набору немає — НЕ ПЕРЕВІРЕНО, код 2", () => {
  assert.equal(run(["check", "data/немає-такого"]).status, 2);
});

test("PR «Специфікація» — НЕ ПЕРЕВІРЕНО, код 2: працівник перевіряє лише «Реалізацію»", () => {
  const dir = "data/.tmp-spec-pr";
  mkdirSync(dir, { recursive: true });
  try {
    const body = "- [x] **Специфікація** — гілка `spec/add-notes`\n- [ ] **Реалізація**\n";
    writeFileSync(`${dir}/pr.json`, JSON.stringify({ number: 1, title: "spec", branch: "spec/add-notes", body }));
    writeFileSync(`${dir}/spec-ac.txt`, "AC-NOTE-01\n");
    writeFileSync(`${dir}/diff.patch`, "diff --git a/openspec/specs/a.md b/openspec/specs/a.md\n@@ -1 +1 @@\n-a\n+b\n");
    const r = run(["check", dir]);
    assert.equal(r.status, 2);
    assert.match(r.stderr, /Специфікація/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
