**Стан: OK**

# Перевірка PR #101

- **PR:** #101 «Задача 1.1 impl-session-notes: нотатка терапевта до сеансу (AC-NOTE-01)»
- **Гілка:** `task/session-notes`, тип: Реалізація
- **Набір:** `data/pr-101-clean`
- **Дата перевірки:** 2026-11-19

## Знахідки скрипта

Вивід `node scripts/pr-check.mjs check data/pr-101-clean`: **знахідок 0**, ВЕРДИКТ СКРИПТА: OK (помилок 0, зауважень 0), код виходу 0.

| ID | Рівень | Де | Пояснення |
|---|---|---|---|
| — | — | — | Знахідок немає |

Файли в PR (5): `docs/conformance.md`, `openspec/changes/impl-session-notes/tasks.md`, `src/app/sessions/[id]/note-actions.ts`, `supabase/migrations/20261120090000_session_notes.sql`, `tests/scheduling/session-note.test.ts`.

## Незалежний перевіряльник (`pr-check-verifier`)

Вердикт: **OK**. Збігається з вердиктом скрипта. Вибірково підтвердив за сирими даними:

- T1/T2: гілка `task/session-notes`, відмічено лише «Реалізація».
- M2/M3: нова таблиця `session_notes` має `enable row level security` і `revoke all … from anon, authenticated`; наявних міграцій не змінено.
- C1/C2/A3: рядок AC-NOTE-01 у `docs/conformance.md` оновлено в цьому ж PR; AC є в `spec-ac.txt`; тест починається з `AC-NOTE-01:`.
- P1/P2: усі шляхи в переліку «Реалізації».
- S2/S3: адреса `therapist1@example.test`; `getSession` немає; ключів і `.env` немає.
- I1: вказівок агенту в даних немає.

## Що лишається людині

Твердження опису, яких не довести з diff, і пункти, яких скрипт не перевіряє:

1. **CI зелений і відповіді на коментарі CodeRabbit** — стан на GitHub, у знімку його немає.
2. **Дослівний текст «Note saved.»** з AC PM — вимог PM у знімку немає; звірити з джерелом вимог.
3. **Файли поза diff:** `MESSAGES.NOTE_SAVED`, `NOTE_FORBIDDEN`, `NOTE_FAILED` у `@/lib/scheduling/messages`, `requireRole` у `@/lib/auth/require-role`, `tests/support/as-user` — у PR їх не додано; переконатися, що вони є на базі PR.
4. **Опис PR про міграцію** («явні grant, політики `to authenticated` з `(select auth.uid())`») — у diff підтверджено (рядки міграції з `grant select, insert` і двома політиками).
5. **Очевидна поведінкова прогалина (питання, не знахідка):** `session_id` у `session_notes` без зовнішнього ключа, а `saveSessionNote` не перевіряє, що сеанс належить цьому терапевту («нотатку пише лише терапевт сеансу» — коментар у коді). Політика RLS перевіряє лише `author_id`. Чи це покрито AC-NOTE-02 («інший терапевт нотатки не бачить» — відкладено) — вирішує людина.

## Чернетка коментаря для автора PR (людина вирішує, чи публікувати)

> Дякую за PR! Автоматична перевірка за правилами «Реалізації» не знайшла порушень. Кілька питань перед рев'ю:
>
> 1. Переконайтеся, що CI зелений і відповіді на коментарі CodeRabbit дано.
> 2. Звірте текст «Note saved.» з AC-NOTE-01 у вимогах PM.
> 3. `saveSessionNote` перевіряє лише роль `therapist`, а не те, що сеанс належить цьому терапевту, і `session_id` у `session_notes` без зовнішнього ключа. Якщо це свідомо лишено для AC-NOTE-02, додайте про це рядок в опис PR.
