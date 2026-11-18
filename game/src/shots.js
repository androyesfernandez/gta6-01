// Staged scenes for ?shot=cover|street|delivery|title. Each scene drives
// the real simulation with scripted intents from a fresh seeded world, so
// a screenshot is a frame the game itself produced — and the same seed
// always stages the same frame.
import { AVENUES, STREETS, TICK } from './config.js';
import { PLACES } from './city.js';
import { NO_INTENT } from './input.js';
import { clamp, wrapAngle } from './physics.js';
import { VIEW_PLAY, VIEW_TITLE } from './render.js';

const withIntent = (patch) => ({ ...NO_INTENT(), ...patch });

function run(world, seconds, makeIntent, interactAtStart = false) {
  const n = Math.round(seconds / TICK);
  for (let i = 0; i < n; i += 1) {
    world.step(TICK, makeIntent(i * TICK), interactAtStart && i === 0);
  }
}

// Walk the player onto the nearest parked car and get in through the real
// interact path, so the theft, the heat and the toast all happen for real.
function stealNearestParked(world) {
  let best = null;
  let bestDist = Infinity;
  for (const car of world.state.cars) {
    if (car.role !== 'parked') continue;
    const d = Math.hypot(car.x - world.state.player.x, car.y - world.state.player.y);
    if (d < bestDist) {
      bestDist = d;
      best = car;
    }
  }
  if (!best) return;
  world.teleport(best.x, best.y);
  world.step(TICK, NO_INTENT(), true);
}

function nearestOf(list, v) {
  let best = list[0];
  for (const x of list) if (Math.abs(x - v) < Math.abs(best - v)) best = x;
  return best;
}

// Waypoints that keep the car on the road grid: ride one avenue to the
// target's street, cross along the street if the target sits on another
// avenue, then finish at the target itself.
function routeTo(world, tx, ty) {
  const car = world.state.cars.find((c) => c.id === world.state.player.inCar);
  const pts = [];
  if (!car) return pts;
  const avStart = nearestOf(AVENUES, car.x);
  const avEnd = nearestOf(AVENUES, tx);
  const stEnd = nearestOf(STREETS, ty);
  if (Math.abs(avStart - avEnd) > 10) pts.push([avStart, stEnd]);
  pts.push([avEnd, stEnd]);
  pts.push([tx, ty]);
  return pts;
}

// A scripted driver with a memory: it follows the road-grid waypoints at
// full throttle, and when the car stays slow for too long (wedged on
// traffic, a corner or a police ram) it reverses out and swings the nose
// back toward the route, the way a player would.
function roadDriver(world, tx, ty) {
  let pts = null;
  let lowFor = 0;
  let backFor = 0;
  return () => {
    const car = world.state.cars.find((c) => c.id === world.state.player.inCar);
    if (!car) return NO_INTENT();
    if (!pts) pts = routeTo(world, tx, ty);
    while (pts.length > 1 && Math.hypot(pts[0][0] - car.x, pts[0][1] - car.y) < 110) pts.shift();
    const [wx, wy] = pts[0] || [tx, ty];
    const want = Math.atan2(wy - car.y, wx - car.x);
    const steer = clamp(wrapAngle(want - car.angle) * 1.6, -1, 1);
    if (backFor > 0) {
      backFor -= TICK;
      return withIntent({ moveY: 1, moveX: -steer });
    }
    if (Math.abs(car.speed) < 26) {
      lowFor += TICK;
      if (lowFor > 0.7) {
        backFor = 0.55;
        lowFor = 0;
      }
    } else {
      lowFor = 0;
    }
    return withIntent({ moveY: -1, moveX: steer });
  };
}

// Step in quarter-second chunks until ready(elapsed) says the frame is
// worth taking (or the time budget runs out).
function runUntil(world, maxSeconds, makeIntent, ready) {
  let t = 0;
  while (t < maxSeconds) {
    run(world, 0.25, makeIntent);
    t += 0.25;
    if (ready(t)) return;
  }
}

function playerCar(world) {
  return world.state.cars.find((c) => c.id === world.state.player.inCar) || null;
}

export function stageShot(name, world) {
  if (name === 'street') {
    // On foot outside the Mercado, mid-errand, crowds and traffic around.
    world.teleport(PLACES.mercado.x, PLACES.mercado.y + 64);
    const legs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    run(world, 4, (t) => {
      const d = legs[Math.floor(t) % 4];
      return withIntent({ moveX: d[0], moveY: d[1] });
    });
    return { screen: VIEW_PLAY };
  }
  if (name === 'delivery') {
    // First Wheels, second beat: the car is stolen at the Mercado, then
    // the frame joins the last leg — rolling south down the chop shop's
    // own avenue with the drop a few blocks ahead.
    world.teleport(PLACES.mercado.x, PLACES.mercado.y);
    run(world, 0.2, () => NO_INTENT());
    stealNearestParked(world);
    const car = playerCar(world);
    if (car) {
      car.angle = Math.PI / 2;
      car.speed = 170;
      world.teleport(2841, 1560);
    }
    runUntil(world, 7, roadDriver(world, PLACES.chopShop.x, PLACES.chopShop.y), (t) => {
      const c = playerCar(world);
      return t >= 2 && c !== null && Math.abs(c.speed) > 170;
    });
    return { screen: VIEW_PLAY };
  }
  if (name === 'title') {
    // The title screen over the promenade, the town idling behind it.
    world.teleport(560, 1400);
    run(world, 2.5, () => NO_INTENT());
    return { screen: VIEW_TITLE };
  }
  // cover: three stars, sirens behind, the job marker on the minimap —
  // a chase down the central avenue with everything on screen at once.
  // Join the avenue already rolling north in the correct lane, so by the
  // time the frame is taken the Interceptors have closed in behind.
  world.teleport(1549, 1980);
  stealNearestParked(world);
  const coverCar = world.state.cars.find((c) => c.id === world.state.player.inCar);
  if (coverCar) {
    coverCar.angle = -Math.PI / 2;
    coverCar.speed = 210;
    world.teleport(1549, 1980);
  }
  world.setWanted(3);
  runUntil(world, 9, roadDriver(world, 1549, 240), (t) => {
    const car = playerCar(world);
    if (t < 1.5 || !car || Math.abs(car.speed) < 200) return false;
    return world.state.cars.some(
      (c) => c.role === 'police' && Math.hypot(c.x - car.x, c.y - car.y) < 560,
    );
  });
  return { screen: VIEW_PLAY };
}
