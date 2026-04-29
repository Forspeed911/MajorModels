#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

LOG_PREFIX="[bootstrap]"

REPO_URL="${REPO_URL:-https://github.com/Forspeed911/MajorModels.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
PROJECT_DIR="${PROJECT_DIR:-/opt/majormodels}"
ENV_FILE_PATH="${ENV_FILE_PATH:-.env.production}"
ENV_FILE_URL="${ENV_FILE_URL:-}"
INSTALL_NODE="${INSTALL_NODE:-1}"
INSTALL_POSTGRESQL="${INSTALL_POSTGRESQL:-1}"
SKIP_DEPLOY="${SKIP_DEPLOY:-0}"
ALLOW_PLACEHOLDER_ENV="${ALLOW_PLACEHOLDER_ENV:-0}"

APT_UPDATED=0
PKG_MANAGER=""

log() {
  printf '%s %s\n' "$LOG_PREFIX" "$*"
}

warn() {
  printf '%s WARNING: %s\n' "$LOG_PREFIX" "$*" >&2
}

fail() {
  printf '%s ERROR: %s\n' "$LOG_PREFIX" "$*" >&2
  exit 1
}

if [[ "$(uname -s)" != "Linux" ]]; then
  fail "This bootstrap script supports Linux only."
fi

if [[ "$(id -u)" -eq 0 ]]; then
  SUDO_CMD=()
else
  if ! command -v sudo >/dev/null 2>&1; then
    fail "sudo is required when running as non-root user."
  fi
  SUDO_CMD=(sudo)
fi

run_root() {
  "${SUDO_CMD[@]}" "$@"
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then
    PKG_MANAGER="apt"
    return
  fi

  if command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
    return
  fi

  if command -v yum >/dev/null 2>&1; then
    PKG_MANAGER="yum"
    return
  fi

  fail "Unsupported Linux distribution: apt, dnf, or yum is required."
}

update_pkg_index_if_needed() {
  if [[ "$PKG_MANAGER" == "apt" ]] && [[ "$APT_UPDATED" -eq 0 ]]; then
    log "Updating apt package index"
    run_root apt-get update -y
    APT_UPDATED=1
  fi
}

install_packages() {
  update_pkg_index_if_needed

  if [[ "$PKG_MANAGER" == "apt" ]]; then
    run_root env DEBIAN_FRONTEND=noninteractive apt-get install -y "$@"
    return
  fi

  if [[ "$PKG_MANAGER" == "dnf" ]]; then
    run_root dnf install -y "$@"
    return
  fi

  run_root yum install -y "$@"
}

ensure_base_tools() {
  local need_install=0

  if ! command -v curl >/dev/null 2>&1; then
    need_install=1
  fi

  if ! command -v git >/dev/null 2>&1; then
    need_install=1
  fi

  if [[ "$need_install" -eq 0 ]]; then
    log "Base tools already installed (curl, git)"
    return
  fi

  log "Installing base tools (curl, git, certificates)"
  if [[ "$PKG_MANAGER" == "apt" ]]; then
    install_packages ca-certificates curl git
    return
  fi

  install_packages ca-certificates curl git
}

ensure_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker is already installed"
  else
    log "Installing Docker Engine"
    local docker_install_script
    docker_install_script="$(mktemp)"
    curl -fsSL https://get.docker.com -o "$docker_install_script"
    run_root sh "$docker_install_script"
    rm -f "$docker_install_script"
  fi

  if command -v systemctl >/dev/null 2>&1; then
    run_root systemctl enable --now docker || warn "Unable to enable/start docker service via systemctl"
  fi

  if docker compose version >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1; then
    log "Docker Compose is already available"
  else
    log "Installing Docker Compose"
    if [[ "$PKG_MANAGER" == "apt" ]]; then
      install_packages docker-compose-plugin || install_packages docker-compose
    elif [[ "$PKG_MANAGER" == "dnf" ]]; then
      install_packages docker-compose-plugin || install_packages docker-compose
    else
      install_packages docker-compose-plugin || install_packages docker-compose
    fi
  fi

  if [[ ${#SUDO_CMD[@]} -gt 0 ]]; then
    if ! groups "$USER" | grep -q '\bdocker\b'; then
      run_root usermod -aG docker "$USER" || warn "Unable to add $USER to docker group"
      warn "User added to docker group. You may need to re-login for group changes to apply."
    fi
  fi
}

ensure_node() {
  if [[ "$INSTALL_NODE" != "1" ]]; then
    log "Skipping Node.js installation (INSTALL_NODE=$INSTALL_NODE)"
    return
  fi

  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    log "Node.js and npm are already installed"
    return
  fi

  log "Installing Node.js and npm"
  if [[ "$PKG_MANAGER" == "apt" ]]; then
    install_packages nodejs npm
  else
    install_packages nodejs npm
  fi
}

ensure_postgresql() {
  if [[ "$INSTALL_POSTGRESQL" != "1" ]]; then
    log "Skipping PostgreSQL installation (INSTALL_POSTGRESQL=$INSTALL_POSTGRESQL)"
    return
  fi

  if command -v psql >/dev/null 2>&1; then
    log "PostgreSQL client is already installed"
    return
  fi

  log "Installing PostgreSQL"
  if [[ "$PKG_MANAGER" == "apt" ]]; then
    install_packages postgresql postgresql-client
  else
    install_packages postgresql-server postgresql

    if command -v postgresql-setup >/dev/null 2>&1; then
      run_root postgresql-setup --initdb || warn "PostgreSQL initdb step failed or already initialized"
    fi
  fi

  if command -v systemctl >/dev/null 2>&1; then
    run_root systemctl enable --now postgresql || warn "Unable to enable/start postgresql service via systemctl"
  fi
}

sync_repository() {
  log "Syncing repository in $PROJECT_DIR"

  run_root mkdir -p "$(dirname "$PROJECT_DIR")"

  if [[ ! -d "$PROJECT_DIR" ]]; then
    run_root mkdir -p "$PROJECT_DIR"
  fi

  if [[ ${#SUDO_CMD[@]} -gt 0 ]]; then
    run_root chown -R "$USER":"$(id -gn)" "$PROJECT_DIR"
  fi

  if [[ -d "$PROJECT_DIR/.git" ]]; then
    git -C "$PROJECT_DIR" fetch origin
    git -C "$PROJECT_DIR" checkout "$REPO_BRANCH"
    git -C "$PROJECT_DIR" pull --ff-only origin "$REPO_BRANCH"
    return
  fi

  if [[ -n "$(ls -A "$PROJECT_DIR" 2>/dev/null)" ]]; then
    fail "Directory $PROJECT_DIR is not empty and is not a git repository."
  fi

  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$PROJECT_DIR"
}

prepare_env_file() {
  local env_target="$PROJECT_DIR/$ENV_FILE_PATH"

  if [[ -n "$ENV_FILE_URL" ]]; then
    log "Downloading environment file from ENV_FILE_URL"
    curl -fsSL "$ENV_FILE_URL" -o "$env_target"
  fi

  if [[ ! -f "$env_target" ]]; then
    if [[ -f "$PROJECT_DIR/.env.production.example" ]]; then
      log "Creating $ENV_FILE_PATH from .env.production.example"
      cp "$PROJECT_DIR/.env.production.example" "$env_target"
    else
      fail "Environment file $env_target is missing and .env.production.example not found."
    fi
  fi

  if [[ "$ALLOW_PLACEHOLDER_ENV" != "1" ]]; then
    if grep -Eq 'replace_me|change_me_strong_password' "$env_target"; then
      fail "Environment file contains placeholder values. Set real secrets or use ALLOW_PLACEHOLDER_ENV=1 for test setup."
    fi
  fi
}

run_compose() {
  if docker compose version >/dev/null 2>&1; then
    run_root docker compose "$@"
    return
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    run_root docker-compose "$@"
    return
  fi

  fail "Docker Compose is not available."
}

deploy_stack() {
  if [[ "$SKIP_DEPLOY" == "1" ]]; then
    log "Skipping deploy step (SKIP_DEPLOY=1)"
    return
  fi

  local env_target="$PROJECT_DIR/$ENV_FILE_PATH"

  log "Deploying stack with Docker Compose"
  run_root mkdir -p "$PROJECT_DIR"
  cd "$PROJECT_DIR"

  run_compose -f docker-compose.prod.yml --env-file "$env_target" up -d --build

  log "Deployment command completed"
  log "Check status: docker compose -f docker-compose.prod.yml --env-file $env_target ps"
}

main() {
  detect_pkg_manager
  log "Detected package manager: $PKG_MANAGER"

  ensure_base_tools
  ensure_docker
  ensure_node
  ensure_postgresql
  sync_repository
  prepare_env_file
  deploy_stack

  log "Bootstrap finished successfully"
}

main "$@"
