#!/bin/bash

STATE_FILE="/data/chain-state.json"
mkdir -p /data

echo "Starting fresh Anvil..."
anvil --host 0.0.0.0 --port 8545 --chain-id 56 --block-time 3 --gas-limit 30000000 &

echo "Waiting for Anvil..."
until curl -sf -X POST http://127.0.0.1:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null; do
  sleep 1
done
echo "Anvil ready!"

echo "Running setup..."
cd /app && node scripts/deploy_pancake.js 2>&1
echo "Setup exit code: $?"

echo "BSC simulation running!"
wait
