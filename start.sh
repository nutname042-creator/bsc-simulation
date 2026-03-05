#!/bin/bash
set -e

STATE_FILE="/data/chain-state.json"
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

USDT_CODE=$(curl -s -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x55d398326f99059fF775485246999027B3197955","latest"],"id":1}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d['result']))")

echo "USDT code length: $USDT_CODE"

if [ "$USDT_CODE" -lt 10 ]; then
  echo "Running initial setup..."
  cd /app && node scripts/deploy_pancake.js
  echo "Setup complete!"
else
  echo "Contracts already deployed, skipping setup."
fi

echo "BSC simulation running!"
wait
