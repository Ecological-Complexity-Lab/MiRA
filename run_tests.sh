#!/bin/bash
# Usage: ./run_tests.sh [playwright args]
# Examples:
#   ./run_tests.sh
#   ./run_tests.sh tests/browser/data.spec.js
#   ./run_tests.sh tests/browser/data.spec.js --grep "demo_directed"

OUT=/tmp/playwright_results.txt
cd "$(dirname "$0")"
echo "=== Playwright run: $* ===" > "$OUT"
echo "Started: $(date)" >> "$OUT"
npx playwright test "$@" --reporter=line >> "$OUT" 2>&1
echo "EXIT:$?" >> "$OUT"
echo "Finished: $(date)" >> "$OUT"
