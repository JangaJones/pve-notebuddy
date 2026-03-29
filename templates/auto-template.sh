#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOLS_DIR="$SCRIPT_DIR/scripts"

mapfile -t SCRIPTS < <(find "$TOOLS_DIR" -maxdepth 1 -type f -name "*.mjs" | sort)

if [ "${#SCRIPTS[@]}" -eq 0 ]; then
  echo "No scripts found in $TOOLS_DIR"
  exit 1
fi

echo "Select a script to run:"
select SCRIPT_PATH in "${SCRIPTS[@]}" "Quit"; do
  if [ "$REPLY" -eq $(( ${#SCRIPTS[@]} + 1 )) ]; then
    echo "Aborted."
    exit 0
  fi

  if [ -n "${SCRIPT_PATH:-}" ]; then
    shift_count=0
    echo "Running: $SCRIPT_PATH $*"
    node "$SCRIPT_PATH" "$@"
    exit $?
  fi

  echo "Invalid selection. Try again."
done
