#!/bin/bash

# Parallel export script
# Runs multiple export processes for different record ranges

TOTAL_RECORDS=15733809
NUM_WORKERS=4
RECORDS_PER_WORKER=$((TOTAL_RECORDS / NUM_WORKERS))

echo "=== Parallel NDJSON Export ==="
echo "Total records: $TOTAL_RECORDS"
echo "Workers: $NUM_WORKERS"
echo "Records per worker: $RECORDS_PER_WORKER"
echo ""

# Create export directory
mkdir -p export

# Start workers in parallel
for i in $(seq 0 $((NUM_WORKERS - 1))); do
  START_OFFSET=$((i * RECORDS_PER_WORKER))

  # Last worker gets remaining records
  if [ $i -eq $((NUM_WORKERS - 1)) ]; then
    END_RECORDS=$((TOTAL_RECORDS - START_OFFSET))
  else
    END_RECORDS=$RECORDS_PER_WORKER
  fi

  OUTPUT_FILE="export/paf-worker-${i}.ndjson"

  echo "Starting worker $i: offset $START_OFFSET, records $END_RECORDS -> $OUTPUT_FILE"

  # Run export in background
  npx ts-node scripts/export-worker.ts --start-offset $START_OFFSET --max-records $END_RECORDS --output-file $OUTPUT_FILE &
done

echo ""
echo "All workers started. Waiting for completion..."
wait

echo ""
echo "All workers completed!"
echo ""
echo "Files created:"
ls -lh export/paf-worker-*.ndjson

echo ""
echo "Next: Run bulk-load-ndjson.ts to load to OpenSearch"
