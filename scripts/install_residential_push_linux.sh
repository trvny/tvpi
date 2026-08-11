#!/usr/bin/env bash
set -euo pipefail
umask 077

SERVICE_NAME="tvpi-residential-push.service"
TIMER_NAME="tvpi-residential-push.timer"
INSTALL_DIR="$HOME/.local/share/tvpi/residential-push"
USER_UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
TOKEN_PATH="$INSTALL_DIR/push-token"
VOLUNTEER_ID_PATH="$INSTALL_DIR/volunteer-id.txt"

if [[ ${EUID:-$(id -u)} -eq 0 ]]; then
  echo "Run this installer as your normal user, not with sudo." >&2
  exit 1
fi

for command in systemctl sha256sum base64 head install; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 1
  fi
done

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BINARY_SOURCE="$SOURCE_DIR/tvpi-residential-push"
if [[ ! -f "$BINARY_SOURCE" ]]; then
  echo "Missing release file: $BINARY_SOURCE" >&2
  exit 1
fi

mkdir -p "$INSTALL_DIR" "$USER_UNIT_DIR"
chmod 700 "$INSTALL_DIR"

systemctl --user stop "$TIMER_NAME" >/dev/null 2>&1 || true
systemctl --user stop "$SERVICE_NAME" >/dev/null 2>&1 || true
install -m 0755 "$BINARY_SOURCE" "$INSTALL_DIR/tvpi-residential-push"

credential_replaced=false
token=""
if [[ -f "$TOKEN_PATH" ]]; then
  IFS= read -r token < "$TOKEN_PATH" || true
  if [[ "$token" != v1_* ]]; then
    backup="$TOKEN_PATH.invalid.$(date +%Y%m%d%H%M%S)"
    mv -- "$TOKEN_PATH" "$backup"
    echo "Warning: existing credential was invalid and was preserved at: $backup" >&2
    token=""
    credential_replaced=true
  fi
fi

if [[ -z "$token" ]]; then
  token="v1_$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
  printf '%s\n' "$token" > "$TOKEN_PATH"
fi
chmod 600 "$TOKEN_PATH"

volunteer_id="$(printf '%s' "$token" | sha256sum | awk '{print $1}')"
printf '%s\n' "$volunteer_id" > "$VOLUNTEER_ID_PATH"
chmod 600 "$VOLUNTEER_ID_PATH"
unset token

cat > "$INSTALL_DIR/run-tvpi.sh" <<'EOF_RUNNER'
#!/usr/bin/env bash
set -u

base_directory="$HOME/.local/share/tvpi/residential-push"
token_path="$base_directory/push-token"
log_path="$base_directory/last-run.log"

token=""
IFS= read -r token < "$token_path" || true
if [[ -z "$token" ]]; then
  printf '%s\n' "TVPI volunteer credential is missing" > "$log_path"
  exit 1
fi

export TVPI_PUSH_TOKEN="$token"
export TVPI_STATE_FILE="$base_directory/state.json"
"$base_directory/tvpi-residential-push" > "$log_path" 2>&1
status=$?
unset TVPI_PUSH_TOKEN token
exit "$status"
EOF_RUNNER
chmod 700 "$INSTALL_DIR/run-tvpi.sh"

cat > "$USER_UNIT_DIR/$SERVICE_NAME" <<'EOF_SERVICE'
[Unit]
Description=TVPI residential volunteer refresh

[Service]
Type=oneshot
ExecStart=%h/.local/share/tvpi/residential-push/run-tvpi.sh
TimeoutStartSec=10min
EOF_SERVICE

cat > "$USER_UNIT_DIR/$TIMER_NAME" <<'EOF_TIMER'
[Unit]
Description=Refresh TVPI residential streams every 12 minutes

[Timer]
OnCalendar=*-*-* *:0/12:00
Persistent=true
AccuracySec=30s
Unit=tvpi-residential-push.service

[Install]
WantedBy=timers.target
EOF_TIMER

systemctl --user daemon-reload
systemctl --user enable --now "$TIMER_NAME" >/dev/null

printf '\nInstalled in: %s\n' "$INSTALL_DIR"
printf 'Scheduled every 12 minutes.\n\n'
printf 'Volunteer ID:\n%s\n' "$volunteer_id"
if [[ "$credential_replaced" == true ]]; then
  echo "Warning: a replacement credential was generated. Any previously approved Volunteer ID is no longer valid; send this new ID for approval." >&2
else
  echo "Send this ID for one-time approval. The private credential stays on this machine."
fi
printf 'Volunteer ID file: %s\n' "$VOLUNTEER_ID_PATH"
printf 'Last run log: %s\n' "$INSTALL_DIR/last-run.log"

user_name="$(id -un)"
if command -v loginctl >/dev/null 2>&1; then
  linger="$(loginctl show-user "$user_name" -p Linger --value 2>/dev/null || true)"
  if [[ "$linger" != "yes" ]]; then
    echo ""
    echo "Note: this user does not have systemd lingering enabled. The timer works while your user manager is running; for unattended operation after logout, enable lingering with:"
    printf '  sudo loginctl enable-linger %q\n' "$user_name"
  fi
fi

systemctl --user start --no-block "$SERVICE_NAME"
echo "Started one refresh now in the background; before approval it may fail and the timer will keep retrying."
