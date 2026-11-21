#!/usr/bin/env bash
# Fails when a normal build contains the demo: checks file contents and file names.
set -euo pipefail

dir="${1:-dist}"
patterns=('mockServiceWorker' 'msw/' 'Ukázka: obchod běží' 'Vyzkoušejte okrajové stavy')

[ -d "$dir" ] || { echo "check-no-demo: $dir does not exist" >&2; exit 2; }

found=0
for pattern in "${patterns[@]}"; do
  if grep -rIlF -e "$pattern" "$dir"; then
    echo "check-no-demo: '$pattern' found in the files above" >&2
    found=1
  fi
done

if names=$(find "$dir" -iname '*mockServiceWorker*' -o -iname '404.html' | grep .); then
  echo "$names"
  echo "check-no-demo: demo-only file names found above" >&2
  found=1
fi

exit "$found"
