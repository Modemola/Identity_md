#!/usr/bin/env bash
# One records pass: index both sources into ./data, then publish ./data as the single commit on the
# `data` branch. Run from the workflow's workspace (code/ and data/ side by side).
set -euo pipefail
node code/scripts/records/indexer.mjs data/records/vibevibe-46630
node code/scripts/records/imd.mjs data/records/imd-4663
cd data
git config user.name "kept-records"
git config user.email "kept-records@users.noreply.github.com"
git add -A
if git diff --cached --quiet; then echo "no change"; exit 0; fi
# one commit only: history isn't needed and would grow by megabytes an hour
git commit -q -m "records at block $(node -e 'console.log(require("./records/vibevibe-46630/meta.json").block)')"
git reset -q --soft "$(git commit-tree HEAD^{tree} -m "KEPT launcher records, rebuilt hourly")"
git push -q -f origin HEAD:data
