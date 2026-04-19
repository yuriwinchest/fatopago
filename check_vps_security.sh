#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------
# COMO USAR
#   chmod +x check_vps_security.sh
#   sudo ./check_vps_security.sh | tee vps_security_report.txt
#
# NOTAS
# - 100% READ-ONLY: este script NAO altera configuracoes, NAO instala pacotes,
#   NAO reinicia servicos e NAO faz mudancas no sistema.
# - Melhor rodar com sudo para coletar mais informacoes (docker/ss/journalctl).
# - Se algum comando nao existir, o script imprime WARN e continua.
# ------------------------------------------------------------

NOW_UTC="$(date -u +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "unknown")"
HOSTNAME_SHORT="$(hostname 2>/dev/null || echo "unknown")"
KERNEL_REL="$(uname -r 2>/dev/null || echo "unknown")"
UPTIME_HUMAN="$(uptime -p 2>/dev/null || uptime 2>/dev/null || echo "unknown")"
DISTRO_PRETTY="$(
  if [ -f /etc/os-release ]; then
    grep -E '^PRETTY_NAME=' /etc/os-release 2>/dev/null | head -n 1 | cut -d= -f2- | tr -d '"' || true
  else
    echo "unknown"
  fi
)"

# Colors (disable if not a TTY or if NO_COLOR is set)
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  GREEN="\033[32m"
  YELLOW="\033[33m"
  RED="\033[31m"
  CYAN="\033[36m"
  NC="\033[0m"
else
  GREEN=""
  YELLOW=""
  RED=""
  CYAN=""
  NC=""
fi

hr() { echo -e "${CYAN}------------------------------------------------------------${NC}"; }
title() { hr; echo -e "${CYAN}$1${NC}"; hr; }
ok() { echo -e "${GREEN}OK${NC}   - $1"; }
warn() { echo -e "${YELLOW}WARN${NC} - $1"; }
risk() { echo -e "${RED}RISK${NC} - $1"; }

cmd_exists() { command -v "$1" >/dev/null 2>&1; }

WARNS=()
RISKS=()

add_warn() { WARNS+=("$1"); }
add_risk() { RISKS+=("$1"); }

need_cmd() {
  local c="$1"
  if ! cmd_exists "$c"; then
    warn "Comando ausente: $c (alguns checks serao pulados)"
    add_warn "Comando ausente: $c"
    return 1
  fi
  return 0
}

safe_run() {
  # Runs a command without aborting the script even if it fails.
  # Usage: safe_run cmd arg...
  set +e
  "$@"
  local rc=$?
  set -e
  return $rc
}

capture() {
  # Captures stdout+stderr of a command, returns its exit code.
  # Usage: out="$(capture cmd arg...)" ; rc=$?
  set +e
  local out
  out="$("$@" 2>&1)"
  local rc=$?
  set -e
  printf '%s' "$out"
  return $rc
}

print_cmd() {
  # Print a header then run a command safely.
  # Usage: print_cmd "label" cmd arg...
  local label="$1"
  shift
  echo "[${label}]"
  safe_run "$@" || true
}

bullet_list() {
  # Print each line as a bullet (simple).
  # Usage: bullet_list < <(printf '%s\n' ...)
  while IFS= read -r line; do
    [ -z "${line:-}" ] && continue
    echo " - $line"
  done
}

title "VPS SECURITY REPORT"
echo "Time (UTC): $NOW_UTC"
echo "Host:      $HOSTNAME_SHORT"
echo "Kernel:    $KERNEL_REL"
echo "Uptime:    $UPTIME_HUMAN"
echo "Distro:    ${DISTRO_PRETTY:-unknown}"
echo

title "1) IDENTIFICACAO"
ok "Relatorio gerado (read-only)."
echo "Time (UTC): $NOW_UTC"
echo "Hostname:   $HOSTNAME_SHORT"
echo "Kernel:     $KERNEL_REL"
echo "Uptime:     $UPTIME_HUMAN"
echo "Distro:     ${DISTRO_PRETTY:-unknown}"
echo

title "2) REDE / PORTAS"

SS_RAW=""
if need_cmd ss; then
  print_cmd "ss -lntup (listening TCP/UDP)" ss -lntup
  echo

  SS_RAW="$(capture ss -H -lntup || true)"

  # Public listeners heuristic: non-loopback bind + port not in 22/80/443
  PUBLIC_EXTRA=""
  if cmd_exists awk; then
    PUBLIC_EXTRA="$(
      printf '%s\n' "$SS_RAW" | awk '
        BEGIN{IGNORECASE=1}
        {
          local=$5
          port=""
          if (match(local, /:([0-9]+)$/, a)) port=a[1]
          addr=local
          sub(/:[0-9]+$/, "", addr)

          # Normalize addr for comparisons
          is_loopback = (addr ~ /^\[?::1\]?$/) || (addr ~ /^127\./) || (addr ~ /%lo$/)
          is_any = (addr == "*" || addr == "0.0.0.0" || addr == "[::]" || addr == "::")

          # "Public-ish" if it is any-address or not loopback
          if ((is_any || !is_loopback) && port != "" && port !~ /^(22|80|443)$/) {
            print $0
          }
        }
      ' || true
    )"
  else
    warn "awk ausente; pulando heuristica de portas publicas extras via ss."
    add_warn "awk ausente; pulou heuristica de portas publicas extras via ss"
  fi

  if [ -n "${PUBLIC_EXTRA:-}" ]; then
    risk "Foram detectadas portas potencialmente publicas alem de 22/80/443 (heuristica pelo bind)."
    add_risk "Portas potencialmente publicas alem de 22/80/443 detectadas (ver secao 2)."
    echo
    echo "[Public listeners (heuristica) - linhas do ss]"
    printf '%s\n' "$PUBLIC_EXTRA"
  else
    ok "Nenhuma porta extra (alem 22/80/443) detectada como potencialmente publica (heuristica)."
  fi

  echo
  if cmd_exists awk; then
    DOCKER_API_EXPOSED="$(
      printf '%s\n' "$SS_RAW" | awk '
        {
          local=$5
          port=""
          if (match(local, /:([0-9]+)$/, a)) port=a[1]
          addr=local
          sub(/:[0-9]+$/, "", addr)
          is_loopback = (addr ~ /^\[?::1\]?$/) || (addr ~ /^127\./) || (addr ~ /%lo$/)
          is_any = (addr == "*" || addr == "0.0.0.0" || addr == "[::]" || addr == "::")
          if ((port == "2375" || port == "2376") && (is_any || !is_loopback)) print $0
        }
      ' || true
    )"
    if [ -n "${DOCKER_API_EXPOSED:-}" ]; then
      risk "Docker API aparenta estar exposto em TCP (2375/2376)."
      add_risk "Docker API exposto em TCP (2375/2376)."
      echo "[ss lines]"
      printf '%s\n' "$DOCKER_API_EXPOSED"
    else
      ok "Nao foi detectado Docker API exposto em TCP (2375/2376) via ss (heuristica)."
    fi
  else
    warn "awk ausente; nao foi possivel checar Docker API exposto (2375/2376) via ss."
    add_warn "awk ausente; pulou check de Docker API (2375/2376) via ss"
  fi
else
  warn "ss nao disponivel; pulando analise de listening ports."
  add_warn "ss nao disponivel; pulou analise de listening ports."
fi

echo
title "2.1) DOCKER: Portas publicadas por containers"

if need_cmd docker; then
  DOCKER_PS_TABLE="$(capture docker ps --format "table {{.Names}}\t{{.Ports}}" || true)"
  if [ -n "${DOCKER_PS_TABLE:-}" ]; then
    echo "$DOCKER_PS_TABLE"
  else
    warn "Nao foi possivel executar 'docker ps' (sem permissao?) ou nao ha containers."
    add_warn "Falha ao executar docker ps (sem permissao?)"
  fi

  echo

  DOCKER_PS_LINES="$(capture docker ps --format "{{.Names}}\t{{.Ports}}" || true)"
  if [ -n "${DOCKER_PS_LINES:-}" ]; then
    PUBLISHED_PUBLIC=""
    if cmd_exists awk; then
      PUBLISHED_PUBLIC="$(
        printf '%s\n' "$DOCKER_PS_LINES" | awk -F'\t' '
          NF>=2 {
            name=$1; ports=$2
            if (ports ~ /(0\.0\.0\.0:|\[::\]:)/) print name "\t" ports
          }
        ' || true
      )"
    else
      warn "awk ausente; nao foi possivel filtrar containers com publish em 0.0.0.0/[::]."
      add_warn "awk ausente; pulou filtro de publish publico em docker ps"
    fi

    if [ -n "${PUBLISHED_PUBLIC:-}" ]; then
      echo "[Containers com portas publicadas em 0.0.0.0 ou [::]]"
      printf '%s\n' "$PUBLISHED_PUBLIC"
      echo

      # Heuristic severity: Traefik publishing 80/443 is expected; anything else is suspect.
      while IFS=$'\t' read -r cname cports; do
        [ -z "${cname:-}" ] && continue
        if [ "${cname}" = "traefik" ]; then
          if [[ "$cports" == *"0.0.0.0:80->"* || "$cports" == *"0.0.0.0:443->"* || "$cports" == *"[::]:80->"* || "$cports" == *"[::]:443->"* ]]; then
            ok "Traefik publica 80/443 (esperado)."
          fi
          if cmd_exists awk; then
            EXTRA_TRAEFIK="$(
              printf '%s\n' "$cports" | awk '
                {
                  s=$0
                  gsub(/,/, " ", s)
                  while (match(s, /(0\.0\.0\.0:|\[::\]:)([0-9]+)->/, a)) {
                    p=a[2]
                    if (p != "80" && p != "443") print p
                    s=substr(s, RSTART+RLENGTH)
                  }
                }
              ' || true
            )"
            if [ -n "${EXTRA_TRAEFIK:-}" ]; then
              warn "Traefik parece publicar portas adicionais alem de 80/443: ${EXTRA_TRAEFIK}"
              add_warn "Traefik publica portas adicionais alem de 80/443: ${EXTRA_TRAEFIK}"
            fi
          else
            warn "awk ausente; nao foi possivel verificar se Traefik publica portas alem de 80/443."
            add_warn "awk ausente; pulou check de portas extras do Traefik"
          fi
        else
          # Any other container with public published ports is a strong signal.
          risk "Container '$cname' publica portas publicamente: $cports"
          add_risk "Container '$cname' com portas publicas: $cports"
        fi
      done < <(printf '%s\n' "$PUBLISHED_PUBLIC")
    else
      ok "Nao foi detectado publish em 0.0.0.0/[::] por containers (alem do esperado)."
    fi
  else
    warn "Nao foi possivel coletar lista de portas publicadas (docker ps falhou?)."
    add_warn "docker ps falhou ao listar portas publicadas."
  fi
else
  warn "docker nao disponivel; pulando checks de portas publicadas."
  add_warn "docker nao disponivel; pulou checks de portas publicadas."
fi

echo
title "3) FIREWALL (firewalld)"

if need_cmd firewall-cmd; then
  if safe_run firewall-cmd --state >/dev/null 2>&1; then
    ok "firewalld esta rodando."
  else
    risk "firewalld instalado mas NAO esta rodando."
    add_risk "firewalld nao esta rodando."
  fi

  echo
  print_cmd "Active zones" firewall-cmd --get-active-zones
  echo
  print_cmd "firewall-cmd --list-all" firewall-cmd --list-all
  echo
  SERVICES="$(capture firewall-cmd --list-services 2>/dev/null || true)"
  PORTS="$(capture firewall-cmd --list-ports 2>/dev/null || true)"
  echo "[Services]"
  echo "${SERVICES:-}"
  echo "[Ports]"
  echo "${PORTS:-}"
  echo

  # Evaluate ports (explicit list-ports)
  if [ -n "${PORTS:-}" ]; then
    EXTRA_PORTS="$(printf '%s\n' "$PORTS" | tr ' ' '\n' | grep -E -v '^(22/tcp|80/tcp|443/tcp)$' || true)"
    if [ -n "${EXTRA_PORTS:-}" ]; then
      risk "Firewall lista portas abertas adicionais (alem de ssh/http/https)."
      add_risk "Firewall com portas extras abertas: ${EXTRA_PORTS}"
      echo "[Extra ports]"
      printf '%s\n' "$EXTRA_PORTS"
    else
      ok "Nenhuma porta extra listada explicitamente (list-ports) alem de 22/80/443."
    fi
  else
    warn "firewalld nao lista portas explicitamente (pode estar liberando via 'services')."
    add_warn "firewalld list-ports vazio (pode ser via services)."
  fi

  # Evaluate services
  if [ -n "${SERVICES:-}" ]; then
    EXTRA_SERVICES="$(printf '%s\n' "$SERVICES" | tr ' ' '\n' | grep -E -v '^(ssh|http|https)$' || true)"
    if [ -n "${EXTRA_SERVICES:-}" ]; then
      warn "Firewall possui services adicionais liberados (revisar necessidade)."
      add_warn "firewalld services extras: ${EXTRA_SERVICES}"
      echo "[Extra services]"
      printf '%s\n' "$EXTRA_SERVICES"
      if printf '%s\n' "$EXTRA_SERVICES" | grep -qi '^cockpit$'; then
        risk "Service 'cockpit' esta liberado (superficie de ataque maior)."
        add_risk "firewalld com cockpit liberado."
      fi
    else
      ok "Somente ssh/http/https aparecem em list-services."
    fi
  else
    warn "Nao foi possivel ler list-services (sem permissao?)"
    add_warn "Falha ao ler firewalld list-services."
  fi
else
  warn "firewall-cmd nao encontrado; pulando checks do firewalld."
  add_warn "firewall-cmd ausente; pulou checks do firewalld."
fi

echo
title "4) SSH HARDENING"

SSHD_FILES=()
if [ -f /etc/ssh/sshd_config ]; then
  SSHD_FILES+=("/etc/ssh/sshd_config")
fi
if [ -d /etc/ssh/sshd_config.d ]; then
  # shellcheck disable=SC2206
  SSHD_DROPS=(/etc/ssh/sshd_config.d/*.conf)
  if [ -e "${SSHD_DROPS[0]:-}" ]; then
    for f in "${SSHD_DROPS[@]}"; do
      [ -f "$f" ] && SSHD_FILES+=("$f")
    done
  fi
fi

if [ "${#SSHD_FILES[@]}" -eq 0 ]; then
  warn "Nao encontrei /etc/ssh/sshd_config nem drop-ins."
  add_warn "sshd_config nao encontrado."
else
  echo "[Arquivos considerados]"
  for f in "${SSHD_FILES[@]}"; do
    echo " - $f"
  done
  echo

  echo "[Linhas encontradas (best effort)]"
  for f in "${SSHD_FILES[@]}"; do
    if [ -f "$f" ]; then
      echo "----- $f -----"
      safe_run grep -nE '^[[:space:]]*(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|PermitEmptyPasswords|AllowUsers|AllowGroups)[[:space:]]+' "$f" || true
      echo
    fi
  done

  get_sshd_effective() {
    local key="$1"
    local val=""
    local f
    for f in "${SSHD_FILES[@]}"; do
      [ -f "$f" ] || continue
      local v
      v="$(awk -v k="$key" '
        BEGIN{IGNORECASE=1; v=""; in_match=0}
        /^[[:space:]]*#/ {next}
        /^[[:space:]]*$/ {next}
        /^[[:space:]]*Match[[:space:]]+/ {in_match=1; next}
        in_match {next}
        {
          if (tolower($1) == tolower(k) && NF >= 2) v=$2
        }
        END{print v}
      ' "$f" 2>/dev/null || true)"
      if [ -n "${v:-}" ]; then
        val="$v"
      fi
    done
    echo "$val"
  }

  PRL="$(get_sshd_effective "PermitRootLogin")"
  PA="$(get_sshd_effective "PasswordAuthentication")"
  PKA="$(get_sshd_effective "PubkeyAuthentication")"
  PEP="$(get_sshd_effective "PermitEmptyPasswords")"
  AU="$(get_sshd_effective "AllowUsers")"
  AG="$(get_sshd_effective "AllowGroups")"

  echo "[Valores efetivos (heuristica, ignora Match blocks)]"
  echo "PermitRootLogin:         ${PRL:-unset}"
  echo "PasswordAuthentication:  ${PA:-unset}"
  echo "PubkeyAuthentication:    ${PKA:-unset}"
  echo "PermitEmptyPasswords:    ${PEP:-unset}"
  echo "AllowUsers:              ${AU:-unset}"
  echo "AllowGroups:             ${AG:-unset}"
  echo

  # Risk rules
  if [ -n "${PRL:-}" ]; then
    if [ "$PRL" = "no" ]; then
      ok "PermitRootLogin=no"
    else
      risk "PermitRootLogin=$PRL (root login habilitado)"
      add_risk "SSH: PermitRootLogin=$PRL"
    fi
  else
    warn "PermitRootLogin nao definido explicitamente (verificar valor efetivo do sshd)."
    add_warn "SSH: PermitRootLogin unset"
  fi

  if [ -n "${PA:-}" ]; then
    if [ "$PA" = "no" ]; then
      ok "PasswordAuthentication=no"
    else
      risk "PasswordAuthentication=$PA (login por senha habilitado)"
      add_risk "SSH: PasswordAuthentication=$PA"
    fi
  else
    risk "PasswordAuthentication nao definido explicitamente (pode estar habilitado por padrao)."
    add_risk "SSH: PasswordAuthentication unset"
  fi

  if [ -n "${PEP:-}" ]; then
    if [ "$PEP" = "no" ]; then
      ok "PermitEmptyPasswords=no"
    else
      risk "PermitEmptyPasswords=$PEP"
      add_risk "SSH: PermitEmptyPasswords=$PEP"
    fi
  else
    warn "PermitEmptyPasswords nao definido explicitamente."
    add_warn "SSH: PermitEmptyPasswords unset"
  fi

  if [ -n "${PKA:-}" ]; then
    if [ "$PKA" = "yes" ]; then
      ok "PubkeyAuthentication=yes"
    else
      warn "PubkeyAuthentication=$PKA (recomendado: yes)"
      add_warn "SSH: PubkeyAuthentication=$PKA"
    fi
  else
    warn "PubkeyAuthentication nao definido explicitamente."
    add_warn "SSH: PubkeyAuthentication unset"
  fi

  if [ -n "${AU:-}" ] || [ -n "${AG:-}" ]; then
    ok "AllowUsers/AllowGroups configurado (restricao adicional presente)."
  else
    warn "AllowUsers/AllowGroups nao configurado (nao ha allowlist explicita)."
    add_warn "SSH: sem AllowUsers/AllowGroups"
  fi
fi

echo
if need_cmd systemctl; then
  if safe_run systemctl is-active sshd >/dev/null 2>&1; then
    ok "Servico sshd ativo."
  elif safe_run systemctl is-active ssh >/dev/null 2>&1; then
    ok "Servico ssh ativo."
  else
    warn "Nao foi possivel confirmar status do SSH via systemctl."
    add_warn "SSH: status do service nao confirmado"
  fi
else
  warn "systemctl ausente; nao foi possivel checar status do SSH."
  add_warn "systemctl ausente; pulou status do SSH"
fi

echo
title "5) FAIL2BAN"

if need_cmd systemctl; then
  if safe_run systemctl is-active fail2ban >/dev/null 2>&1; then
    ok "fail2ban ativo."
  else
    warn "fail2ban nao ativo (ou nao instalado)."
    add_warn "fail2ban nao ativo"
  fi
else
  warn "systemctl ausente; nao foi possivel checar fail2ban."
  add_warn "systemctl ausente; pulou fail2ban"
fi

if cmd_exists fail2ban-client; then
  echo
  print_cmd "fail2ban-client status" fail2ban-client status
else
  warn "fail2ban-client nao encontrado."
  add_warn "fail2ban-client ausente"
fi

echo
title "6) PATCHING (Debian/Ubuntu)"

if cmd_exists apt-get; then
  APT_SUMMARY="$(capture apt-get -s upgrade 2>/dev/null | grep -E '^[0-9]+ upgraded, [0-9]+ newly installed, [0-9]+ to remove and [0-9]+ not upgraded\\.' | tail -n 1 || true)"
  if [ -n "${APT_SUMMARY:-}" ]; then
    echo "$APT_SUMMARY"
  else
    warn "Nao foi possivel obter resumo do apt-get -s upgrade (sem permissao? apt ausente?)."
    add_warn "Falha ao obter resumo do apt-get -s upgrade"
  fi

  if cmd_exists unattended-upgrade; then
    ok "unattended-upgrades (comando unattended-upgrade) presente."
  else
    warn "unattended-upgrades nao detectado (comando unattended-upgrade ausente)."
    add_warn "unattended-upgrades nao detectado"
  fi
else
  warn "apt-get nao encontrado (nao parece Debian/Ubuntu)."
  add_warn "apt-get ausente"
fi

echo
title "7) DOCKER HARDENING"

if need_cmd docker; then
  echo "[Docker server version]"
  DOCKER_VER="$(capture docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
  if [ -n "${DOCKER_VER:-}" ]; then
    echo "$DOCKER_VER"
    ok "Docker acessivel (server version coletada)."
  else
    warn "Nao foi possivel coletar docker server version (sem permissao?)."
    add_warn "docker version (server) falhou"
  fi
  echo

  echo "[Membros do grupo docker (root-equivalente)]"
  if cmd_exists getent; then
    DOCKER_GROUP_LINE="$(capture getent group docker 2>/dev/null || true)"
    if [ -n "${DOCKER_GROUP_LINE:-}" ]; then
      echo "$DOCKER_GROUP_LINE"
      DOCKER_MEMBERS="$(printf '%s\n' "$DOCKER_GROUP_LINE" | awk -F: '{print $4}' || true)"
      MEMBER_COUNT=0
      if [ -n "${DOCKER_MEMBERS:-}" ]; then
        # Split by comma
        IFS=',' read -r -a _dm <<< "$DOCKER_MEMBERS"
        MEMBER_COUNT="${#_dm[@]}"
      fi
      if [ "${MEMBER_COUNT:-0}" -eq 0 ]; then
        ok "Grupo docker sem membros listados (alem do root, se aplicavel)."
      elif [ "${MEMBER_COUNT:-0}" -ge 3 ]; then
        risk "Muitos usuarios no grupo docker (${MEMBER_COUNT}). Isso e root-equivalente."
        add_risk "Grupo docker com muitos usuarios (${MEMBER_COUNT})."
      else
        warn "Usuarios no grupo docker (${MEMBER_COUNT}). Isso e root-equivalente."
        add_warn "Grupo docker com usuarios (${MEMBER_COUNT})."
      fi
    else
      warn "Grupo docker nao encontrado via getent (pode ser root-only)."
      add_warn "Grupo docker nao encontrado"
    fi
  else
    warn "getent ausente; nao foi possivel listar grupo docker."
    add_warn "getent ausente (grupo docker)"
  fi
  echo

  IDS="$(capture docker ps -q 2>/dev/null || true)"
  if [ -z "${IDS:-}" ]; then
    warn "Nenhum container em execucao ou sem permissao para listar (docker ps -q vazio)."
    add_warn "docker ps -q vazio/sem permissao"
  else
    echo "[Privileged containers]"
    PRIV_LINES="$(capture docker inspect $IDS --format '{{.Name}} privileged={{.HostConfig.Privileged}}' 2>/dev/null || true)"
    if [ -n "${PRIV_LINES:-}" ]; then
      echo "$PRIV_LINES"
      PRIV_TRUE="$(printf '%s\n' "$PRIV_LINES" | grep -E 'privileged=true' || true)"
      if [ -n "${PRIV_TRUE:-}" ]; then
        risk "Existem containers privileged=true."
        add_risk "Containers privileged=true detectados."
        echo "[Privileged=true]"
        printf '%s\n' "$PRIV_TRUE"
      else
        ok "Nenhum container privileged=true detectado."
      fi
    else
      warn "Falha ao inspecionar containers (docker inspect)."
      add_warn "docker inspect falhou (privileged)"
    fi
    echo

    echo "[Containers com docker.sock montado]"
    MOUNTS_LINES="$(capture docker inspect $IDS --format '{{.Name}} {{range .Mounts}}{{.Source}} -> {{.Destination}} RW={{.RW}}; {{end}}' 2>/dev/null || true)"
    if [ -n "${MOUNTS_LINES:-}" ]; then
      SOCK_LINES="$(printf '%s\n' "$MOUNTS_LINES" | grep -E '/var/run/docker\.sock|/docker\.sock' || true)"
      if [ -n "${SOCK_LINES:-}" ]; then
        risk "Algum container monta /var/run/docker.sock (root-equivalente)."
        add_risk "Containers montando docker.sock detectados."
        printf '%s\n' "$SOCK_LINES"
      else
        ok "Nao foi detectado mount de docker.sock em containers."
      fi
    else
      warn "Falha ao coletar mounts via docker inspect."
      add_warn "docker inspect falhou (mounts)"
    fi
    echo

    echo "[Mounts potencialmente perigosos (best effort)]"
    if [ -n "${MOUNTS_LINES:-}" ]; then
      # Flag only very high-signal mounts (avoid false positives like /var/www).
      SUSPECT_MOUNTS=""
      if cmd_exists awk; then
        SUSPECT_MOUNTS="$(
          printf '%s\n' "$MOUNTS_LINES" | awk '
            BEGIN{IGNORECASE=1}
            {
              line=$0
              # High risk: host /, /etc, /root mounted
              if (line ~ /\/ -> /) print "RISK " line
              else if (line ~ /\/etc(\/| )/ && line ~ / -> /) print "RISK " line
              else if (line ~ /\/root(\/| )/ && line ~ / -> /) print "RISK " line
              # Warn: host /var (entire) or /var/lib mounted (excluding common web roots)
              else if (line ~ /\/var\/lib(\/| )/ && line !~ /\/var\/www(\/| )/) print "WARN " line
              else if (line ~ /\/var -> /) print "WARN " line
            }
          ' || true
        )"
      else
        warn "awk ausente; nao foi possivel analisar mounts suspeitos em containers."
        add_warn "awk ausente; pulou analise de mounts suspeitos em containers"
      fi
      if [ -n "${SUSPECT_MOUNTS:-}" ]; then
        echo "$SUSPECT_MOUNTS"
        if echo "$SUSPECT_MOUNTS" | grep -q '^RISK '; then
          risk "Mounts de host sensiveis detectados (ver lista acima)."
          add_risk "Mounts sensiveis em containers detectados."
        else
          warn "Alguns mounts sensiveis detectados (ver lista acima)."
          add_warn "Mounts potencialmente sensiveis em containers."
        fi
      else
        ok "Nenhum mount de host altamente sensivel detectado (best effort)."
      fi
    else
      warn "Sem dados de mounts (docker inspect falhou)."
      add_warn "Sem dados de mounts"
    fi
  fi
else
  warn "docker nao encontrado; pulando Docker hardening."
  add_warn "docker ausente"
fi

echo
title "8) TRAEFIK / ACME"

ACME_PATHS=("/opt/traefik/acme.json" "/var/lib/traefik/acme.json")
FOUND_ACME=0
for f in "${ACME_PATHS[@]}"; do
  if [ -f "$f" ]; then
    FOUND_ACME=1
    echo "Found: $f"
    safe_run ls -la "$f" || true
    if cmd_exists stat; then
      PERM="$(capture stat -c '%a' "$f" 2>/dev/null || true)"
      OWNER="$(capture stat -c '%U:%G' "$f" 2>/dev/null || true)"
      echo "Perm:  ${PERM:-unknown}"
      echo "Owner: ${OWNER:-unknown}"

      if [ -n "${PERM:-}" ]; then
        perm_oct=$((8#$PERM))
        go_bits=$((perm_oct & 077))
        if [ "$PERM" = "600" ]; then
          ok "acme.json com permissao 600 (recomendado)."
        elif [ "$go_bits" -ne 0 ]; then
          risk "acme.json com permissao mais aberta que 600 ($PERM)."
          add_risk "acme.json permissoes muito abertas: $f ($PERM)"
        else
          warn "acme.json nao esta em 600 (atual: $PERM)."
          add_warn "acme.json nao esta 600: $f ($PERM)"
        fi
      else
        warn "Nao foi possivel ler permissao do acme.json (stat falhou)."
        add_warn "stat falhou para acme.json: $f"
      fi
    else
      warn "stat ausente; nao foi possivel verificar permissao numerica do acme.json."
      add_warn "stat ausente (acme.json)"
    fi
    echo
  fi
done

if [ "$FOUND_ACME" -eq 0 ]; then
  warn "acme.json nao encontrado em /opt/traefik ou /var/lib/traefik."
  add_warn "acme.json nao encontrado"
fi

echo
title "9) PERMISSOES EM /var/www"

if [ -d /var/www ]; then
  echo "[Diretorios world-writable sob /var/www (nao deveria haver)]"
  WW_DIRS="$(capture find /var/www -type d -perm -0002 2>/dev/null | head -n 50 || true)"
  if [ -n "${WW_DIRS:-}" ]; then
    risk "Diretorios world-writable detectados em /var/www."
    add_risk "Diretorios world-writable em /var/www."
    printf '%s\n' "$WW_DIRS"
  else
    ok "Nenhum diretorio world-writable detectado em /var/www (ate 50)."
  fi
  echo

  echo "[Permissoes de .env/.env.local/.env.production (maxdepth 4)]"
  if cmd_exists find && cmd_exists stat; then
    ENV_RISK_FOUND=0
    set +e
    while IFS= read -r -d '' ef; do
      perm="$(stat -c '%a' "$ef" 2>/dev/null)"
      owner="$(stat -c '%U:%G' "$ef" 2>/dev/null)"
      echo "${perm:-???} ${owner:-unknown} $ef"
      if [ -n "${perm:-}" ]; then
        perm_oct=$((8#$perm))
        go_bits=$((perm_oct & 077))
        if [ "$go_bits" -ne 0 ]; then
          ENV_RISK_FOUND=1
          add_risk "Permissao insegura em env: $ef ($perm $owner)"
        fi
      fi
    done < <(find /var/www -maxdepth 4 -type f \( -name ".env" -o -name ".env.local" -o -name ".env.production" \) -print0 2>/dev/null)
    set -e

    if [ "${ENV_RISK_FOUND:-0}" -eq 1 ]; then
      risk "Algum .env* esta com permissoes > 600 (grupo/outros com acesso)."
    else
      ok "Nao foi detectado .env* com permissoes > 600 (best effort)."
    fi
  else
    warn "find/stat ausentes; nao foi possivel listar permissoes de .env*."
    add_warn "find/stat ausentes (env perms)"
  fi
else
  warn "/var/www nao existe."
  add_warn "/var/www ausente"
fi

echo
title "10) LOGS"

if cmd_exists journalctl; then
  echo "[journalctl -p 3 -xb --no-pager | tail -200]"
  safe_run journalctl -p 3 -xb --no-pager 2>/dev/null | tail -200 || true
else
  warn "journalctl ausente."
  add_warn "journalctl ausente"
fi

echo
if cmd_exists last; then
  echo "[Logins recentes: last -a | head -50]"
  safe_run last -a 2>/dev/null | head -50 || true
else
  warn "last ausente."
  add_warn "last ausente"
fi

echo
title "11) RESUMO FINAL"

if [ "${#RISKS[@]}" -gt 0 ]; then
  risk "TOP RISCOS ENCONTRADOS"
  for r in "${RISKS[@]}"; do
    echo " - $r"
  done
else
  ok "Nenhum RISK detectado (com a heuristica atual)."
fi

echo
if [ "${#WARNS[@]}" -gt 0 ]; then
  warn "WARNINGS (itens para revisar)"
  for w in "${WARNS[@]}"; do
    echo " - $w"
  done
else
  ok "Nenhum WARN adicional."
fi

echo
echo "PROXIMAS ACOES SUGERIDAS (nao executadas):"
echo " - Se houver portas publicas extras no ss: fechar no firewalld e/ou mover servicos para rede interna do Docker atras do Traefik."
echo " - Se SSH permitir root login ou senha: desabilitar (PermitRootLogin no, PasswordAuthentication no) e usar somente chaves."
echo " - Se houver containers privileged ou com docker.sock montado: remover/evitar; considerar socket-proxy ou file provider no Traefik."
echo " - Garantir permissao 600 em acme.json e em todos os arquivos .env*."
echo " - Se fail2ban nao estiver ativo: instalar/configurar e aplicar jail para SSH (quando apropriado)."
echo " - Em Debian/Ubuntu: habilitar unattended-upgrades para patches automaticos."
echo
title "DONE"
