#!/bin/bash
cd /home/z/my-project
while true; do
  npx next start -p 3000 2>&1
  echo "Server crashed at $(date), restarting in 3 seconds..."
  sleep 3
done
