// App: UI, map/canvas setup, drag-drop, controls, worker comms

const SEA_BOUNDS = {minLat:5, maxLat:25, minLon:95, maxLon:140};
const MAP_CENTER = [10, 110];
const MAP_ZOOM = 5;

// Maps entity type string to integer code for worker
const TYPE_CODES = {fixedwing:0, rotary:1, land:2, ship:3};
const TYPE_NAMES = ['fixedwing','rotary','land','ship'];

let map, canvas, ctx, worker;
let devicePixelRatio = window.devicePixelRatio || 1;
let visibleEntities = []; // latest set received from worker
let animating = false;
let lastViewportSent = 0;

document.addEventListener('DOMContentLoaded', () => {
  initMap();
  initUI();
  initWorker();
});

function initMap(){
  map = L.map('map').setView(MAP_CENTER, MAP_ZOOM);
  
  // Add tiles via local tile proxy. If tiles are pre-downloaded into public/tiles, they are served locally.
  const osmLayer = L.tileLayer(
    '/tile/{z}/{x}/{y}.png',
    {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
      minZoom: 2,
      errorTileUrl: '/data/blank.png'
    }
  ).addTo(map);

  // Try to load country boundaries with better styling
  fetch('/data/sea-coastlines.geojson')
    .then(r => r.json())
    .then(geojson => {
      L.geoJSON(geojson, {
        style: function(feature) {
          return {
            color: '#333',
            weight: 2,
            opacity: 0.8,
            fillColor: '#fff3e0',
            fillOpacity: 0.3
          };
        },
        pointToLayer: function(feature, latlng) {
          return L.circleMarker(latlng, {
            radius: 3,
            color: '#d62728',
            weight: 1,
            opacity: 0.7,
            fillColor: '#ff7f0e',
            fillOpacity: 0.6
          });
        }
      }).addTo(map);
    })
    .catch(e => console.warn('GeoJSON not loaded:', e));

  // Canvas overlay
  canvas = document.getElementById('overlay');
  ctx = canvas.getContext('2d');
  resizeCanvas();

  // Resize canvas with map container
  map.on('resize move zoom', () => {
    resizeCanvas();
    // Throttle viewport updates
    sendViewport();
  });

  // Drag & drop onto map
  const mapContainer = map.getContainer();
  mapContainer.addEventListener('dragover', e => e.preventDefault());
  mapContainer.addEventListener('drop', onMapDrop);

  // Start draw loop
  requestAnimationFrame(drawLoop);
}

function resizeCanvas(){
  const mapRect = map.getContainer().getBoundingClientRect();
  canvas.style.left = '0px';
  canvas.style.top = '0px';
  canvas.width = Math.round(mapRect.width * devicePixelRatio);
  canvas.height = Math.round(mapRect.height * devicePixelRatio);
  canvas.style.width = mapRect.width + 'px';
  canvas.style.height = mapRect.height + 'px';
  ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
}

function initUI(){
  // Palette dragstart
  document.querySelectorAll('.palette-item').forEach(el => {
    el.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', el.dataset.type);
    });
  });

  // Controls
  document.getElementById('rand-generate').addEventListener('click', () => {
    const count = parseInt(document.getElementById('rand-count').value) || 0;
    if(count>0){
      worker.postMessage({type:'random',count});
    }
  });

  document.getElementById('play').addEventListener('click', ()=> worker.postMessage({type:'start'}));
  document.getElementById('pause').addEventListener('click', ()=> worker.postMessage({type:'pause'}));
  document.getElementById('stop').addEventListener('click', ()=> worker.postMessage({type:'stop'}));
  document.getElementById('reset').addEventListener('click', ()=> worker.postMessage({type:'reset'}));

  // Props panel
  document.getElementById('update-props').addEventListener('click', updateEntityProps);
  document.getElementById('delete-entity').addEventListener('click', deleteSelectedEntity);
}

function onMapDrop(e){
  e.preventDefault();
  const type = e.dataTransfer.getData('text/plain') || 'fixedwing';
  // get pixel relative to map container
  const rect = map.getContainer().getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const latlng = map.containerPointToLatLng([x,y]);

  // Default properties
  const props = {
    type: TYPE_CODES[type],
    lat: latlng.lat,
    lon: latlng.lng,
    velocity: 50 + Math.random()*50, // m/s
    accel: 0,
    turnRadius: 200 + Math.random()*800,
    turnRate: 5 + Math.random()*10,
    heading: Math.random()*360
  };

  worker.postMessage({type:'add',entity:props});
}

function initWorker(){
  worker = new Worker('/js/simulationWorker.js');
  worker.onmessage = (ev) => {
    const msg = ev.data;
    if(msg.type === 'visible'){ visibleEntities = msg.entities || []; }
    if(msg.type === 'entityAdded'){ openPropsForEntity(msg.entity); }
    // other message types can be handled here
  };

  // Send initial config
  worker.postMessage({type:'config',bounds:SEA_BOUNDS});
}

function sendViewport(){
  const bounds = map.getBounds();
  const now = performance.now();
  // throttle to ~20-30Hz
  if(now - lastViewportSent < 40) return;
  lastViewportSent = now;
  worker.postMessage({type:'viewport',bounds:{minLat:bounds.getSouth(),maxLat:bounds.getNorth(),minLon:bounds.getWest(),maxLon:bounds.getEast()}});
}

// Draw loop: draws latest visibleEntities array at requestAnimationFrame
function drawLoop(){
  requestAnimationFrame(drawLoop);
  // Clear
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // draw each entity
  visibleEntities.forEach(e => {
    drawEntity(e);
  });
}

function drawEntity(e){
  // e: {id,lat,lon,heading,type}
  const p = map.latLngToContainerPoint([e.lat,e.lon]);
  // cull if outside canvas
  if(p.x < -50 || p.y < -50 || p.x > canvas.width/devicePixelRatio+50 || p.y > canvas.height/devicePixelRatio+50) return;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((e.heading||0) * Math.PI/180);

  // draw simple shape per type
  switch(e.type){
    case 0: // fixedwing - triangle
      ctx.fillStyle = '#1f77b4';
      ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-8,6); ctx.lineTo(-8,-6); ctx.closePath(); ctx.fill();
      break;
    case 1: // rotary - circle
      ctx.fillStyle = '#ff7f0e';
      ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
      break;
    case 2: // land - square
      ctx.fillStyle = '#2ca02c';
      ctx.fillRect(-6,-4,10,8);
      break;
    case 3: // ship - rectangle long
      ctx.fillStyle = '#d62728';
      ctx.fillRect(-10,-4,16,8);
      break;
    default:
      ctx.fillStyle = '#666';
      ctx.fillRect(-4,-4,8,8);
  }

  ctx.restore();
}

// Property editing
function openPropsForEntity(entity){
  // show in props panel
  document.getElementById('no-selection').style.display='none';
  const form = document.getElementById('props-form');
  form.style.display='block';
  document.getElementById('entity-id').value = entity.id;
  document.getElementById('prop-type').textContent = TYPE_NAMES[entity.type] || 'unknown';
  document.getElementById('prop-velocity').value = entity.velocity;
  document.getElementById('prop-accel').value = entity.accel;
  document.getElementById('prop-turnRadius').value = entity.turnRadius;
  document.getElementById('prop-turnRate').value = entity.turnRate;
  document.getElementById('prop-heading').value = entity.heading;
}

function updateEntityProps(){
  const id = document.getElementById('entity-id').value;
  if(!id) return;
  const update = {
    id: parseInt(id,10),
    velocity: parseFloat(document.getElementById('prop-velocity').value)||0,
    accel: parseFloat(document.getElementById('prop-accel').value)||0,
    turnRadius: parseFloat(document.getElementById('prop-turnRadius').value)||0,
    turnRate: parseFloat(document.getElementById('prop-turnRate').value)||0,
    heading: parseFloat(document.getElementById('prop-heading').value)||0
  };
  worker.postMessage({type:'update',update});
}

function deleteSelectedEntity(){
  const id = document.getElementById('entity-id').value;
  if(!id) return;
  worker.postMessage({type:'remove',id:parseInt(id,10)});
  // hide form
  document.getElementById('props-form').style.display='none';
  document.getElementById('no-selection').style.display='block';
}

// Periodically send viewport to worker for culling
setInterval(sendViewport, 200);
