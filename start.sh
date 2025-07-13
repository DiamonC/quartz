#!/bin/sh

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
  echo "Error: This script must be run with sudo or as root." >&2
  exit 1
fi

PORT=${PORT:-4000}
QUARTZ_ROOT="/home/sysadmin/quartz"
FTP_UID=1000
FTP_GID=1000

refresh_permissions() {
  for dir in "$QUARTZ_ROOT"/servers/*/; do
    if [ -d "$dir" ]; then
      chown -R "$FTP_UID:$FTP_GID" "$dir"
      chmod -R u+rwX,go-rwx "$dir"
    fi
  done
}

# Run the permission refresher loop in background as root
(
  while true; do
    refresh_permissions
    sleep 3600
  done
) &

# Get the original user who invoked sudo
ORIGINAL_USER=$(logname 2>/dev/null || echo "$SUDO_USER")

if [ -z "$ORIGINAL_USER" ]; then
  echo "Warning: Could not detect original user. Running screen as root."
  screen -dmS qua sh scripts/autorestart.sh
else
  # Run screen as the original user (drop privileges)
  sudo -u "$ORIGINAL_USER" screen -dmS qua sh scripts/autorestart.sh
fi

echo "Quartz has started at port $PORT."

exit 0
