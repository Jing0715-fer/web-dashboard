#!/bin/bash
cd /home/z/my-project
while true; do
  npx next start -p 3000 >> dev.log 2>&1
  echo "$(date): Server exited, restarting in 2s..." >> dev.log
  sleep 2
done
