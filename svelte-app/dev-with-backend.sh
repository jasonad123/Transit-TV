#!/bin/bash

echo "Starting Express backend on port 8080..."
cd ..
pnpm start &
BACKEND_PID=$!

echo "Waiting for backend to start..."
sleep 3

echo "Starting Svelte dev server on port 5173..."
cd svelte-app
pnpm dev

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
