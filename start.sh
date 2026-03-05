#!/bin/bash
set -e

STATE_FILE="/data/chain-state.json"
SETUP_DONE="/data/setup_done"
mkdir -p /data

if [ -f "$STATE_FILE" ] && [ -s "$STATE_FILE" ]; then
  echo "Loading existing chain state..."
  anvil --host 0.0.0.0 --port 8545 --chain-id 56 --block-time 3 --gas-limit 30000000 --load-state "$STATE_FILE" --dump-state "$STATE_FILE" &
else
  echo "Starting fresh chain..."
  anvil --host 0.0.0.0 --port 8545 --chain-id 56 --block-time 3 --gas-limit 30000000 --dump-state "$STATE_FILE" &
fi

echo "Waiting for Anvil..."
until curl -sf -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null; do
  sleep 1
done
echo "Anvil ready!"

if [ ! -f "$SETUP_DONE" ]; then
  echo "Running initial setup..."
  cd /app && node scripts/deploy_pancake.js
  touch "$SETUP_DONE"
  echo "Setup complete!"
else
  echo "Setup already done, skipping..."
fi

echo "BSC simulation running!"
wait
