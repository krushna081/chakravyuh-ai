#!/bin/sh
set -e

if [ -n "${PUID}" ] && [ -n "${PGID}" ]; then
    groupmod -o -g "${PGID}" chakravyuh
    usermod -o -u "${PUID}" chakravyuh
    exec su-exec chakravyuh "$@"
else
    exec "$@"
fi
