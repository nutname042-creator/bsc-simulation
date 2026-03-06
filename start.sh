#!/bin/bash
set -e

STATE_FILE="/data/chain-state.json"
mkdir -p /data

# Always start fresh (no state loading) until setup is confirmed working
echo "Starting fresh Anvil..."
anvil --host 0.0.0.0 --port 8545 --chain-id 56 --block-time 3 --gas-limit 30000000 --dump-state "$STATE_FILE" &

echo "Waiting for Anvil..."
until curl -sf -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null; do
  sleep 1
done
echo "Anvil ready!"

echo "Running setup..."
cd /app && node scripts/deploy_pancake.js

echo "BSC simulation running!"
wait
