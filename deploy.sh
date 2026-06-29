#!/bin/sh
set -e
cd "$(dirname "$0")"

gh repo create alice-team --public --source=. --remote=origin --push --description "Cherry Storm — interactive study" 2>/dev/null || git push -u origin main

gh api "repos/fovkotov/alice-team/pages" -X POST \
  -f build_type=legacy \
  -f source[branch]=main \
  -f source[path]=/ 2>/dev/null || true

echo ""
echo "https://fovkotov.github.io/alice-team/"
echo "пароль: alice"
