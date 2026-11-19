# Перевіряльник PR «Реалізація» — віртуальний працівник на Claude Code

Віртуальний працівник (бонус WS10 курсу QuitCode, шлях 1 — Claude Code на власній підписці). Перед рев'ю людиною він
перевіряє PR типу «Реалізація» курсового проєкту за правилами `AGENTS.md` шаблону курсу і пише звіт з чернеткою
коментаря для автора. Рішення — коментар, «Request changes», merge — ухвалює людина.

Звіт для здачі: [`docs/worker/README.md`](docs/worker/README.md) (картка ролі, межі, перевіряльник, golden data,
журнал запуску, вартість). Побудовано на шаблоні курсу `materials/worker-claude-code` (MIT, © Vyacheslav Koldovskyy).

## Як влаштовано

| Складова | Де |
|---|---|
| Роль і межі | [`AGENTS.md`](AGENTS.md), `description` у [`SKILL.md`](.claude/skills/pr-checker/SKILL.md) |
| Перевіряє код | [`scripts/pr-check.mjs`](scripts/pr-check.mjs): 22 правила, таблиця + `###JSON###`, код виходу 0 / 1 / 2 |
| Правила й «Відомі граблі» | [`references/rules.md`](references/rules.md) — кожне правило з розділом `AGENTS.md` |
| Оркестратор | скіл [`pr-checker`](.claude/skills/pr-checker/SKILL.md): процедури A (скрипт), B (що скрипт не бачить), D (перевіряльник), звіт |
| Перевіряльник | субагент [`pr-check-verifier`](.claude/agents/pr-check-verifier.md): чистий контекст, лише читання, не бачить висновків оркестратора |
| Межі в налаштуваннях | [`.claude/settings.json`](.claude/settings.json) + `--permission-mode dontAsk` у [`run.sh`](run.sh) |
| Golden data | `data/pr-101-clean`, `data/pr-102-violations`, `data/pr-103-injection`; відповіді — у `tests/golden/expected.json` (працівнику заборонено їх читати) |
| Запуск без людини | [`run.sh`](run.sh) → `out/runs/<час>-<набір>.json`, звіт — `out/YYYY-MM-DD PR-<номер> перевірка.md` |

## Спробувати

Потрібні Node 24 і Claude Code з входом у вашу підписку.

```bash
node --test tests/*.test.mjs                          # golden data скрипта без моделі: 7 тестів
node scripts/pr-check.mjs check data/pr-102-violations # таблиця знахідок, код 1
./run.sh pr-103-injection                             # працівник без людини: скіл + перевіряльник + звіт у out/
```

Справжній PR: людина знімає його `scripts/snapshot-pr.sh <owner/repo> <номер> <клон>` (мережа й `gh` — лише в людини;
працівнику цей скрипт заборонено), потім `./run.sh pr-<номер>`.

## Політика

Працівник працює на підписці автора лише для його власної роботи (особисте використання). Інструмент для інших людей —
лише з API-ключем, а не з входом через claude.ai. Дані в `data/` — синтетичні (`*@example.test`, домени `.invalid`);
значення, схожі на ключі, — вигадані й не відповідають формату справжніх ключів.
