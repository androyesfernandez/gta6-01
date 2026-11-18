// Small geometry helpers used by the player, the pedestrians and every car:
// clamping, angle wrapping, and pushing circles out of solid buildings.
import { WORLD_H, WORLD_W } from './config.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function wrapAngle(a) {
  let r = a;
  while (r > Math.PI) r -= Math.PI * 2;
  while (r < -Math.PI) r += Math.PI * 2;
  return r;
}

export const distance = (x0, y0, x1, y1) => Math.hypot(x1 - x0, y1 - y0);

export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = bx - ax;
  const dy = by - ay;
  const rr = ar + br;
  return dx * dx + dy * dy < rr * rr;
}

// Move a circle to (x, y), then push it out of the world bounds and out of
// every building footprint. Returns the corrected position; callers compare
// it with the requested one to detect a collision.
export function slideCircle(x, y, radius, city) {
  let nx = clamp(x, radius + 8, WORLD_W - radius - 8);
  let ny = clamp(y, radius + 8, WORLD_H - radius - 8);
  for (const b of city.buildings) {
    const nearX = clamp(nx, b.x, b.x + b.w);
    const nearY = clamp(ny, b.y, b.y + b.h);
    const dx = nx - nearX;
    const dy = ny - nearY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    if (d2 > 0.0001) {
      const d = Math.sqrt(d2);
      nx = nearX + (dx / d) * radius;
      ny = nearY + (dy / d) * radius;
    } else {
      // Centre ended up inside the footprint: leave through the nearest face.
      const exits = [
        { d: nx - b.x, x: b.x - radius, y: ny },
        { d: b.x + b.w - nx, x: b.x + b.w + radius, y: ny },
        { d: ny - b.y, x: nx, y: b.y - radius },
        { d: b.y + b.h - ny, x: nx, y: b.y + b.h + radius },
      ];
      exits.sort((p, q) => p.d - q.d);
      nx = exits[0].x;
      ny = exits[0].y;
    }
  }
  return { x: nx, y: ny };
}
