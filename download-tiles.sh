#!/bin/bash
# Download map tiles for Southeast Asia for offline use
# This script downloads OpenStreetMap tiles for the SEA region (zoom 5-8)

TILE_DIR="public/tiles"
mkdir -p "$TILE_DIR"

# Region bounds: SEA (5°N-25°N, 95°E-140°E)
MIN_LAT=5
MAX_LAT=25
MIN_LON=95
MAX_LON=140
ZOOM_LEVELS="5 6 7 8"

echo "Downloading OpenStreetMap tiles for Southeast Asia..."
echo "This may take a few minutes..."

for zoom in $ZOOM_LEVELS; do
  echo "Downloading zoom level $zoom..."
  
  # Calculate tile coordinates
  for lon in $(seq $MIN_LON $((($MAX_LON - $MIN_LON) / (2**$zoom)))); do
    for lat in $(seq $MIN_LAT $((($MAX_LAT - $MIN_LAT) / (2**$zoom)))); do
      # Convert lat/lon to tile coordinates (simplified)
      n=$((2**$zoom))
      xtile=$((($lon + 180) / 360 * $n))
      ytile=$(( ($lat + 85.051129) / 170.102258 * $n ))
      
      # Download tile from OSM
      tile_url="https://tile.openstreetmap.org/$zoom/$xtile/$ytile.png"
      tile_file="$TILE_DIR/$zoom/$xtile/$ytile.png"
      mkdir -p "$(dirname "$tile_file")"
      
      # Download with 2 second delay to be respectful to OSM
      curl -s -o "$tile_file" "$tile_url" 2>/dev/null
      sleep 0.1
    done
  done
done

echo "Tiles downloaded to $TILE_DIR"
echo "Total size: $(du -sh $TILE_DIR | cut -f1)"
