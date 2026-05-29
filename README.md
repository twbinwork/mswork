# SEA Simulation (Local & Offline)

This project is a self-contained Node.js + frontend application that simulates moving entities over a Southeast Asia map. Leaflet and app assets are served locally, and the server supports cached local tiles with an online fallback.

**Key Features:**
- Leaflet library installed via npm (not CDN)
- Local server tile proxy at `/tile/{z}/{x}/{y}.png`
- Optional pre-downloaded tiles stored in `public/tiles` for offline raster rendering
- GeoJSON-based SEA coastline overlay for region boundaries
- Web Worker simulation keeps UI responsive at 60+ FPS with thousands of entities
- Spatial grid culling for performance optimization

Prerequisites
- Node.js 16+ installed (for development)
- Internet connection (one-time) to download npm packages

Quick Start (No Installation Required)
If you have a pre-built standalone executable:
```bash
# Windows
./build/sea-sim-win.exe
# macOS
./build/sea-sim-mac
# Linux
./build/sea-sim-linux
```
Then open `http://localhost:3000` in your browser.

Install and Run (With Node.js)
```bash
npm install
npm start
# Open http://localhost:3000 in your browser
```

Build Standalone Executables
To create executable files (bundled with Node.js—no Node.js installation required):
```bash
# Build for Windows
npm run build:win
# Build for macOS
npm run build:mac
# Build for Linux
npm run build:linux
# Build all at once
npm run build:all
```

Executables are created in the `build/` folder. Share these with users who don't have Node.js installed.

Features
- Map centered on Southeast Asia (10°N, 110°E, zoom 5) with colorized country boundaries
- Ocean-blue background with latitude/longitude reference grid (graticule)
- Distinct colors for each country (Myanmar, Thailand, Laos, Vietnam, Cambodia, Malaysia, Indonesia, Philippines)
- Sidebar palette with draggable entity types: Fixed-wing, Rotary-wing, Land Vehicle, Ship
- Drag icons onto the map to place entities and edit their properties
- Random generate thousands of entities within the SEA bounding box (5°N–25°N, 95°E–140°E)
- Controls: Play, Pause, Stop, Reset
- Physics run in a Web Worker; main thread renders entities on a single Canvas overlay
- Simple spatial grid culling to return only visible entities to the main thread

Files
- `package.json` - project metadata with local Leaflet dependency
- `server.js` - Express server serving static files and Leaflet from node_modules
- `public/index.html` - SPA layout with local Leaflet links
- `public/style.css` - styles
- `public/data/sea-coastlines.geojson` - offline vector map of SEA region
- `public/js/app.js` - main UI, map/canvas, drag-drop, worker comms
- `public/js/simulationWorker.js` - worker containing the physics loop and spatial grid

Notes and tuning
- **Fully Offline:** No internet or external APIs required after startup. Leaflet and all assets are served locally.
- **No Node.js Required:** Use the pre-built executables (`sea-sim-win.exe`, `sea-sim-linux`, `sea-sim-mac`) to run without installing Node.js.
- **Vector Map:** Uses GeoJSON instead of raster tiles, so no tile server needed. Lightweight and sufficient for SEA region.
- The worker returns only entities within the viewport to reduce main-thread work and network traffic between worker/main.
- The simulation approximates meters-to-degrees conversion and is tuned for performance rather than absolute geodetic accuracy.
- To test high counts, use the Random Generate control; try with 10000 entities but be mindful of browser memory.
- Can be deployed anywhere; works completely offline once the executable runs.

Pre-Built Executables
Ready-to-run standalone executables are included:
- **Windows:** `sea-sim-win.exe` (40 MB) – double-click to run
- **Linux:** `sea-sim-linux` (47 MB) – `chmod +x` and run, or `./sea-sim-linux`

To rebuild for your platform, run `npm run build:all` (requires pkg and npm installation).
# mswork
scenario editor / generator
