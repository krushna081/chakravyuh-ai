#!/bin/bash
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Create user if not exists
if ! id appuser &>/dev/null; then
    groupadd -g "$PGID" appuser
    useradd -u "$PUID" -g "$PGID" -m -s /bin/bash appuser
fi

# Fix ownership on mounted volumes
chown -R "$PUID:$PGID" /app/data /app/logs 2>/dev/null || true

# Drop privileges and run
exec gosu appuser "$@"
