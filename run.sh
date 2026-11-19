#!/usr/bin/env bash
# Запуск перевіряльника PR без людини за клавіатурою (cron, CI): claude -p («print», headless).
# Вхід — ваша підписка Claude (claude /login один раз) або CLAUDE_CODE_OAUTH_TOKEN з `claude setup-token`.
# Лише для ОСОБИСТОГО використання: інструмент для інших людей — лише з API-ключем (README, «Політика»).
#
#   ./run.sh pr-101-clean          # тека знімка PR у data/
#
# Без --bare: --bare пропускає CLAUDE.md, скіли, .claude/agents і хуки та не читає вхід підпискою — працівника немає.
set -euo pipefail
cd "$(dirname "$0")"
export MSYS_NO_PATHCONV=1 # Git Bash на Windows: не перетворювати «/pr-checker» на шлях

SET="${1:?використання: ./run.sh <набір у data/>}"
CLAUDE_BIN="${CLAUDE_BIN:-claude}"
MODEL="${MODEL:-claude-sonnet-5-5}"
STAMP="$(date +%Y-%m-%dT%H-%M-%S)"
mkdir -p out/runs

# --permission-mode dontAsk: усе, що не дозволено явно, — відмова (без людини нема кому натиснути «так»).
# --allowedTools: те саме, що allow у .claude/settings.json (deny звідти діє й тут).
# --max-turns: стеля кроків; --output-format json: результат, кроки й total_cost_usd у файл.
set +e
"$CLAUDE_BIN" -p "/pr-checker data/${SET}" \
  --model "$MODEL" \
  --permission-mode dontAsk \
  --allowedTools "Skill(pr-checker),Agent(pr-check-verifier),Bash(node scripts/pr-check.mjs *),Read,Grep,Glob,Edit(/out/**)" \
  --max-turns 30 \
  --output-format json \
  > "out/runs/${STAMP}-${SET}.json"
code=$?
set -e

echo "Результат запуску: out/runs/${STAMP}-${SET}.json (код виходу ${code}); звіт — новий файл у out/"
exit "$code"
