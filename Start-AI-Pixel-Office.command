#!/bin/bash

set -u

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 22.18 이상을 먼저 설치해 주세요."
  read -r -p "Enter를 누르면 창이 닫힙니다."
  exit 1
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 18) ? 0 : 1)'; then
  echo "현재 Node.js 버전은 $(node --version)입니다. 22.18 이상으로 업데이트해 주세요."
  read -r -p "Enter를 누르면 창이 닫힙니다."
  exit 1
fi

dependencies_ready() {
  [ -d "$PROJECT_ROOT/node_modules" ] &&
    node --input-type=module -e "Promise.all([import('better-sqlite3'), import('vite')]).catch(() => process.exit(1))" >/dev/null 2>&1
}

if ! dependencies_ready; then
  echo "처음 실행에 필요한 패키지를 설치합니다..."
  npm ci --ignore-scripts --no-audit --no-fund || {
    read -r -p "설치에 실패했습니다. Enter를 누르면 창이 닫힙니다."
    exit 1
  }
fi

api_running=false
web_running=false

if curl --silent --fail --max-time 1 "http://127.0.0.1:47372/health" | grep --quiet '"status":"ok"'; then
  api_running=true
fi

if curl --silent --fail --max-time 1 "http://localhost:47371/" | grep --quiet "AI Pixel Office"; then
  web_running=true
fi

if [ "$api_running" = true ] && [ "$web_running" = true ]; then
  echo "AI Pixel Office가 이미 실행 중입니다."
  open "http://localhost:47371/"
  exit 0
fi

(
  for _attempt in $(seq 1 60); do
    if curl --silent --fail --max-time 1 "http://localhost:47371/" | grep --quiet "AI Pixel Office" &&
      curl --silent --fail --max-time 1 "http://127.0.0.1:47372/health" | grep --quiet '"status":"ok"'; then
      open "http://localhost:47371/"
      exit 0
    fi
    sleep 0.5
  done
) &

echo "AI Pixel Office를 시작합니다. 이 창을 닫으면 앱도 종료됩니다."
if [ "$api_running" = true ]; then
  echo "기존 API 서버를 사용합니다."
  npm run dev:web
elif [ "$web_running" = true ]; then
  echo "기존 웹 서버를 사용합니다."
  npm start
else
  npm run office
fi

status=$?
if [ "$status" -ne 0 ]; then
  read -r -p "실행이 종료되었습니다. Enter를 누르면 창이 닫힙니다."
fi
exit "$status"
