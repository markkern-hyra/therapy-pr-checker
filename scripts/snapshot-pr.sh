#!/usr/bin/env bash
# Знімок справжнього PR у data/pr-<номер>/ — запускає ЛЮДИНА: потрібні мережа й gh, яких працівник не має
# (.claude/settings.json забороняє йому і gh, і цей скрипт). Працівник потім читає лише файли знімка.
#
#   scripts/snapshot-pr.sh <owner/repo> <номер PR> <шлях до локального клону цього репо>
#
# spec-ac.txt — AC ID зі сценаріїв openspec/specs/ на origin/main клону (база відкритого PR).
set -euo pipefail
cd "$(dirname "$0")/.."
repo="${1:?owner/repo}"; n="${2:?номер PR}"; clone="${3:?шлях до клону}"
out="data/pr-${n}"
mkdir -p "$out"
gh pr view "$n" --repo "$repo" --json number,title,headRefName,body \
  --jq '{number, title, branch: .headRefName, body}' > "$out/pr.json"
gh pr diff "$n" --repo "$repo" > "$out/diff.patch"
git -C "$clone" fetch -q origin
git -C "$clone" grep -ohE '^#### Scenario: AC-[A-Z]+-[0-9]{2}' origin/main -- openspec/specs \
  | sed 's/^#### Scenario: //' | sort -u > "$out/spec-ac.txt"
echo "Знімок: $out ($(wc -l < "$out/spec-ac.txt" | tr -d ' ') AC у специфікації). Далі: ./run.sh pr-${n}"
