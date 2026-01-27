#!/bin/bash
# Daily ACO Dashboard Memory Backup
# Run this script daily at 10pm EST (or any time)

TODAY=$(date +%Y-%m-%d)
SOURCE="/root/clawd/aco-dashboard/ACO_MEMORY.md"
DEST="/root/clawd/memory/${TODAY}-aco-dashboard.md"

if [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$DEST"
    echo "✅ Memory backed up: $DEST"
else
    echo "⚠️ No ACO_MEMORY.md found to copy"
fi
