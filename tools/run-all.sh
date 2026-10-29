#!/usr/bin/env bash
# Every check on the game file, one result line each.
#
#   ./run-all.sh                     every check, one at a time
#   ./run-all.sh app.html            on another copy of the game
#   ./run-all.sh modules voice       just these groups or checks
#   JOBS=3 ./run-all.sh              three at a time (about 30 minutes; one at a time, about 80)
#
# Groups:
#   repo     packcheck saves smoke screens platforms
#   extras   coach readaloud voice about reset boss-example generators speech
#   modules  readcheck buddy stickers boss missions sprint family reading
#
# Each check's whole output goes to out/logs/<check>.log; the line printed here
# is its last line, the check's own result. Exits 1 if any check fails.
# validate-packs.js is not run: it checks a folder of raw bank files, not the game.
set -u
# A game file named on the command line is found from the folder this was run in.
CALLER="$(pwd)"
cd "$(dirname "$0")" || exit 2

REPO="packcheck saves smoke screens platforms"
EXTRAS="coach readaloud voice about reset boss-example generators speech"
MODULES="readcheck buddy stickers boss missions sprint family reading"

APP=""
CHECKS=()
for a in "$@"; do
  case "$a" in
    *.html|*.htm) case "$a" in /*) APP="$a" ;; *) APP="$CALLER/$a" ;; esac ;;
    repo)    CHECKS+=($REPO) ;;
    extras)  CHECKS+=($EXTRAS) ;;
    modules) CHECKS+=($MODULES) ;;
    -h|--help) sed -n '2,16p' "$(basename "$0")" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) CHECKS+=("$a") ;;
  esac
done
[ ${#CHECKS[@]} -eq 0 ] && CHECKS=($REPO $EXTRAS $MODULES)
APP="${APP:-../Ticali_Trio_Family_Edition.html}"
[ -f "$APP" ] || { echo "run-all: no game file at $APP"; exit 2; }
APP="$(cd "$(dirname "$APP")" && pwd)/$(basename "$APP")"
JOBS="${JOBS:-1}"

script_for() {
  case " $REPO $EXTRAS " in *" $1 "*) echo "$1.js"; return ;; esac
  case "$1" in
    readcheck) echo "modules/readcheck.js" ;;
    buddy|stickers|boss|missions|sprint|family|reading) echo "modules/$1.test.js" ;;
    *) return 1 ;;
  esac
}
for c in "${CHECKS[@]}"; do
  script_for "$c" > /dev/null || { echo "run-all: no check called \"$c\" (try --help)"; exit 2; }
done

LOGS=out/logs
mkdir -p "$LOGS"
echo "run-all: ${#CHECKS[@]} checks on $APP, $JOBS at a time; logs in tools/$LOGS/"

# One check: its log, then its result line in <check>.result.
run_one() {
  local c="$1" log="$LOGS/$1.log" start code secs last
  start=$(date +%s)
  node "$(script_for "$c")" "$APP" > "$log" 2>&1
  code=$?
  secs=$(( $(date +%s) - start ))
  last="$(grep -v '^[[:space:]]*$' "$log" | tail -n 1 | cut -c1-200)"
  if [ "$code" -eq 0 ]; then
    printf '%-4s  %-12s %5ss  %s\n' PASS "$c" "$secs" "$last" > "$LOGS/$c.result"
  else
    printf '%-4s  %-12s %5ss  %s  (exit %s, see tools/%s)\n' FAIL "$c" "$secs" "$last" "$code" "$log" > "$LOGS/$c.result"
  fi
  cat "$LOGS/$c.result"
}

T0=$(date +%s)
# Empty this run's result files first: one left over from an earlier run never counts.
for c in "${CHECKS[@]}"; do : > "$LOGS/$c.result"; done
for c in "${CHECKS[@]}"; do
  if [ "$JOBS" -le 1 ]; then
    run_one "$c"
  else
    while [ "$(jobs -rp | wc -l)" -ge "$JOBS" ]; do wait -n 2> /dev/null || sleep 1; done
    run_one "$c" &
  fi
done
wait

pass=0; fail=0
for c in "${CHECKS[@]}"; do
  if grep -q '^PASS' "$LOGS/$c.result" 2> /dev/null; then pass=$((pass + 1)); else fail=$((fail + 1)); fi
done
mins=$(( ($(date +%s) - T0 + 59) / 60 ))
if [ "$fail" -eq 0 ]; then
  echo "run-all: PASS — all $pass checks passed (${mins} min)"
else
  echo "run-all: FAIL — $fail of $((pass + fail)) checks failed:$(for c in "${CHECKS[@]}"; do grep -q '^PASS' "$LOGS/$c.result" 2> /dev/null || printf ' %s' "$c"; done) (${mins} min)"
  exit 1
fi
