#!/usr/bin/env bash
# 前端构建缓存脚本：基于源码 hash 判断是否需要重新构建
# 支持跨窗口共享缓存

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
EMBED_DIR="$ROOT_DIR/backend-go/frontend/dist"
HASH_FILE="$EMBED_DIR/.source-hash"

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

HASH_CMD=()
if command -v sha256sum >/dev/null 2>&1; then
  HASH_CMD=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  HASH_CMD=(shasum -a 256)
else
  echo -e "${RED}缺少 sha256sum 或 shasum，无法计算前端源码 hash${NC}" >&2
  exit 1
fi

# 计算前端源码 hash
compute_hash() {
  local source_paths=(
    "$FRONTEND_DIR/src"
    "$FRONTEND_DIR/public"
    "$FRONTEND_DIR/index.html"
    "$FRONTEND_DIR/vite.config.ts"
    "$FRONTEND_DIR/tsconfig.json"
    "$FRONTEND_DIR/tsconfig.app.json"
    "$FRONTEND_DIR/bun.lock"
  )
  local existing_paths=()
  local path

  for path in "${source_paths[@]}"; do
    if [ -e "$path" ]; then
      existing_paths+=("$path")
    fi
  done

  if [ "${#existing_paths[@]}" -eq 0 ]; then
    echo -e "${RED}未找到前端源码，无法计算 hash${NC}" >&2
    return 1
  fi

  find "${existing_paths[@]}" -type f \
    | sort \
    | while IFS= read -r path; do
        "${HASH_CMD[@]}" "$path"
      done \
    | "${HASH_CMD[@]}" \
    | cut -d' ' -f1
}

current_hash=$(compute_hash)

# 检查缓存是否有效
if [ -f "$HASH_FILE" ] && [ -d "$EMBED_DIR/assets" ]; then
  cached_hash=$(cat "$HASH_FILE" 2>/dev/null || echo "")
  if [ "$current_hash" = "$cached_hash" ]; then
    echo -e "${GREEN}✅ 前端未变更，跳过构建${NC}"
    exit 0
  fi
fi

# 需要重新构建
echo -e "${GREEN}📦 构建前端...${NC}"
cd "$FRONTEND_DIR" && bun run build

if [ ! -f "$FRONTEND_DIR/dist/index.html" ] || [ ! -d "$FRONTEND_DIR/dist/assets" ]; then
  echo -e "${RED}前端构建产物不完整，停止嵌入${NC}" >&2
  exit 1
fi

echo -e "${GREEN}📋 嵌入前端到 Go 后端...${NC}"
rm -rf "$EMBED_DIR"
mkdir -p "$EMBED_DIR"
cp -R "$FRONTEND_DIR/dist/." "$EMBED_DIR/"

if [ ! -f "$EMBED_DIR/index.html" ] || [ ! -d "$EMBED_DIR/assets" ]; then
  echo -e "${RED}前端嵌入产物不完整，停止构建${NC}" >&2
  exit 1
fi

# 写入新 hash
echo "$current_hash" > "$HASH_FILE"
echo -e "${GREEN}✅ 前端构建完成（hash: ${current_hash:0:12}...）${NC}"
