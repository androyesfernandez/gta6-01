// Marina Solis: a sun-bleached beach town laid out on a strict grid of
// avenues and streets. This module builds the static city — blocks, named
// pastel buildings, palms, the promenade — and answers the spatial
// questions the simulation asks: road or not, pavement or not, which
// building is here, where can a car be parked.
import { AVENUES, BEACH_X, ROAD_W, STREETS, WATER_X, WORLD_H, WORLD_W } from './config.js';

const NAME_LEFT = ['Coral', 'Palma', 'Brisa', 'Marina', 'Solano', 'Vela', 'Alto', 'Perla'];
const NAME_RIGHT = ['Hotel', 'Café', 'Apartments', 'Gallery', 'Bakery', 'Pharmacy', 'Bookshop', 'Bar', 'Gym', 'Diner', 'Studios', 'Market Hall'];
const ROOF_TONES = ['#e8b04b', '#d96f4e', '#c9d6c5', '#7fb5b0', '#e3d0a7', '#b56576', '#f2a65a', '#84a98c'];
const WALL_TONES = ['#f6e7c8', '#f9dcc4', '#eaf0d8', '#fdeeda', '#f3e0b8', '#dcefe9'];

// Places the story points at, looked up by key so missions never hard-code
// coordinates.
export const PLACES = {
  crashPad: { label: "Rafi's Crash Pad", x: 520, y: 1330 },
  mercado: { label: 'Mercado del Sol', x: 1630, y: 930 },
  chopShop: { label: "Vela's Chop Shop", x: 2990, y: 2290 },
  marina: { label: 'Coral Marina Dock 3', x: 760, y: 2470 },
  clinic: { label: 'Miramar Clinic', x: 2560, y: 470 },
  pawn: { label: 'Sunset Pawn', x: 760, y: 920 },
  lighthouse: { label: 'Old Lighthouse Point', x: 480, y: 240 },
  airfield: { label: 'Solis Airfield Gate', x: 3380, y: 2520 },
  precinct: { label: 'Solis PD — Marina Station', x: 2080, y: 1420 },
};

// The land parcels between neighbouring roads: bounded west by the beach,
// east and south by the world edge. Parcels are the GAPS between road
// bands — pairing each road's near edge with the next road's far edge
// would swallow a whole avenue into the parcel and let buildings spill
// across the tarmac, walling off lanes with invisible footprint walls.
function parcels() {
  const gaps = (edges) => {
    const out = [];
    for (let i = 0; i + 1 < edges.length; i += 2) out.push([edges[i], edges[i + 1]]);
    return out;
  };
  const xEdges = [BEACH_X];
  for (const a of AVENUES) xEdges.push(a - ROAD_W / 2, a + ROAD_W / 2);
  xEdges.push(WORLD_W);
  const yEdges = [120];
  for (const s of STREETS) yEdges.push(s - ROAD_W / 2, s + ROAD_W / 2);
  yEdges.push(WORLD_H - 60);
  const out = [];
  for (const [x0, x1] of gaps(xEdges)) {
    for (const [y0, y1] of gaps(yEdges)) {
      out.push({ x0, y0, x1, y1 });
    }
  }
  return out;
}

export function buildCity(rng) {
  const buildings = [];
  const palms = [];
  const blocks = parcels();
  for (const block of blocks) {
    const w = block.x1 - block.x0;
    const h = block.y1 - block.y0;
    if (w < 190 || h < 150) continue;
    // One wide building, or two on the wider blocks, always inset so a ring
    // of pavement stays walkable around every footprint.
    const count = w > 330 && rng.chance(0.6) ? 2 : 1;
    const inset = 34;
    const lotW = (w - inset * 2 - (count - 1) * 26) / count;
    for (let k = 0; k < count; k += 1) {
      const height = rng.between(14, 58);
      buildings.push({
        x: block.x0 + inset + k * (lotW + 26),
        y: block.y0 + inset,
        w: lotW,
        h: h - inset * 2,
        height,
        roof: rng.pick(ROOF_TONES),
        wall: rng.pick(WALL_TONES),
        name: `${rng.pick(NAME_LEFT)} ${rng.pick(NAME_RIGHT)}`,
        floors: Math.max(1, Math.round(height / 11)),
      });
    }
    // Palms near the corners, standing on the pavement.
    const corners = [
      [block.x0 + 14, block.y0 + 14],
      [block.x1 - 14, block.y0 + 14],
      [block.x0 + 14, block.y1 - 14],
      [block.x1 - 14, block.y1 - 14],
    ];
    for (const [px, py] of corners) {
      if (rng.chance(0.55)) {
        palms.push({ x: px + rng.between(-5, 5), y: py + rng.between(-5, 5), s: rng.between(0.8, 1.25) });
      }
    }
  }
  // A shady double row down the beach promenade.
  for (let y = 180; y < WORLD_H - 120; y += 120) {
    palms.push({ x: WATER_X + 26 + rng.between(-6, 6), y: y + rng.between(-14, 14), s: rng.between(0.95, 1.4) });
    if (rng.chance(0.6)) palms.push({ x: BEACH_X - 24, y: y + 58, s: rng.between(0.8, 1.2) });
  }
  return { buildings, palms, blocks };
}

export const inWater = (x) => x < WATER_X;

export function onRoad(x, y) {
  if (x < BEACH_X) return false;
  return AVENUES.some((a) => Math.abs(x - a) <= ROAD_W / 2)
    || STREETS.some((s) => Math.abs(y - s) <= ROAD_W / 2);
}

export function onPavement(x, y, city) {
  if (x >= WATER_X && x < BEACH_X) return true; // the promenade
  if (onRoad(x, y)) return false;
  return city.buildings.some(
    (b) => x > b.x - 36 && x < b.x + b.w + 36 && y > b.y - 36 && y < b.y + b.h + 36,
  );
}

// The building whose footprint contains the point (grown by `margin`), else null.
export function buildingAt(x, y, city, margin = 0) {
  for (const b of city.buildings) {
    if (x > b.x - margin && x < b.x + b.w + margin && y > b.y - margin && y < b.y + b.h + margin) return b;
  }
  return null;
}

// Kerbside spawn points for parked cars: along the avenue edges, kept clear
// of the cross streets so traffic can still pass.
export function parkingSpots(rng, count) {
  const spots = [];
  let guard = 0;
  while (spots.length < count && guard < count * 30) {
    guard += 1;
    const avenue = rng.pick(AVENUES);
    const side = rng.chance(0.5) ? -1 : 1;
    const x = avenue + side * (ROAD_W / 2 - 17);
    const y = rng.between(200, WORLD_H - 200);
    if (STREETS.some((s) => Math.abs(y - s) < 110)) continue;
    spots.push({ x, y, angle: Math.PI / 2 });
  }
  return spots;
}
