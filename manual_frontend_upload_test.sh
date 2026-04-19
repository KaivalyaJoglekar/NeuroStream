#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:4000}"
MS5_BASE="${MS5_BASE:-http://localhost:8085}"
EMAIL="${EMAIL:-test@test.com}"
PASSWORD="${PASSWORD:-Test@123}"
MS5_SECRET="${MS5_SECRET:-your_shared_internal_secret}"
POLL_ATTEMPTS="${POLL_ATTEMPTS:-50}"
POLL_INTERVAL="${POLL_INTERVAL:-3}"
LIST_LIMIT="${LIST_LIMIT:-50}"
AUTO_SEND_TEST_EVENT="${AUTO_SEND_TEST_EVENT:-1}"
AUTO_EVENT_TYPE="${AUTO_EVENT_TYPE:-SEARCH}"
AUTO_EVENT_TIMESTAMP="${AUTO_EVENT_TIMESTAMP:-12}"
AUTO_EVENT_QUERY="${AUTO_EVENT_QUERY:-manual script test query}"
SCRIPT_START_EPOCH="$(date +%s)"

step() {
  echo
  echo "============================================================"
  echo "$1"
  echo "============================================================"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

health_or_fail() {
  local url="$1"
  echo "Checking ${url}"
  curl -fsS "$url" | jq . >/dev/null
}

get_video_ids() {
  local token="$1"
  curl -sS "${BASE}/api/videos?page=1&limit=${LIST_LIMIT}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" | jq -r 'if .success == true then .data[]?.id // empty else empty end'
}

get_recent_video_id_since() {
  local token="$1"
  local started_epoch="$2"
  curl -sS "${BASE}/api/videos?page=1&limit=${LIST_LIMIT}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" | jq -r --argjson started "$started_epoch" '
      if .success == true then .data else [] end
      | map(select((.createdAt | fromdateiso8601?) != null and ((.createdAt | fromdateiso8601) >= ($started - 5))))
      | .[0].id // empty
    '
}

get_library_json() {
  local token="$1"
  curl -sS "${BASE}/api/videos?page=1&limit=${LIST_LIMIT}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json"
}

get_library_total() {
  local token="$1"
  get_library_json "$token" | jq -r 'if .success == true then (.pagination.total // 0) else 0 end'
}

send_video_event() {
  local token="$1"
  local video_id="$2"
  local event_type="$3"
  local timestamp_sec="$4"
  local query_text="$5"

  local payload
  if [[ "$event_type" == "SEARCH" ]]; then
    payload=$(jq -n \
      --arg eventType "$event_type" \
      --argjson timestampSec "$timestamp_sec" \
      --arg queryText "$query_text" \
      '{eventType:$eventType,timestampSec:$timestampSec,queryText:$queryText}')
  else
    payload=$(jq -n \
      --arg eventType "$event_type" \
      --argjson timestampSec "$timestamp_sec" \
      '{eventType:$eventType,timestampSec:$timestampSec}')
  fi

  curl -sS -X POST "${BASE}/api/videos/${video_id}/events" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

print_latest_videos() {
  local token="$1"
  curl -sS "${BASE}/api/videos?page=1&limit=5" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" | jq -r '
      if .success == true then .data else [] end
      | .[]? | "- \(.id) | \(.createdAt) | \(.title)"
    '
}

count_ids() {
  local ids="$1"
  printf '%s\n' "$ids" | sed '/^$/d' | wc -l | tr -d ' '
}

first_new_video_id() {
  local before_ids="$1"
  local now_ids="$2"

  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    if ! printf '%s\n' "$before_ids" | grep -Fxq "$candidate"; then
      echo "$candidate"
      return 0
    fi
  done <<< "$now_ids"

  return 1
}

require_cmd curl
require_cmd jq

step "1) Health checks"
health_or_fail "http://localhost:8081/health"
health_or_fail "http://localhost:8002/health"
health_or_fail "http://localhost:8003/health"
health_or_fail "${MS5_BASE}/health"
health_or_fail "${BASE}/health"
echo "All required services are reachable."

step "2) Script API login (independent of browser session)"
LOGIN_PAYLOAD=$(jq -n --arg email "$EMAIL" --arg password "$PASSWORD" '{email:$email,password:$password}')
AUTH_RESP=$(curl -sS -X POST "${BASE}/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_PAYLOAD")

if [[ "$(echo "$AUTH_RESP" | jq -r '.success // "false"')" != "true" ]]; then
  echo "Login failed. Trying register once, then login..."
  REGISTER_PAYLOAD=$(jq -n --arg name "Test User" --arg email "$EMAIL" --arg password "$PASSWORD" '{name:$name,email:$email,password:$password}')
  curl -sS -X POST "${BASE}/auth/register" \
    -H "Content-Type: application/json" \
    -d "$REGISTER_PAYLOAD" >/dev/null || true

  AUTH_RESP=$(curl -sS -X POST "${BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_PAYLOAD")
fi

echo "$AUTH_RESP" | jq .

TOKEN=$(echo "$AUTH_RESP" | jq -r '.data.token // empty')
USER_ID=$(echo "$AUTH_RESP" | jq -r '.data.user.id // empty')

if [[ -z "$TOKEN" || -z "$USER_ID" ]]; then
  echo "Could not obtain token or user id."
  exit 1
fi

echo "Using EMAIL=${EMAIL}"
echo "Using PASSWORD=${PASSWORD}"
echo "USER_ID=${USER_ID}"
echo "Script start epoch=${SCRIPT_START_EPOCH}"
echo "Note: this login is only for script API calls, not your frontend browser session."

step "3) Manual upload on frontend"
IDS_BEFORE="$(get_video_ids "$TOKEN")"
TOTAL_BEFORE="$(get_library_total "$TOKEN")"
echo "Current video count before upload: $(count_ids "$IDS_BEFORE")"
echo "Current pagination total before upload: ${TOTAL_BEFORE}"
echo "Now upload a video manually in the frontend (http://localhost:3000/upload)."
echo "Make sure you are logged in on frontend with the same email: ${EMAIL}"
echo "Auto-detection is running now. Upload the video in frontend; the script will continue automatically."
echo "If frontend is logged out, script login does not auto-login the browser."

step "4) Auto-detect the newly uploaded video"
VIDEO_ID=""
for i in $(seq 1 "$POLL_ATTEMPTS"); do
  LIB_NOW="$(get_library_json "$TOKEN")"
  if [[ "$(echo "$LIB_NOW" | jq -r '.success // false')" != "true" ]]; then
    echo "Attempt ${i}/${POLL_ATTEMPTS}: videos API error"
    echo "$LIB_NOW" | jq . || echo "$LIB_NOW"
    sleep "$POLL_INTERVAL"
    continue
  fi

  IDS_NOW="$(echo "$LIB_NOW" | jq -r '.data[]?.id // empty')"
  TOTAL_NOW="$(echo "$LIB_NOW" | jq -r '.pagination.total // 0')"
  echo "Attempt ${i}/${POLL_ATTEMPTS}: page_count=$(count_ids "$IDS_NOW"), total=${TOTAL_NOW}"

  VIDEO_ID="$(first_new_video_id "$IDS_BEFORE" "$IDS_NOW" || true)"
  if [[ -z "$VIDEO_ID" ]]; then
    VIDEO_ID="$(get_recent_video_id_since "$TOKEN" "$SCRIPT_START_EPOCH" || true)"
  fi

  if [[ -n "$VIDEO_ID" ]]; then
    break
  fi

  sleep "$POLL_INTERVAL"
done

if [[ -z "$VIDEO_ID" ]]; then
  echo "Auto-detect failed: no new video appeared in ${POLL_ATTEMPTS} attempts."
  echo "Latest videos visible to ${EMAIL}:"
  print_latest_videos "$TOKEN" || true
  echo "Possible cause: frontend upload happened under a different account than ${EMAIL}."
  echo "Please ensure upload is fully completed in the frontend and rerun the script."
  exit 1
fi

echo "Detected VIDEO_ID=${VIDEO_ID}"

echo "Video URL (optional to open):"
echo "http://localhost:3000/videos/${VIDEO_ID}"

step "5) Check workflow status"
for i in $(seq 1 "$POLL_ATTEMPTS"); do
  DETAILS=$(curl -sS "${BASE}/api/videos/${VIDEO_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json")

  STATUS=$(echo "$DETAILS" | jq -r '.data.status // "unknown"')
  echo "status=${STATUS}"

  case "$STATUS" in
    MEDIA_PROCESSED|AI_PROCESSED|INDEXED|ANALYTICS_READY|COMPLETED|FAILED)
      break
      ;;
  esac

  sleep "$POLL_INTERVAL"
done

if [[ "$AUTO_SEND_TEST_EVENT" == "1" ]]; then
  step "6) Send test interaction event (non-interactive)"
  echo "Sending ${AUTO_EVENT_TYPE} event at ${AUTO_EVENT_TIMESTAMP}s"
  EVENT_RESP="$(send_video_event "$TOKEN" "$VIDEO_ID" "$AUTO_EVENT_TYPE" "$AUTO_EVENT_TIMESTAMP" "$AUTO_EVENT_QUERY")"
  echo "$EVENT_RESP" | jq .

  if [[ "$(echo "$EVENT_RESP" | jq -r '.success // false')" != "true" ]]; then
    echo "Failed to send test interaction event via MS4."
    exit 1
  fi
else
  step "6) Skipping test interaction event"
  echo "AUTO_SEND_TEST_EVENT=0, so no interaction event was sent by script."
fi

step "7) Verify MS5 received events"
RECOMPUTE=$(curl -sS -X POST "${MS5_BASE}/api/v1/analytics/${USER_ID}/${VIDEO_ID}/recompute" \
  -H "X-Internal-Secret: ${MS5_SECRET}")
echo "Recompute response:"
echo "$RECOMPUTE" | jq .

ANALYTICS=$(curl -sS "${MS5_BASE}/api/v1/analytics/${USER_ID}/${VIDEO_ID}" \
  -H "X-Internal-Secret: ${MS5_SECRET}")
QUERIES=$(curl -sS "${MS5_BASE}/api/v1/analytics/${USER_ID}/${VIDEO_ID}/queries" \
  -H "X-Internal-Secret: ${MS5_SECRET}")

echo "Analytics response:"
echo "$ANALYTICS" | jq .

echo "Queries response:"
echo "$QUERIES" | jq .

if echo "$ANALYTICS" | jq -e '.detail? != null' >/dev/null 2>&1; then
  echo "MS5 analytics verification failed. Check MS5 secret and logs."
  exit 1
fi

if [[ "$AUTO_SEND_TEST_EVENT" == "1" && "$AUTO_EVENT_TYPE" == "SEARCH" ]]; then
  if ! echo "$QUERIES" | jq -e --arg q "$AUTO_EVENT_QUERY" '.query_history[]?.query_text == $q' >/dev/null 2>&1; then
    echo "Expected search query not found in MS5 query history yet."
    exit 1
  fi
fi

step "Done"
echo "Manual frontend upload test completed."
