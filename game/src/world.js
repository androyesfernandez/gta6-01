// The world simulation: Rafi on foot and behind the wheel, traffic that
// drives the grid, pedestrians who wander and run, the Solis PD answering
// the wanted level, gunfire, and the stage machine that walks Carmen's
// story. It advances in fixed steps from a single intent object and knows
// nothing about the DOM or drawing, so tests and staged screenshots can
// drive exactly the code the browser runs.
import { AVENUES, STREETS, HEAT, VEHICLE, WALKER, WORLD_H, WORLD_W } from './config.js';
import { PLACES, buildCity, buildingAt, inWater, onPavement, onRoad, parkingSpots } from './city.js';
import { BRING_CAR, GO_DARK, GO_TO, HOLD_SPOT, STORY, sideJob } from './missions.js';
import { circlesOverlap, clamp, distance, slideCircle, wrapAngle } from './physics.js';

export const EV_GUNSHOT = 1;
export const EV_CRASH = 2;
export const EV_CASH = 4;
export const EV_BUSTED = 8;
export const EV_DOWN = 16;
export const EV_JOBDONE = 32;
export const EV_HONK = 64;
export const EV_PICKUP = 128;

const MODELS = [
  { name: 'Vela Comet', color: '#e4572e', topSpeed: 430 },
  { name: 'Solis Burro', color: '#f2a65a', topSpeed: 340 },
  { name: 'Palma Breeze', color: '#7fb5b0', topSpeed: 390 },
  { name: 'Coral Taxi', color: '#f4d35e', topSpeed: 370 },
  { name: 'Miramar Luxe', color: '#b56576', topSpeed: 460 },
  { name: 'Duna Pickup', color: '#84a98c', topSpeed: 320 },
];
const PED_SHIRTS = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f78c6b', '#c8b6ff', '#ffffff'];

export function createWorld(rng) {
  const city = buildCity(rng);
  const placeList = Object.values(PLACES);
  let nextId = 1;

  const state = {
    time: 0,
    city,
    player: { x: PLACES.crashPad.x, y: PLACES.crashPad.y + 60, angle: -Math.PI / 2, health: WALKER.maxHealth, inCar: 0, fireTimer: 0, lastShotAt: -99 },
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    heat: 0,
    stars: 0,
    bust: 0,
    lastCrimeAt: -99,
    cash: 120,
    respect: 0,
    earned: 0,
    missionIndex: 0,
    stageIndex: 0,
    mission: null,
    stageTimeLeft: 0,
    holdTime: 0,
    holdCrimeDone: false,
    storyDone: false,
    sideJobs: 0,
    notice: '',
    noticeUntil: 0,
    stats: { stolen: 0, shotsFired: 0, pedsDown: 0 },
  };

  const announce = (text, seconds = 5) => {
    state.notice = text;
    state.noticeUntil = state.time + seconds;
  };

  // Whatever the camera and the rules should treat as "the player": the car
  // he is driving, or the man himself.
  const focus = () => state.cars.find((c) => c.id === state.player.inCar) ?? state.player;
  const stageNow = () => (state.mission ? state.mission.stages[state.stageIndex] ?? null : null);

  // ---- spawning -------------------------------------------------------------

  function trafficCar(near) {
    const eastWest = rng.chance(0.5);
    const dir = rng.chance(0.5) ? 1 : -1;
    let x;
    let y;
    let angle;
    if (eastWest) {
      y = rng.pick(STREETS) + 29 * dir;
      x = near ? clamp(near.x + rng.between(-1200, 1200), 500, WORLD_W - 60) : rng.between(500, WORLD_W - 60);
      angle = dir > 0 ? 0 : Math.PI;
    } else {
      x = rng.pick(AVENUES) - 29 * dir;
      y = near ? clamp(near.y + rng.between(-1200, 1200), 120, WORLD_H - 60) : rng.between(120, WORLD_H - 60);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    const model = rng.pick(MODELS);
    return {
      id: nextId++, role: 'traffic', x, y, angle, speed: 0,
      cruise: rng.between(190, 265), health: VEHICLE.maxHealth,
      color: model.color, model: model.name, topSpeed: model.topSpeed,
      turnTimer: rng.between(1, 4), honkTimer: 0, shotTimer: 0,
    };
  }

  function policeCar() {
    const f = focus();
    const side = rng.intBetween(0, 3);
    let rawX = clamp(f.x + [900, -900, 0, 0][side], 480, WORLD_W - 40);
    let rawY = clamp(f.y + [0, 0, 800, -800][side], 100, WORLD_H - 40);
    // Near a world edge the clamp can drop a unit almost on top of the
    // player; push the point back out along its approach line so every
    // response starts as a fair chase, never an ambush at arm's length.
    if (distance(f.x, f.y, rawX, rawY) < 520) {
      const a = Math.atan2(rawY - f.y, rawX - f.x);
      rawX = clamp(f.x + Math.cos(a) * 720, 460, WORLD_W - 40);
      rawY = clamp(f.y + Math.sin(a) * 720, 80, WORLD_H - 40);
    }
    const spot = slideCircle(rawX, rawY, VEHICLE.radius, city);
    return {
      id: nextId++, role: 'police', x: spot.x, y: spot.y, angle: 0, speed: 0,
      cruise: 430, health: VEHICLE.maxHealth + 40,
      color: '#f4f6f8', model: 'Solis PD Interceptor', topSpeed: 470,
      turnTimer: 0, honkTimer: 0, shotTimer: rng.between(0.8, 1.6),
    };
  }

  function pedestrian(near) {
    let x = 270;
    let y = 60;
    for (let tries = 0; tries < 24; tries += 1) {
      x = near ? clamp(near.x + rng.between(-900, 900), 270, WORLD_W - 40) : rng.between(270, WORLD_W - 40);
      y = near ? clamp(near.y + rng.between(-900, 900), 60, WORLD_H - 60) : rng.between(60, WORLD_H - 60);
      if ((onPavement(x, y, city) || onRoad(x, y)) && !buildingAt(x, y, city, 4)) break;
    }
    return {
      id: nextId++, x, y, angle: rng.between(0, Math.PI * 2),
      tx: x, ty: y, wait: rng.between(0, 2), panic: 0,
      down: false, downAt: 0, color: rng.pick(PED_SHIRTS),
    };
  }

  function resetWorld() {
    nextId = 1;
    state.cars = [];
    state.peds = [];
    state.bullets = [];
    state.particles = [];
    for (const spot of parkingSpots(rng, 17)) {
      const model = rng.pick(MODELS);
      state.cars.push({
        id: nextId++, role: 'parked', x: spot.x, y: spot.y, angle: spot.angle, speed: 0,
        cruise: 0, health: VEHICLE.maxHealth, color: model.color, model: model.name,
        topSpeed: model.topSpeed, turnTimer: 0, honkTimer: 0, shotTimer: 0,
      });
    }
    for (let i = 0; i < 13; i += 1) state.cars.push(trafficCar(null));
    for (let i = 0; i < 26; i += 1) state.peds.push(pedestrian(null));
    state.player.x = PLACES.crashPad.x;
    state.player.y = PLACES.crashPad.y + 60;
    state.player.health = WALKER.maxHealth;
    state.player.inCar = 0;
    state.heat = 0;
    state.stars = 0;
    state.bust = 0;
    beginMission(0);
    announce('Marina Solis. Tía Carmen is waiting at the Mercado del Sol.', 6);
  }

  // ---- the mission machine ----------------------------------------------------

  function beginMission(index) {
    state.missionIndex = index;
    state.stageIndex = 0;
    state.holdTime = 0;
    state.holdCrimeDone = false;
    if (index < STORY.length) {
      state.mission = STORY[index];
      state.storyDone = false;
    } else {
      state.mission = sideJob(rng, placeList);
      state.storyDone = true;
    }
    const stage = stageNow();
    state.stageTimeLeft = stage && stage.time ? stage.time : 0;
    if (state.mission.intro) announce(state.mission.intro, 9);
  }

  function finishStage(events) {
    const stage = stageNow();
    if (stage && stage.done) announce(stage.done, 6);
    if (stage && stage.ambush) events |= EV_PICKUP;
    state.stageIndex += 1;
    state.holdTime = 0;
    state.holdCrimeDone = false;
    if (state.stageIndex >= state.mission.stages.length) {
      state.cash += state.mission.reward;
      state.earned += state.mission.reward;
      state.respect += 1;
      if (state.mission.id === 'side-job') state.sideJobs += 1;
      announce(`${state.mission.title} — done. +$${state.mission.reward}. ${state.mission.outro}`, 8);
      beginMission(state.missionIndex + 1);
      return events | EV_JOBDONE | EV_CASH;
    }
    const next = stageNow();
    state.stageTimeLeft = next && next.time ? next.time : 0;
    return events;
  }

  function failTimedStage() {
    announce('Out of time. The job resets — Carmen does not pay for late.', 6);
    state.stageIndex = 0;
    state.holdTime = 0;
    state.holdCrimeDone = false;
    const stage = stageNow();
    state.stageTimeLeft = stage && stage.time ? stage.time : 0;
  }

  function stepMissions(dt, events) {
    const stage = stageNow();
    if (!stage) return events;
    if (stage.heatFloor) state.heat = Math.max(state.heat, stage.heatFloor * HEAT.perStar);
    if (stage.time) {
      state.stageTimeLeft -= dt;
      if (state.stageTimeLeft <= 0) {
        failTimedStage();
        return events;
      }
    }
    const f = focus();
    if (stage.kind === GO_TO && stage.at && distance(f.x, f.y, stage.at.x, stage.at.y) < 62) {
      if (stage.ambush) {
        state.heat = Math.max(state.heat, stage.ambush * HEAT.perStar + 1);
        state.lastCrimeAt = state.time;
      }
      return finishStage(events);
    }
    if (stage.kind === BRING_CAR && stage.at && state.player.inCar
      && distance(f.x, f.y, stage.at.x, stage.at.y) < 100) {
      return finishStage(events);
    }
    if (stage.kind === HOLD_SPOT && stage.at) {
      const inside = distance(f.x, f.y, stage.at.x, stage.at.y) < 70;
      if (inside && !state.holdCrimeDone) {
        state.holdCrimeDone = true;
        if (stage.crime === 'robbery') reportCrime(HEAT.robbery, f.x, f.y, true);
      }
      if (inside) {
        state.holdTime += dt;
        if (state.holdTime >= (stage.holdSeconds ?? 3)) return finishStage(events);
      } else {
        state.holdTime = Math.max(0, state.holdTime - dt * 2);
      }
    }
    if (stage.kind === GO_DARK && state.heat <= 0) return finishStage(events);
    return events;
  }

  // ---- crime and the wanted level ----------------------------------------------

  function anyoneWatching(x, y) {
    for (const ped of state.peds) {
      if (!ped.down && distance(x, y, ped.x, ped.y) < HEAT.witnessDist) return true;
    }
    for (const car of state.cars) {
      if (car.role !== 'parked' && distance(x, y, car.x, car.y) < HEAT.witnessDist + 60) return true;
    }
    return false;
  }

  function reportCrime(amount, x, y, seen) {
    const f = focus();
    const witnessed = seen ?? anyoneWatching(x ?? f.x, y ?? f.y);
    state.heat = clamp(state.heat + (witnessed ? amount : amount * 0.45), 0, HEAT.cap);
    state.lastCrimeAt = state.time;
  }

  function stepWanted(dt) {
    const f = focus();
    const copNear = state.cars.some(
      (c) => c.role === 'police' && distance(f.x, f.y, c.x, c.y) < HEAT.copSight,
    );
    if (state.heat > 0) {
      const quiet = state.time - state.lastCrimeAt > 5;
      const rate = copNear ? HEAT.coolSeen : quiet ? HEAT.coolCalm : HEAT.coolSeen;
      state.heat = Math.max(0, state.heat - rate * dt);
    }
    state.stars = state.heat <= 0 ? 0 : Math.min(5, Math.ceil(state.heat / HEAT.perStar));
    // The PD fields one more car than the star count, up to six.
    const want = state.stars === 0 ? 0 : Math.min(6, state.stars + 1);
    const have = state.cars.filter((c) => c.role === 'police');
    if (have.length < want) state.cars.push(policeCar());
    if (have.length > want) {
      const far = have.find((c) => distance(f.x, f.y, c.x, c.y) > 700);
      if (far) state.cars = state.cars.filter((c) => c !== far);
    }
  }

  // ---- the player ----------------------------------------------------------------

  function stepOnFoot(dt, intent, events) {
    const p = state.player;
    if (p.inCar) return events;
    const len = Math.hypot(intent.moveX, intent.moveY);
    if (len > 0) {
      const speed = intent.run ? WALKER.run : WALKER.walk;
      const nx = p.x + (intent.moveX / len) * speed * dt;
      const ny = p.y + (intent.moveY / len) * speed * dt;
      const fixed = slideCircle(nx, ny, WALKER.radius, city);
      p.x = fixed.x;
      p.y = fixed.y;
      p.angle = Math.atan2(intent.moveY, intent.moveX);
    }
    if (intent.firing && p.fireTimer <= 0) {
      p.fireTimer = 0.17;
      p.lastShotAt = state.time;
      state.stats.shotsFired += 1;
      const a = Math.atan2(intent.aimY - p.y, intent.aimX - p.x);
      state.bullets.push({
        x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18,
        vx: Math.cos(a) * 920, vy: Math.sin(a) * 920, life: 0.55, hostile: false,
      });
      reportCrime(HEAT.gunshot, p.x, p.y);
      events |= EV_GUNSHOT;
    }
    p.fireTimer = Math.max(0, p.fireTimer - dt);
    return events;
  }

  function enterOrExitCar(events) {
    const p = state.player;
    if (p.inCar) {
      const car = state.cars.find((c) => c.id === p.inCar);
      if (car && Math.abs(car.speed) < 60) {
        const side = car.angle + Math.PI / 2;
        const fixed = slideCircle(car.x + Math.cos(side) * 34, car.y + Math.sin(side) * 34, WALKER.radius, city);
        p.x = fixed.x;
        p.y = fixed.y;
        p.inCar = 0;
      }
      return events;
    }
    let best = null;
    let bestDist = 52;
    for (const car of state.cars) {
      if (car.role === 'police' || car.health <= 5) continue;
      const d = distance(p.x, p.y, car.x, car.y);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    if (best) {
      if (best.role !== 'player') {
        reportCrime(HEAT.carTheft, best.x, best.y);
        state.stats.stolen += 1;
        announce(`Taken: a ${best.model}. It drives like it wants to help.`, 3.5);
      }
      best.role = 'player';
      best.speed = 0;
      p.inCar = best.id;
    }
    return events;
  }

  // Shared driving physics for the player, traffic and the police.
  function drive(dt, car, throttle, steer, handbrake) {
    if (throttle > 0) car.speed += throttle * VEHICLE.accel * dt;
    else if (throttle < 0) car.speed += throttle * VEHICLE.brake * dt;
    else car.speed -= car.speed * VEHICLE.drag * dt * 0.6;
    if (handbrake) car.speed -= car.speed * 2.4 * dt;
    car.speed = clamp(car.speed, -VEHICLE.reverseTop, car.topSpeed ?? 380);
    if (Math.abs(car.speed) > 4) {
      const grip = VEHICLE.turnRate * clamp(Math.abs(car.speed) / 190, 0.25, 1) * (handbrake ? 1.5 : 1);
      car.angle = wrapAngle(car.angle + steer * grip * dt * Math.sign(car.speed));
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = slideCircle(nx, ny, VEHICLE.radius, city);
    if (fixed.x < 445) fixed.x = 445; // cars stay off the sand and out of the sea
    if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
      if (Math.abs(car.speed) > 150) car.health -= Math.abs(car.speed) * 0.03;
      car.speed *= -0.22;
    }
    car.x = fixed.x;
    car.y = fixed.y;
  }

  function stepDriving(dt, intent) {
    const car = state.cars.find((c) => c.id === state.player.inCar);
    if (!car) {
      state.player.inCar = 0;
      return;
    }
    drive(dt, car, -intent.moveY, intent.moveX, intent.handbrake);
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    if (car.health <= 0) {
      car.health = 0;
      announce('The car gives up in a cloud of steam. On foot, then.', 4);
      state.player.inCar = 0;
      const fixed = slideCircle(car.x + 36, car.y, WALKER.radius, city);
      state.player.x = fixed.x;
      state.player.y = fixed.y;
    }
  }

  // ---- traffic ----------------------------------------------------------------------

  function stepTraffic(dt, events) {
    const f = focus();
    for (const car of state.cars) {
      if (car.role !== 'traffic') continue;
      if (distance(f.x, f.y, car.x, car.y) > 1500) {
        const fresh = trafficCar(f);
        car.x = fresh.x;
        car.y = fresh.y;
        car.angle = fresh.angle;
      }
      // Brake for anything close ahead in the facing direction.
      let blocked = false;
      for (const other of state.cars) {
        if (other === car) continue;
        if (distance(car.x, car.y, other.x, other.y) < 84) {
          const toward = Math.atan2(other.y - car.y, other.x - car.x);
          if (Math.abs(wrapAngle(toward - car.angle)) < 0.6) blocked = true;
        }
      }
      const goal = blocked ? 0 : car.cruise;
      const rate = blocked ? 320 : 140;
      car.speed += clamp(goal - car.speed, -rate * dt, rate * dt);
      car.speed = clamp(car.speed, 0, car.cruise);
      // At a crossing centre line, sometimes turn onto the other road.
      car.turnTimer -= dt;
      if (car.turnTimer <= 0) {
        car.turnTimer = rng.between(0.7, 1.6);
        const headingVertical = Math.abs(Math.sin(car.angle)) > 0.7;
        const lines = headingVertical ? STREETS : AVENUES;
        const along = headingVertical ? car.y : car.x;
        for (const line of lines) {
          if (Math.abs(along - line) < 26 && rng.chance(0.45)) {
            car.angle = wrapAngle(car.angle + (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2));
            break;
          }
        }
      }
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const fixed = slideCircle(nx, ny, VEHICLE.radius, city);
      if (Math.abs(fixed.x - nx) > 0.5 || Math.abs(fixed.y - ny) > 0.5) {
        car.angle = wrapAngle(car.angle + Math.PI);
        car.speed = 40;
      }
      car.x = fixed.x;
      car.y = fixed.y;
      car.honkTimer -= dt;
      if (blocked && car.speed < 20 && car.honkTimer <= 0 && distance(f.x, f.y, car.x, car.y) < 300) {
        car.honkTimer = rng.between(2, 5);
        events |= EV_HONK;
      }
    }
    return events;
  }

  // ---- police --------------------------------------------------------------------------

  function stepPolice(dt, events) {
    const f = focus();
    const p = state.player;
    let closingIn = false;
    for (const car of state.cars) {
      if (car.role !== 'police') continue;
      const d = distance(car.x, car.y, f.x, f.y);
      if (!p.inCar && d < 60) {
        car.speed -= car.speed * 4 * dt; // they stop to make the arrest
      } else {
        const want = Math.atan2(f.y - car.y, f.x - car.x);
        const steer = clamp(wrapAngle(want - car.angle) * 2.2, -1, 1);
        drive(dt, car, d > 46 ? 1 : 0.2, steer, false);
      }
      if (!p.inCar && d < 85) closingIn = true;
      car.shotTimer -= dt;
      if (state.stars >= 3 && !p.inCar && d < 300 && car.shotTimer <= 0) {
        car.shotTimer = rng.between(1.1, 1.7);
        const a = Math.atan2(p.y - car.y, p.x - car.x) + rng.between(-0.1, 0.1);
        state.bullets.push({
          x: car.x + Math.cos(a) * 24, y: car.y + Math.sin(a) * 24,
          vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, life: 0.45, hostile: true,
        });
        events |= EV_GUNSHOT;
      }
    }
    if (closingIn && state.stars > 0) {
      state.bust = Math.min(1, state.bust + dt / 2.4);
      if (state.bust >= 1) events |= EV_BUSTED;
    } else {
      state.bust = Math.max(0, state.bust - dt / 1.6);
    }
    return events;
  }

  // ---- pedestrians ------------------------------------------------------------------------

  function stepPeds(dt) {
    const f = focus();
    const gunfireRecent = state.time - state.player.lastShotAt < 1.2;
    for (const ped of state.peds) {
      if (ped.down) continue;
      if (distance(f.x, f.y, ped.x, ped.y) > 1500) {
        const fresh = pedestrian(f);
        ped.x = fresh.x;
        ped.y = fresh.y;
        ped.tx = fresh.tx;
        ped.ty = fresh.ty;
      }
      const scared = gunfireRecent
        || state.cars.some((c) => (c.role === 'police' || Math.abs(c.speed) > 300)
          && distance(ped.x, ped.y, c.x, c.y) < 170);
      if (scared) ped.panic = 1.6;
      if (ped.panic > 0) {
        ped.panic -= dt;
        const away = Math.atan2(ped.y - f.y, ped.x - f.x);
        const fixed = slideCircle(ped.x + Math.cos(away) * 240 * dt, ped.y + Math.sin(away) * 240 * dt, 10, city);
        ped.x = fixed.x;
        ped.y = fixed.y;
        ped.angle = away;
        continue;
      }
      if (ped.wait > 0) {
        ped.wait -= dt;
        continue;
      }
      if (distance(ped.x, ped.y, ped.tx, ped.ty) < 12) {
        ped.wait = rng.between(0.4, 3);
        const tx = ped.x + rng.between(-260, 260);
        const ty = ped.y + rng.between(-260, 260);
        if (!inWater(tx) && !buildingAt(tx, ty, city, 2)) {
          ped.tx = clamp(tx, 265, WORLD_W - 30);
          ped.ty = clamp(ty, 40, WORLD_H - 40);
        }
        continue;
      }
      const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
      ped.angle = a;
      const fixed = slideCircle(ped.x + Math.cos(a) * 74 * dt, ped.y + Math.sin(a) * 74 * dt, 10, city);
      ped.x = fixed.x;
      ped.y = fixed.y;
    }
  }

  // ---- collisions, bullets, particles -------------------------------------------------------

  function burst(x, y, n, color) {
    for (let i = 0; i < n; i += 1) {
      state.particles.push({
        x, y, vx: rng.between(-90, 90), vy: rng.between(-90, 90),
        life: rng.between(0.25, 0.6), span: 0.6, color, size: rng.between(2, 4.5),
      });
    }
  }

  function stepCollisions(events) {
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        if (!circlesOverlap(a.x, a.y, VEHICLE.radius, b.x, b.y, VEHICLE.radius)) continue;
        const impact = Math.abs(a.speed - b.speed) + Math.abs(a.speed) * 0.3;
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        a.x -= Math.cos(ang) * 9.6;
        a.y -= Math.sin(ang) * 9.6;
        b.x += Math.cos(ang) * 9.6;
        b.y += Math.sin(ang) * 9.6;
        // A shove must never leave a car inside a building or in the sea:
        // slide both back into legal space before anything else sees them.
        const fixA = slideCircle(a.x, a.y, VEHICLE.radius, city);
        a.x = Math.max(fixA.x, 445);
        a.y = fixA.y;
        const fixB = slideCircle(b.x, b.y, VEHICLE.radius, city);
        b.x = Math.max(fixB.x, 445);
        b.y = fixB.y;
        if (impact > 90) {
          a.health -= impact * 0.05;
          b.health -= impact * 0.05;
          burst(a.x, a.y, 5, '#ffd166');
          if (a.role === 'player' || b.role === 'player') {
            const other = a.role === 'player' ? b : a;
            if (other.role === 'police') reportCrime(HEAT.hitCopCar, other.x, other.y, true);
            else if (other.role === 'traffic') reportCrime(HEAT.fenderBender, other.x, other.y);
            events |= EV_CRASH;
          }
        }
        a.speed *= 0.55;
        b.speed *= 0.55;
      }
      if (Math.abs(a.speed) > 55) {
        for (const ped of state.peds) {
          if (ped.down) continue;
          if (circlesOverlap(a.x, a.y, VEHICLE.radius, ped.x, ped.y, 11)) {
            ped.down = true;
            ped.downAt = state.time;
            burst(ped.x, ped.y, 8, '#ef476f');
            if (a.role === 'player') {
              state.stats.pedsDown += 1;
              reportCrime(HEAT.killPedestrian, ped.x, ped.y, true);
              announce('You hit someone. The whole street saw it.', 4);
            }
            a.speed *= 0.6;
          }
        }
      }
    }
    return events;
  }

  function stepBullets(dt, events) {
    const p = state.player;
    const kept = [];
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0 || buildingAt(b.x, b.y, city, 0) !== null || inWater(b.x);
      if (!dead && !b.hostile) {
        for (const ped of state.peds) {
          if (!ped.down && circlesOverlap(b.x, b.y, 4, ped.x, ped.y, 11)) {
            ped.down = true;
            ped.downAt = state.time;
            state.stats.pedsDown += 1;
            reportCrime(HEAT.killPedestrian, ped.x, ped.y, true);
            burst(ped.x, ped.y, 7, '#ef476f');
            dead = true;
            break;
          }
        }
        if (!dead) {
          for (const car of state.cars) {
            if (car.id !== p.inCar && circlesOverlap(b.x, b.y, 4, car.x, car.y, VEHICLE.radius)) {
              car.health -= 13;
              burst(b.x, b.y, 4, '#ffd166');
              if (car.role === 'police') reportCrime(HEAT.hitCopCar, car.x, car.y, true);
              dead = true;
              break;
            }
          }
        }
      }
      if (!dead && b.hostile && !p.inCar && circlesOverlap(b.x, b.y, 4, p.x, p.y, WALKER.radius)) {
        p.health -= 7;
        burst(p.x, p.y, 4, '#ef476f');
        dead = true;
        if (p.health <= 0) events |= EV_DOWN;
      }
      if (!dead) kept.push(b);
    }
    state.bullets = kept;
    return events;
  }

  function stepParticles(dt) {
    const kept = [];
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life > 0) kept.push(pt);
    }
    state.particles = kept;
    // Wrecked traffic is towed; the downed are carried off and replaced.
    state.cars = state.cars.filter((c) => c.role === 'player' || c.role === 'police' || c.health > -30);
    for (const ped of state.peds) {
      if (ped.down && state.time - ped.downAt > 14) {
        const fresh = pedestrian(focus());
        ped.x = fresh.x;
        ped.y = fresh.y;
        ped.tx = fresh.tx;
        ped.ty = fresh.ty;
        ped.down = false;
      }
    }
  }

  // ---- outcomes and saves ------------------------------------------------------------------------

  function clearPoliceAndHeat() {
    state.heat = 0;
    state.stars = 0;
    state.bust = 0;
    state.cars = state.cars.filter((c) => c.role !== 'police');
    state.player.inCar = 0;
    state.player.health = WALKER.maxHealth;
  }

  function applyBust() {
    const fine = Math.min(state.cash, 100 + state.stars * 50);
    state.cash -= fine;
    clearPoliceAndHeat();
    state.player.x = PLACES.precinct.x;
    state.player.y = PLACES.precinct.y + 90;
    return fine;
  }

  function applyDown() {
    const bill = Math.min(state.cash, 150);
    state.cash -= bill;
    clearPoliceAndHeat();
    state.player.x = PLACES.clinic.x;
    state.player.y = PLACES.clinic.y + 80;
    return bill;
  }

  function saveData() {
    return {
      cash: state.cash,
      respect: state.respect,
      earned: state.earned,
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      sideJobs: state.sideJobs,
      x: Math.round(state.player.x),
      y: Math.round(state.player.y),
      stats: state.stats,
    };
  }

  function loadData(data) {
    if (!data) return;
    state.cash = data.cash ?? state.cash;
    state.respect = data.respect ?? 0;
    state.earned = data.earned ?? 0;
    state.sideJobs = data.sideJobs ?? 0;
    state.stats = data.stats ?? state.stats;
    state.player.x = clamp(data.x ?? state.player.x, 270, WORLD_W - 30);
    state.player.y = clamp(data.y ?? state.player.y, 40, WORLD_H - 40);
    beginMission(Math.min(data.missionIndex ?? 0, STORY.length + 4));
    if ((data.missionIndex ?? 0) >= STORY.length) state.storyDone = true;
  }

  // ---- the step itself --------------------------------------------------------------------------------

  function step(dt, intent, interactPressed) {
    state.time += dt;
    let events = 0;
    if (interactPressed) events = enterOrExitCar(events);
    events = stepOnFoot(dt, intent, events);
    if (state.player.inCar) stepDriving(dt, intent);
    events = stepTraffic(dt, events);
    events = stepPolice(dt, events);
    stepPeds(dt);
    events = stepCollisions(events);
    events = stepBullets(dt, events);
    stepParticles(dt);
    stepWanted(dt);
    events = stepMissions(dt, events);
    if (state.player.health <= 0) events |= EV_DOWN;
    return events;
  }

  resetWorld();

  return {
    state,
    step,
    focus,
    stageNow,
    announce,
    applyBust,
    applyDown,
    saveData,
    loadData,
    // Staging helpers for screenshots and tests.
    setWanted(stars) {
      state.heat = stars * HEAT.perStar + 1;
      state.lastCrimeAt = state.time;
    },
    forceEnterCar() {
      let best = null;
      let bestDist = Infinity;
      for (const car of state.cars) {
        if (car.role === 'police') continue;
        const d = distance(state.player.x, state.player.y, car.x, car.y);
        if (d < bestDist) {
          bestDist = d;
          best = car;
        }
      }
      if (best) {
        best.role = 'player';
        state.player.inCar = best.id;
        state.player.x = best.x;
        state.player.y = best.y;
      }
      return best;
    },
    teleport(x, y) {
      const fixed = slideCircle(x, y, WALKER.radius, city);
      state.player.x = fixed.x;
      state.player.y = fixed.y;
      if (state.player.inCar) {
        const car = state.cars.find((c) => c.id === state.player.inCar);
        if (car) {
          car.x = fixed.x;
          car.y = fixed.y;
        }
      }
    },
  };
}
