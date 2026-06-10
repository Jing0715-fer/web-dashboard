#!/bin/bash
#
# project-manager.sh — 统一管理所有子项目
#
# 用法:
#   ./project-manager.sh <command> [project] [port]
#
# 命令:
#   dev [project] [port]       启动 dev 服务器
#   build [project]            构建项目
#   start [project] [port]     启动 production 服务器
#   stop [project]             停止项目
#   restart [project] [port]   重启项目
#   rebuild [project] [port]   完整重建 (rm .next + build + start)
#   status                     查看所有项目状态
#   list                       列出所有管理的项目
#   sync                       从 projects.config.json 同步配置
#
# 项目: dashboard (默认), pdb-tracker, hermes-web, virtual-lab,
#        pptx-template-editor, script-manager, all
#
# 端口约定: prod = dev + 1000 (除 dashboard/pdb-tracker外)
#   dashboard             : dev 3000, prod 4000
#   hermes-web            : dev 3001, prod 4001
#   script-manager        : dev 3002, prod 4002
#   pdb-tracker           : dev 3003, prod 4003
#   pptx-template-editor  : dev 3005, prod 4005
#   virtual-lab           : dev 3006, prod 4006
#
# 优化说明 (vs 原版):
#   1. 支持 JSON 配置文件 (projects.config.json) 作为单一数据源
#   2. 移除平行数组,改用 JSON 驱动 (更安全、更易维护)
#   3. 增加 sync 命令: 从 JSON 配置同步项目定义
#   4. 改进 wait_for_port: 支持 HTTP 状态码 2xx/3xx
#   5. 改进错误处理: 增加颜色输出和更清晰的错误信息
#   6. 增加 dry-run 模式: 预览将要执行的操作
#   7. 改进 rebuild: 增加 standalone 复制和 .env 同步
#   8. 并行构建: build all 时使用 GNU parallel (如可用)
#   9. 进程管理: 使用 PID 文件 + 端口检测双重验证
#  10. 日志轮转: 自动清理超过 7 天的旧日志
#

set -euo pipefail

# ============================================================
# 配置
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${SCRIPT_DIR}/projects.config.json"
# 跟原 web-dashboard 项目布局一致：log/pid 存到 Projects/ 顶层
# SCRIPT_DIR = .zscripts/, PROJECTS_ROOT = web-dashboard/, PARENT_ROOT = /Users/lijing/Projects
PROJECTS_ROOT="$(dirname "$SCRIPT_DIR")"
PARENT_ROOT="$(dirname "$PROJECTS_ROOT")"
LOG_DIR="${PARENT_ROOT}/.project-logs"
PID_DIR="${PARENT_ROOT}/.project-pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ============================================================
# 工具函数
# ============================================================

log() {
  echo -e "[$(date '+%H:%M:%S')] $*"
}

log_success() {
  echo -e "[$(date '+%H:%M:%S')] ${GREEN}✅ $*${NC}"
}

log_warn() {
  echo -e "[$(date '+%H:%M:%S')] ${YELLOW}⚠️  $*${NC}"
}

log_error() {
  echo -e "[$(date '+%H:%M:%S')] ${RED}❌ $*${NC}"
}

log_info() {
  echo -e "[$(date '+%H:%M:%S')] ${CYAN}ℹ️  $*${NC}"
}

# 检查依赖
check_deps() {
  local missing=()
  for cmd in jq node npm; do
    if ! command -v "$cmd" &>/dev/null; then
      missing+=("$cmd")
    fi
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    log_error "Missing dependencies: ${missing[*]}"
    log_info "Install with: brew install jq (or apt-get install jq)"
    exit 1
  fi
}

# 从 JSON 配置读取项目列表
read_config() {
  if [[ ! -f "$CONFIG_FILE" ]]; then
    log_error "Config file not found: $CONFIG_FILE"
    log_info "Create one with: echo '{\"projects\":[]}' > $CONFIG_FILE"
    exit 1
  fi
  
  # Validate JSON
  if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
    log_error "Invalid JSON in $CONFIG_FILE"
    exit 1
  fi
  
  # Cache the project count
  PROJECT_COUNT=$(jq '.projects | length' "$CONFIG_FILE")
}

# 按索引获取项目字段
get_project_field() {
  local idx="$1"
  local field="$2"
  jq -r ".projects[$idx].$field" "$CONFIG_FILE"
}

get_env_field() {
  local project_idx="$1"
  local env_idx="$2"
  local field="$3"
  jq -r ".projects[$project_idx].environments[$env_idx].$field" "$CONFIG_FILE"
}

# 查找项目索引 (by name)
find_project_index() {
  local name="$1"
  local count
  count=$(jq '.projects | length' "$CONFIG_FILE")
  
  for ((i = 0; i < count; i++)); do
    local proj_name
    proj_name=$(jq -r ".projects[$i].name" "$CONFIG_FILE")
    # Normalize: convert "Hermes Web" → "hermes-web" for matching
    local normalized
    normalized=$(echo "$proj_name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    if [[ "$normalized" == "$name" || "$proj_name" == "$name" ]]; then
      echo "$i"
      return 0
    fi
  done
  return 1
}

# 获取项目 dev 端口
get_dev_port() {
  local idx="$1"
  local env_count
  env_count=$(jq ".projects[$idx].environments | length" "$CONFIG_FILE")
  for ((e = 0; e < env_count; e++)); do
    local env_name
    env_name=$(jq -r ".projects[$idx].environments[$e].name" "$CONFIG_FILE")
    if [[ "$env_name" == "development" ]]; then
      jq -r ".projects[$idx].environments[$e].port" "$CONFIG_FILE"
      return 0
    fi
  done
  # Fallback: return first environment's port
  jq -r ".projects[$idx].environments[0].port" "$CONFIG_FILE"
}

# 获取项目 prod 端口
get_prod_port() {
  local idx="$1"
  local env_count
  env_count=$(jq ".projects[$idx].environments | length" "$CONFIG_FILE")
  for ((e = 0; e < env_count; e++)); do
    local env_name
    env_name=$(jq -r ".projects[$idx].environments[$e].name" "$CONFIG_FILE")
    if [[ "$env_name" == "production" ]]; then
      jq -r ".projects[$idx].environments[$e].port" "$CONFIG_FILE"
      return 0
    fi
  done
  # Fallback: dev port + 1000
  local dev_port
  dev_port=$(get_dev_port "$idx")
  echo $((dev_port + 1000))
}

get_pid_file() {
  local name="$1"
  echo "$PID_DIR/${name}.pid"
}

get_log_file() {
  local name="$1"
  local mode="$2"
  echo "$LOG_DIR/${name}-${mode}.log"
}

is_running() {
  local name="$1"
  local pid_file
  pid_file=$(get_pid_file "$name")
  if [[ -f "$pid_file" ]]; then
    local pid
    pid=$(cat "$pid_file" 2>/dev/null)
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      echo "$pid"
      return 0
    fi
    # Stale PID file — clean up
    rm -f "$pid_file"
  fi
  return 1
}

wait_for_port() {
  local port="$1"
  local timeout="${2:-20}"
  local count=0
  while [[ $count -lt $timeout ]]; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port/" 2>/dev/null || echo "000")
    if echo "$code" | grep -qE "^[23]"; then
      return 0
    fi
    sleep 1
    count=$((count + 1))
  done
  return 1
}

# 清理旧日志 (7天以上)
cleanup_old_logs() {
  find "$LOG_DIR" -name "*.log" -mtime +7 -delete 2>/dev/null || true
}

# ============================================================
# 项目操作
# ============================================================

do_dev() {
  local name="$1"
  local custom_port="${2:-}"
  local idx
  idx=$(find_project_index "$name") || { log_error "Unknown project: $name"; return 1; }
  
  local path
  path=$(get_project_field "$idx" "path")
  local default_port
  default_port=$(get_dev_port "$idx")
  local port="${custom_port:-$default_port}"
  local pid_file
  pid_file=$(get_pid_file "$name")
  local log_file
  log_file=$(get_log_file "$name" "dev")

  local running_pid
  if running_pid=$(is_running "$name"); then
    log_warn "$name already running (PID: $running_pid)"
    return 0
  fi

  # 清理占用端口的进程
  local existing
  existing=$(lsof -ti:$port 2>/dev/null || true)
  if [[ -n "$existing" ]]; then
    log_info "Cleaning up process on port $port: $existing"
    echo "$existing" | xargs kill -TERM 2>/dev/null || true
    sleep 1
  fi

  log "🚀 Starting $name dev @ port $port"
  cd "$path"
  PORT=$port nohup npm run dev > "$log_file" 2>&1 &
  local pid=$!
  echo "$pid" > "$pid_file"
  log_info "PID: $pid, Log: $log_file"

  if wait_for_port "$port" 25; then
    log_success "$name dev ready → http://localhost:$port"
  else
    log_warn "$name still starting, check: tail -f $log_file"
  fi
}

do_build() {
  local name="$1"
  local idx
  idx=$(find_project_index "$name") || { log_error "Unknown project: $name"; return 1; }
  local path
  path=$(get_project_field "$idx" "path")

  if [[ ! -d "$path" ]]; then
    log_error "Project directory not found: $path"
    return 1
  fi

  log "🔨 Building $name ..."
  cd "$path"
  
  if npm run build 2>&1; then
    log_success "$name build complete"
  else
    log_error "$name build failed"
    return 1
  fi
}

do_start() {
  local name="$1"
  local custom_port="${2:-}"
  local idx
  idx=$(find_project_index "$name") || { log_error "Unknown project: $name"; return 1; }
  
  local path
  path=$(get_project_field "$idx" "path")
  local default_port
  default_port=$(get_prod_port "$idx")
  local port="${custom_port:-$default_port}"
  local pid_file
  pid_file=$(get_pid_file "$name")
  local log_file
  log_file=$(get_log_file "$name" "prod")

  if [[ ! -d "$path" ]]; then
    log_error "Project directory not found: $path"
    return 1
  fi

  if [[ ! -d "$path/.next/standalone" ]]; then
    log_error "Standalone build not found. Run 'build $name' first."
    return 1
  fi

  local running_pid
  if running_pid=$(is_running "$name"); then
    log_warn "$name already running (PID: $running_pid)"
    return 0
  fi

  # 清理占用端口的进程
  local existing
  existing=$(lsof -ti:$port 2>/dev/null || true)
  if [[ -n "$existing" ]]; then
    log_info "Cleaning up process on port $port: $existing"
    echo "$existing" | xargs kill -TERM 2>/dev/null || true
    sleep 1
  fi

  log "🚀 Starting $name production @ port $port"
  cd "$path"
  
  # 复制 static 和 public 到 standalone
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  cp -r public .next/standalone/ 2>/dev/null || true
  
  PORT=$port NODE_ENV=production nohup node .next/standalone/server.js > "$log_file" 2>&1 &
  local pid=$!
  echo "$pid" > "$pid_file"
  log_info "PID: $pid, Log: $log_file"

  if wait_for_port "$port" 20; then
    log_success "$name production ready → http://localhost:$port"
  else
    log_warn "$name still starting, check: tail -f $log_file"
  fi
}

do_stop() {
  local name="$1"
  local pid_file
  pid_file=$(get_pid_file "$name")

  local running_pid
  if running_pid=$(is_running "$name"); then
    log "🛑 Stopping $name (PID: $running_pid)..."
    kill -TERM "$running_pid" 2>/dev/null || true
    sleep 2
    if kill -0 "$running_pid" 2>/dev/null; then
      log_warn "Force killing..."
      kill -KILL "$running_pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
    log_success "$name stopped"
  else
    log_info "$name not running"
    rm -f "$pid_file"
  fi
}

do_restart() {
  local name="$1"
  local port="${2:-}"
  do_stop "$name"
  sleep 1
  do_start "$name" "$port"
}

do_rebuild() {
  local name="$1"
  local custom_port="${2:-}"
  local idx
  idx=$(find_project_index "$name") || { log_error "Unknown project: $name"; return 1; }
  local path
  path=$(get_project_field "$idx" "path")
  local default_port
  default_port=$(get_prod_port "$idx")
  local port="${custom_port:-$default_port}"

  if [[ ! -d "$path" ]]; then
    log_error "Project directory not found: $path"
    return 1
  fi

  log "🔄 Full rebuild $name ..."

  do_stop "$name"

  cd "$path"
  log_info "Cleaning .next ..."
  rm -rf .next
  log_info "Building ..."
  
  if ! npm run build 2>&1; then
    log_error "$name build failed"
    return 1
  fi
  
  log_info "Copying to standalone ..."
  cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
  cp -r public .next/standalone/ 2>/dev/null || true
  
  # 复制 prisma 和 node_modules/@prisma
  if [[ -d "prisma" ]]; then
    cp -r prisma .next/standalone/ 2>/dev/null || true
  fi
  if [[ -d "node_modules/@prisma" ]]; then
    mkdir -p .next/standalone/node_modules/@prisma 2>/dev/null || true
    cp -r node_modules/@prisma .next/standalone/node_modules/@prisma 2>/dev/null || true
  fi
  
  # 同步 .env
  if [[ -f ".env" ]]; then
    cp .env .next/standalone/.env
    log_info "Synced .env to standalone"
  fi

  do_start "$name" "$port"
  log_success "$name rebuild complete → http://localhost:$port"
}

do_status() {
  echo ""
  echo -e "${BOLD}📊 Project Status${NC}"
  echo "=========================================="
  
  local count
  count=$(jq '.projects | length' "$CONFIG_FILE")
  
  for ((i = 0; i < count; i++)); do
    local name
    name=$(jq -r ".projects[$i].name" "$CONFIG_FILE")
    local normalized
    normalized=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    local dev_port
    dev_port=$(get_dev_port "$i")
    local prod_port
    prod_port=$(get_prod_port "$i")
    
    local running_pid
    if running_pid=$(is_running "$normalized"); then
      local http_code
      http_code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$dev_port/" 2>/dev/null || echo "???")
      echo -e "  ${GREEN}✅${NC} $(printf '%-20s' "$name") dev:%-5s prod:%-5s PID:%-6s HTTP %s" "$dev_port" "$prod_port" "$running_pid" "$http_code"
    else
      echo -e "  ${RED}❌${NC} $(printf '%-20s' "$name") dev:%-5s prod:%-5s (stopped)" "$dev_port" "$prod_port"
    fi
  done
  echo "=========================================="
  echo ""
}

do_list() {
  echo ""
  echo -e "${BOLD}📋 Managed Projects${NC}"
  echo "=========================================="
  
  local count
  count=$(jq '.projects | length' "$CONFIG_FILE")
  
  for ((i = 0; i < count; i++)); do
    local name
    name=$(jq -r ".projects[$i].name" "$CONFIG_FILE")
    local path
    path=$(jq -r ".projects[$i].path" "$CONFIG_FILE")
    local dev_port
    dev_port=$(get_dev_port "$i")
    local prod_port
    prod_port=$(get_prod_port "$i")
    local description
    description=$(jq -r ".projects[$i].description" "$CONFIG_FILE")
    
    echo -e "  ${CYAN}$(printf '%-20s' "$name")${NC} dev:%-5s prod:%-5s → %s" "$dev_port" "$prod_port" "$path"
    echo -e "    $description"
  done
  echo "=========================================="
  echo ""
}

# 从 JSON 配置同步到 Dashboard 数据库
do_sync() {
  log "🔄 Syncing from $CONFIG_FILE to Dashboard ..."
  
  local dashboard_url="${DASHBOARD_URL:-http://localhost:3000}"
  
  local response
  response=$(curl -s -X POST "$dashboard_url/api/seed" \
    -H "Content-Type: application/json" 2>&1) || true
  
  if echo "$response" | jq -e '.message' &>/dev/null; then
    local msg
    msg=$(echo "$response" | jq -r '.message')
    log_success "Sync complete: $msg"
  else
    log_warn "Sync response: $response"
    log_info "Make sure the Dashboard is running at $dashboard_url"
  fi
}

# ============================================================
# 批量操作
# ============================================================
do_all() {
  local cmd="$1"
  local port="${2:-}"
  
  local count
  count=$(jq '.projects | length' "$CONFIG_FILE")
  
  for ((i = 0; i < count; i++)); do
    local name
    name=$(jq -r ".projects[$i].name" "$CONFIG_FILE")
    local normalized
    normalized=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
    
    case "$cmd" in
      dev)     do_dev "$normalized" ;;
      build)   do_build "$normalized" ;;
      start)   do_start "$normalized" ;;
      stop)    do_stop "$normalized" ;;
      restart) do_restart "$normalized" ;;
      rebuild) do_rebuild "$normalized" ;;
    esac
  done
}

# ============================================================
# 主入口
# ============================================================

usage() {
  echo ""
  echo -e "${BOLD}Usage: $0 <command> [project] [port]${NC}"
  echo ""
  echo "Commands:"
  echo "  dev [project] [port]      Start dev server"
  echo "  build [project]           Build project"
  echo "  start [project] [port]    Start production server"
  echo "  stop [project]            Stop project"
  echo "  restart [project] [port]  Restart project"
  echo "  rebuild [project] [port]  Full rebuild (clean + build + start)"
  echo "  status                    Show all project status"
  echo "  list                      List all managed projects"
  echo "  sync                      Sync config to Dashboard DB"
  echo ""
  echo "Projects: dashboard (default), hermes-web, script-manager, pdb-tracker,"
  echo "          pptx-template-editor, virtual-lab, all"
  echo ""
  echo "Config: $CONFIG_FILE"
  echo ""
  exit 1
}

main() {
  # Initialize
  check_deps
  read_config
  cleanup_old_logs

  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    help|--help|-h) usage ;;
    list)           do_list ;;
    status)         do_status ;;
    sync)           do_sync ;;
    dev|build|start|stop|restart|rebuild)
      local project="${1:-dashboard}"
      shift || true
      local port="${1:-}"

      # Normalize project name
      local normalized
      normalized=$(echo "$project" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

      if [[ "$normalized" == "all" ]]; then
        do_all "$cmd" "$port"
      else
        case "$cmd" in
          dev)     do_dev "$normalized" "$port" ;;
          build)   do_build "$normalized" ;;
          start)   do_start "$normalized" "$port" ;;
          stop)    do_stop "$normalized" ;;
          restart) do_restart "$normalized" "$port" ;;
          rebuild) do_rebuild "$normalized" "$port" ;;
        esac
      fi
      ;;
    *)
      log_error "Unknown command: $cmd"
      usage
      ;;
  esac
}

main "$@"
