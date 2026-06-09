#!/usr/bin/env sh
# Serve Rick Shaw Comedy project at http://localhost:8080/
cd "$(dirname "$0")"
echo "Rick Shaw Comedy — version hub at http://localhost:8080/"
echo "No password. Static files only. Press Ctrl+C to stop."
exec python3 -m http.server 8080
