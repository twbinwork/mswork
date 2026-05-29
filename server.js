const express = require('express');const fs = require('fs');const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files from public
app.use(express.static(path.join(__dirname, 'public')));

// Serve Leaflet from node_modules (offline support)
app.use('/leaflet', express.static(path.join(__dirname, 'node_modules', 'leaflet', 'dist')));

// Serve map tiles locally (if pre-downloaded)
app.use('/tiles', express.static(path.join(__dirname, 'public', 'tiles')));

// Fallback tile route: serve cached local tiles if present, otherwise proxy to OSM online tiles
app.get('/tile/:z/:x/:y.png', (req, res) => {
  const { z, x, y } = req.params;
  const tilePath = path.join(__dirname, 'public', 'tiles', z, x, `${y}.png`);
  fs.stat(tilePath, (err) => {
    if(!err) {
      res.sendFile(tilePath);
      return;
    }
    const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    res.redirect(tileUrl);
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
