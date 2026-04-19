#!/usr/bin/env bash
# smoke-test.sh — 启动自检脚本
# 顺序执行：install → prisma → build → start → health check → cleanup
# 任一步失败：打印错误，exit 1
# 全部通过：打印 "✅ 启动自检通过"，exit 0

set -euo pipefail

# ──────────────── 配置 ────────────────
PORT="${PORT:-5000}"
HEALTH_URL="http://localhost:${PORT}/api/health"
BUILD_LOG="/tmp/build.log"
SERVER_PID=""
STARTUP_WAIT=15

# ──────────────── 清理函数 ────────────────
cleanup() {
  if [ -n "${SERVER_PID}" ]; then
    echo "🧹 清理后台进程 (PID: ${SERVER_PID})..."
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
    SERVER_PID=""
  fi
}
trap cleanup EXIT

# ──────────────── 步骤函数 ────────────────
step() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "▶ 步骤 $1: $2"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

fail() {
  echo ""
  echo "❌ 失败: $1"
  echo "   错误详情: $2"
  cleanup
  exit 1
}

# ──────────────── 步骤1: pnpm install ────────────────
step 1 "安装依赖 (bun install --frozen-lockfile)"
if ! bun install --frozen-lockfile 2>&1; then
  fail "bun install" "依赖安装失败，请检查 bun.lock 和 package.json"
fi
echo "✅ 依赖安装完成"

# ──────────────── 步骤2: prisma generate ────────────────
step 2 "生成 Prisma Client (npx prisma generate)"
if ! npx prisma generate 2>&1; then
  fail "prisma generate" "Prisma Client 生成失败，请检查 schema.prisma"
fi
echo "✅ Prisma Client 生成完成"

# ──────────────── 步骤3: prisma db push ────────────────
step 3 "同步数据库 Schema (npx prisma db push)"
if ! DATABASE_URL="file:./prisma/db/custom.db" npx prisma db push 2>&1; then
  fail "prisma db push" "数据库 Schema 同步失败，请检查 DATABASE_URL 和 schema.prisma"
fi
echo "✅ 数据库 Schema 同步完成"

# ──────────────── 步骤4: build ────────────────
step 4 "构建项目 (next build)"
if ! DATABASE_URL="file:./prisma/db/custom.db" npx next build > "${BUILD_LOG}" 2>&1; then
  # 检查 build log 中是否有真正的 error（排除 error-handler 等正常命名）
  ERROR_COUNT=$(grep -iE '\berror\b' "${BUILD_LOG}" | grep -viE 'error-handler|errorboundary|errorfallback|onError|error\.ts|useErrorBoundary' | wc -l || true)
  echo "构建失败，构建日志："
  tail -30 "${BUILD_LOG}"
  fail "next build" "构建失败，${BUILD_LOG} 中有 ${ERROR_COUNT} 处错误"
fi

# 额外检查构建日志中的 error 关键字（排除正常命名）
ERROR_COUNT=$(grep -iE '\berror\b' "${BUILD_LOG}" | grep -viE 'error-handler|errorboundary|errorfallback|onError|error\.ts|useErrorBoundary|ErrorBoundary|ErrorFallback' | wc -l || true)
if [ "${ERROR_COUNT}" -gt 0 ]; then
  echo "⚠️  构建日志中发现 ${ERROR_COUNT} 处 error 关键字："
  grep -iE '\berror\b' "${BUILD_LOG}" | grep -viE 'error-handler|errorboundary|errorfallback|onError|error\.ts|useErrorBoundary|ErrorBoundary|ErrorFallback' | head -10
  fail "next build" "构建日志中有 error 关键字（${ERROR_COUNT} 处）"
fi
echo "✅ 项目构建完成（无 error 关键字）"

# ──────────────── 步骤5: 启动服务器 ────────────────
step 5 "后台启动服务器 (next start -p ${PORT})"
DATABASE_URL="file:./prisma/db/custom.db" NODE_OPTIONS="--max-old-space-size=384" npx next start -p "${PORT}" &
SERVER_PID=$!
echo "   服务器 PID: ${SERVER_PID}"

# ──────────────── 步骤6: 等待启动 + 健康检查 ────────────────
step 6 "等待 ${STARTUP_WAIT}s 后执行健康检查"
sleep "${STARTUP_WAIT}"

echo "   请求 ${HEALTH_URL} ..."
HEALTH_RESPONSE=$(curl -sf "${HEALTH_URL}" 2>&1) || {
  fail "健康检查" "curl 请求失败，服务器可能未正常启动。响应: ${HEALTH_RESPONSE}"
}

# 验证返回的 code === 0
HEALTH_CODE=$(echo "${HEALTH_RESPONSE}" | grep -oP '"code"\s*:\s*\K\d+' || echo "null")
if [ "${HEALTH_CODE}" != "0" ]; then
  fail "健康检查" "API 返回 code=${HEALTH_CODE}，期望 code=0。响应: ${HEALTH_RESPONSE}"
fi

# 验证 db.connected === true
DB_CONNECTED=$(echo "${HEALTH_RESPONSE}" | grep -oP '"connected"\s*:\s*\K(true|false)' || echo "null")
if [ "${DB_CONNECTED}" != "true" ]; then
  fail "健康检查" "数据库未连接 (connected=${DB_CONNECTED})。响应: ${HEALTH_RESPONSE}"
fi

echo "   健康检查响应:"
echo "   ${HEALTH_RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "   ${HEALTH_RESPONSE}"
echo "✅ 健康检查通过"

# ──────────────── 步骤7: 清理 ────────────────
step 7 "清理后台进程"
cleanup
echo "✅ 后台进程已终止"

# ──────────────── 完成 ────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 启动自检通过"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "   所有 7 个步骤均通过:"
echo "   1. bun install --frozen-lockfile ✅"
echo "   2. prisma generate ✅"
echo "   3. prisma db push ✅"
echo "   4. next build ✅"
echo "   5. next start ✅"
echo "   6. /api/health ✅"
echo "   7. 清理 ✅"
echo ""
exit 0
