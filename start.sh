#!/bin/sh

# Exit on any error
set -e

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run with sudo or as root." >&2
  exit 1
fi

# Get environment
PORT=${PORT:-4000}
USERNAME="${SUDO_USER:-$(logname 2>/dev/null)}"
if [ -z "$USERNAME" ]; then
  echo "Error: Could not determine original user." >&2
  exit 1
fi

# Dynamically determine UID/GID
FTP_UID=$(id -u "$USERNAME")
FTP_GID=$(id -g "$USERNAME")

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/servers"
echo "Server directory: $SERVER_DIR"
LOG_FILE="/var/log/quartz_perm_refresh.log"
PID_FILE="/var/run/quartz_perm_refresh.pid"

refresh_permissions() {
  echo "Refreshing permissions on $SERVER_DIR..."
  for dir in "$SERVER_DIR"/*/; do
    if [ -d "$dir" ]; then
      echo "Fixing $dir"
      chown -R "$FTP_UID:$FTP_GID" "$dir"
      chmod -R u+rwX,go-rwx "$dir"
    fi
  done
}

# Start the background refresher loop
start_permission_loop() {
  (
    echo $$ > "$PID_FILE"
    while true; do
      refresh_permissions
      sleep 3600
    done
  ) &
}
refresh_permissions
echo "[$(date)] Starting permission refresher loop for Quartz server." >> "$LOG_FILE"
start_permission_loop

# Launch Quartz screen session
SCREEN_SESSION="qua_$USERNAME"

if command -v screen >/dev/null 2>&1; then
  sudo -u "$USERNAME" screen -dmS "$SCREEN_SESSION" sh scripts/autorestart.sh
  echo "[$(date)] Started screen session: $SCREEN_SESSION" >> "$LOG_FILE"
else
  echo "Warning: screen not installed. Cannot start background session." >&2
fi

echo "Quartz has started at port $PORT."
