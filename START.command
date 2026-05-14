#!/bin/zsh
cd "$(dirname "$0")"
PORT=4321

# Stop any older Between Us server using the same port/process file.
if [ -f /tmp/between-us-mvp.pid ]; then
  OLD_PID=$(cat /tmp/between-us-mvp.pid)
  if kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" 2>/dev/null || true
    sleep 1
  fi
fi

# Start the local backend in the background.
node server.js > /tmp/between-us-mvp.log 2>&1 &
echo $! > /tmp/between-us-mvp.pid
sleep 2

# Open the correct URL. Do not open index.html directly.
open "http://localhost:${PORT}"

echo "Between Us MVP is running at http://localhost:${PORT}"
echo "Close this window or press Ctrl+C only if you want to stop watching logs."
echo "Server log:"
tail -f /tmp/between-us-mvp.log
