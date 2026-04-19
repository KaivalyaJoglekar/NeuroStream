#!/usr/bin/env bash
set -euo pipefail

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

require_cmd curl
require_cmd jq
require_cmd stat

BASE="http://localhost:4000"
EMAIL="test@test.com"
PASSWORD="Test@123"
SAMPLE_MP4="/Users/kaivalyajoglekar/Desktop/Projects/NeuroStream/sample_with_audio.mp4"
MS5_SECRET="your_shared_internal_secret"

step "1) Confirm services are up"
for url in \
  "http://localhost:8081/health" \
  "http://localhost:8002/health" \
  "http://localhost:8003/health" \
  "http://localhost:8085/health" \
  "${BASE}/health"
do
  echo "Checking ${url}"
  curl -fsS "$url" | jq .
done

echo "Using EMAIL=${EMAIL}"
echo "Using PASSWORD=${PASSWORD}"

if [[ ! -r "$SAMPLE_MP4" ]]; then
  echo "Cannot read sample video: $SAMPLE_MP4"
  exit 1
fi

step "2) Register or login"
REGISTER_PAYLOAD=$(jq -n \
  --arg name "Test User" \
  --arg email "$EMAIL" \
  --arg password "$PASSWORD" \
  '{name:$name,email:$email,password:$password}')

AUTH_RESP=$(curl -sS -X POST "${BASE}/auth/register" \
  -H "Content-Type: application/json" \
  -d "$REGISTER_PAYLOAD")

if [[ "$(echo "$AUTH_RESP" | jq -r '.success // "false"')" != "true" ]]; then
  LOGIN_PAYLOAD=$(jq -n \
    --arg email "$EMAIL" \
    --arg password "$PASSWORD" \
    '{email:$email,password:$password}')

  AUTH_RESP=$(curl -sS -X POST "${BASE}/auth/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_PAYLOAD")
fi

echo "$AUTH_RESP" | jq .

TOKEN=$(echo "$AUTH_RESP" | jq -r '.data.token // empty')
USER_ID=$(echo "$AUTH_RESP" | jq -r '.data.user.id // empty')

if [[ -z "$TOKEN" || -z "$USER_ID" ]]; then
  echo "Failed to get TOKEN or USER_ID"
  exit 1
fi

echo "USER_ID=$USER_ID"

step "3) Initiate upload"
FILE_SIZE=$(stat -f%z "$SAMPLE_MP4")
INIT_PAYLOAD=$(jq -n \
  --arg filename "sample_with_audio.mp4" \
  --arg contentType "video/mp4" \
  --argjson fileSize "$FILE_SIZE" \
  --arg title "Sample Video" \
  --arg description "MS4 to MS5 test" \
  '{filename:$filename,contentType:$contentType,fileSize:$fileSize,title:$title,description:$description}')

INIT=$(curl -sS -X POST "${BASE}/api/upload/initiate" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$INIT_PAYLOAD")

echo "$INIT" | jq .

UPLOAD_URL=$(echo "$INIT" | jq -r '.data.uploadUrl // empty')
OBJECT_KEY=$(echo "$INIT" | jq -r '.data.objectKey // empty')

if [[ -z "$UPLOAD_URL" || -z "$OBJECT_KEY" ]]; then
  echo "Failed to get uploadUrl or objectKey"
  exit 1
fi

step "4) Upload binary to presigned URL"
UPLOAD_HTTP=$(curl -sS -X PUT "$UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @"$SAMPLE_MP4" \
  -o /dev/null \
  -w "%{http_code}")

echo "upload_http=${UPLOAD_HTTP}"

if [[ "$UPLOAD_HTTP" != "200" ]]; then
  echo "Upload did not return HTTP 200"
  exit 1
fi

step "5) Complete upload"
COMPLETE_PAYLOAD=$(jq -n \
  --arg objectKey "$OBJECT_KEY" \
  --arg title "Sample Video" \
  --arg description "MS4 to MS5 test" \
  '{objectKey:$objectKey,title:$title,description:$description}')

COMPLETE=$(curl -sS -X POST "${BASE}/api/upload/complete" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$COMPLETE_PAYLOAD")

echo "$COMPLETE" | jq .
VIDEO_ID=$(echo "$COMPLETE" | jq -r '.data.videoId // empty')

if [[ -z "$VIDEO_ID" ]]; then
  echo "Failed to get VIDEO_ID"
  exit 1
fi

echo "VIDEO_ID=$VIDEO_ID"

step "6) Poll video status"
for i in $(seq 1 30); do
  STATUS=$(curl -sS "${BASE}/api/videos/${VIDEO_ID}" \
    -H "Authorization: Bearer ${TOKEN}" | jq -r '.data.status // "unknown"')
  echo "status=${STATUS}"
  case "$STATUS" in
    MEDIA_PROCESSED|AI_PROCESSED|INDEXED|ANALYTICS_READY|COMPLETED|FAILED)
      break
      ;;
  esac
  sleep 2
done

step "7) Send events via MS4"
for payload in \
  '{"eventType":"PLAY","timestampSec":5,"sessionId":"ms4-web-test"}' \
  '{"eventType":"SEEK","timestampSec":42,"sessionId":"ms4-web-test"}' \
  '{"eventType":"SEARCH","timestampSec":45,"queryText":"key insight","sessionId":"ms4-web-test"}'
do
  curl -sS -X POST "${BASE}/api/videos/${VIDEO_ID}/events" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$payload" | jq .
done

step "8) Verify MS5 data"
QUERIES_JSON=$(curl -sS "http://localhost:8085/api/v1/analytics/${USER_ID}/${VIDEO_ID}/queries" \
  -H "X-Internal-Secret: ${MS5_SECRET}")
ANALYTICS_JSON=$(curl -sS "http://localhost:8085/api/v1/analytics/${USER_ID}/${VIDEO_ID}" \
  -H "X-Internal-Secret: ${MS5_SECRET}")

echo "$QUERIES_JSON" | jq .
echo "$ANALYTICS_JSON" | jq .

if echo "$QUERIES_JSON" | jq -e '.detail? != null' >/dev/null 2>&1; then
  echo "MS5 queries verification failed"
  exit 1
fi
if echo "$ANALYTICS_JSON" | jq -e '.detail? != null' >/dev/null 2>&1; then
  echo "MS5 analytics verification failed"
  exit 1
fi

step "Done"
echo "Test completed successfully."
