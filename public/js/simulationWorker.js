// simulationWorker.js
// Runs in a Web Worker. Manages entity state and physics updates.

// Simple kinematic model, spatial grid for culling, viewport queries.

let bounds = {minLat:5,maxLat:25,minLon:95,maxLon:140};
let entities = []; // array of entity objects
let nextId = 1;
let running = false;
let lastTick = null;
const GRID_SIZE_DEG = 1.0; // 1 degree cells
let grid = new Map();

// Utility: clamp lon/lat into bounding box with wrapping
function wrapPosition(ent){
  if(ent.lat < bounds.minLat) ent.lat = bounds.maxLat - (bounds.minLat - ent.lat);
  if(ent.lat > bounds.maxLat) ent.lat = bounds.minLat + (ent.lat - bounds.maxLat);
  if(ent.lon < bounds.minLon) ent.lon = bounds.maxLon - (bounds.minLon - ent.lon);
  if(ent.lon > bounds.maxLon) ent.lon = bounds.minLon + (ent.lon - bounds.maxLon);
}

function latDegToMeters(){ return 111320; }

function metersPerDegLonAtLat(lat){
  return 111320 * Math.cos(lat * Math.PI/180);
}

function toGridKey(lat,lon){
  const r = Math.floor((lat - bounds.minLat)/GRID_SIZE_DEG);
  const c = Math.floor((lon - bounds.minLon)/GRID_SIZE_DEG);
  return `${r},${c}`;
}

function rebuildGrid(){
  grid.clear();
  for(const e of entities){
    const key = toGridKey(e.lat,e.lon);
    if(!grid.has(key)) grid.set(key,[]);
    grid.get(key).push(e.id);
  }
}

function spawnRandom(count){
  for(let i=0;i<count;i++){
    const lat = bounds.minLat + Math.random()*(bounds.maxLat - bounds.minLat);
    const lon = bounds.minLon + Math.random()*(bounds.maxLon - bounds.minLon);
    const type = Math.floor(Math.random()*4);
    const ent = {
      id: nextId++,
      type,
      lat, lon,
      velocity: 10 + Math.random()*80,
      accel: (Math.random()-0.5)*0.5,
      turnRadius: 50 + Math.random()*1000,
      turnRate: 2 + Math.random()*12,
      heading: Math.random()*360,
      targetHeading: null,
      lastCourseChange: performance.now() - Math.random()*10000
    };
    entities.push(ent);
  }
  rebuildGrid();
}

function addEntity(payload){
  const ent = Object.assign({id:nextId++}, payload);
  entities.push(ent);
  rebuildGrid();
  postMessage({type:'entityAdded',entity:ent});
}

function removeEntity(id){
  const idx = entities.findIndex(e=>e.id===id);
  if(idx>=0) entities.splice(idx,1);
  rebuildGrid();
}

function updateEntity(update){
  const e = entities.find(x=>x.id===update.id);
  if(!e) return;
  Object.assign(e, update);
}

function physicsStep(dt){
  const now = performance.now();
  for(const e of entities){
    // update speed
    e.velocity += (e.accel||0) * dt;
    if(e.velocity < 0) e.velocity = 0;

    // occasional course changes
    if(now - e.lastCourseChange > 2000 + Math.random()*4000){
      e.targetHeading = (e.heading + (Math.random()-0.5)*90) % 360;
      e.lastCourseChange = now;
    }

    // heading change towards targetHeading limited by turnRate
    if(e.targetHeading != null){
      let diff = ((e.targetHeading - e.heading + 540) % 360) - 180; // shortest angle
      const maxTurn = (e.turnRate || 10) * dt; // deg allowed
      if(Math.abs(diff) <= maxTurn) e.heading = (e.targetHeading + 360) % 360;
      else e.heading = (e.heading + Math.sign(diff)*maxTurn + 360) % 360;
    }

    // translate using simple lat/lon approximations
    const latMetersPerDeg = latDegToMeters();
    const lonMetersPerDeg = metersPerDegLonAtLat(e.lat);
    const dist = e.velocity * dt; // meters
    const dx = Math.cos(e.heading * Math.PI/180) * dist; // east meters
    const dy = Math.sin(e.heading * Math.PI/180) * dist; // north meters
    e.lat += dy / latMetersPerDeg;
    e.lon += dx / lonMetersPerDeg;

    wrapPosition(e);
  }
  rebuildGrid();
}

// find entities within bbox using grid
function queryVisible(minLat,maxLat,minLon,maxLon){
  const minR = Math.floor((minLat - bounds.minLat)/GRID_SIZE_DEG);
  const maxR = Math.floor((maxLat - bounds.minLat)/GRID_SIZE_DEG);
  const minC = Math.floor((minLon - bounds.minLon)/GRID_SIZE_DEG);
  const maxC = Math.floor((maxLon - bounds.minLon)/GRID_SIZE_DEG);
  const out = [];
  for(let r=minR;r<=maxR;r++){
    for(let c=minC;c<=maxC;c++){
      const key = `${r},${c}`;
      const cell = grid.get(key);
      if(!cell) continue;
      for(const id of cell){
        const e = entities.find(x=>x.id===id);
        if(!e) continue;
        if(e.lat >= minLat && e.lat <= maxLat && e.lon >= minLon && e.lon <= maxLon){
          out.push({id:e.id,lat:e.lat,lon:e.lon,heading:e.heading,type:e.type,velocity:e.velocity,accel:e.accel,turnRate:e.turnRate,turnRadius:e.turnRadius});
        }
      }
    }
  }
  return out;
}

// Main loop
function loop(now){
  if(!lastTick) lastTick = now;
  const dt = (now - lastTick)/1000; // seconds
  lastTick = now;
  if(running) physicsStep(dt);
  // schedule next
  setTimeout(()=>self.requestAnimationFrame(loop), 16);
}

// Start the RAF loop
self.requestAnimationFrame(loop);

// Message handling
onmessage = function(ev){
  const msg = ev.data;
  switch(msg.type){
    case 'config':
      bounds = msg.bounds || bounds;
      break;
    case 'start': running = true; break;
    case 'pause': running = false; break;
    case 'stop': running = false; break;
    case 'reset': entities = []; grid.clear(); nextId = 1; break;
    case 'add': addEntity(msg.entity); break;
    case 'remove': removeEntity(msg.id); break;
    case 'update': updateEntity(msg.update); break;
    case 'random': spawnRandom(msg.count); break;
    case 'viewport': {
      const b = msg.bounds;
      const vis = queryVisible(b.minLat,b.maxLat,b.minLon,b.maxLon);
      postMessage({type:'visible',entities:vis});
      break;
    }
  }
};
