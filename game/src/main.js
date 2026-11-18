// Boot and the one game loop of Solis Heat. The world advances in fixed
// 1/60 s steps however fast the display runs; the renderer and the HUD
// paint the result; the game moves between title, play, pause, busted and
// taken-down screens. Runs autosave to localStorage after every job and
// whenever the player asks (K).
//
// ?seed=N fixes the city's traffic. ?shot=cover|street|delivery|title
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice with its HUD and sets window.__shotReady for the screenshotter.
import { SAVE_KEY, TICK } from './config.js';
import { makeRng } from './random.js';
import {
  createWorld,
  EV_BUSTED, EV_CASH, EV_CRASH, EV_DOWN, EV_GUNSHOT, EV_HONK, EV_JOBDONE, EV_PICKUP,
} from './world.js';
import { ACT_CONFIRM, ACT_INTERACT, ACT_PAUSE, ACT_SAVE, NO_INTENT, bindInput } from './input.js';
import { makeRenderer, VIEW_BUSTED, VIEW_DOWN, VIEW_PAUSED, VIEW_PLAY, VIEW_TITLE } from './render.js';
import { paintHud } from './hud.js';
import { makeAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25; // a longer stall (hidden tab) is dropped, not replayed
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = makeRenderer(canvas);
const audio = makeAudio();
let world = createWorld(makeRng(seed));

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(world.saveData()));
  } catch {
    // Storage can be off (private windows): the run then lasts this visit only.
  }
}

function playShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  const paint = () => {
    renderer.draw(world.state, scene.screen, { focus: world.focus(), hasSave: false });
    if (scene.screen === VIEW_PLAY) paintHud(canvas.getContext('2d'), world.state, renderer.camera);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
}

function playGame() {
  const input = bindInput(canvas);
  let screen = VIEW_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let lastHonkAt = -9;

  const announce = (message) => {
    status.textContent = message;
  };

  function newRun() {
    world = createWorld(makeRng(Math.floor(Math.random() * 4294967296)));
    screen = VIEW_PLAY;
    announce('A new run in Marina Solis. Meet Tía Carmen at the Mercado del Sol.');
  }

  function continueRun() {
    const save = readSave();
    world = createWorld(makeRng(seed));
    if (save) world.loadData(save);
    screen = VIEW_PLAY;
    announce('Welcome back to Marina Solis.');
  }

  canvas.addEventListener('mousedown', () => {
    audio.unlock();
    if (screen !== VIEW_TITLE) return;
    const { x, y } = input.mouse;
    for (const b of renderer.titleButtons(Boolean(readSave()))) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        if (b.id === 'new') newRun();
        else if (b.id === 'continue') continueRun();
      }
    }
  });
  window.addEventListener('keydown', (event) => {
    audio.unlock();
    if (screen === VIEW_TITLE && event.code === 'KeyC' && readSave()) continueRun();
  });

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACT_PAUSE) {
      if (screen === VIEW_PLAY) {
        screen = VIEW_PAUSED;
        announce('Paused.');
      } else if (screen === VIEW_PAUSED) {
        screen = VIEW_PLAY;
      }
    }
    if (actions & ACT_CONFIRM) {
      if (screen === VIEW_TITLE) newRun();
      else if (screen === VIEW_BUSTED || screen === VIEW_DOWN) {
        screen = VIEW_PLAY;
        announce('Back on the street.');
      } else if (screen === VIEW_PAUSED) {
        screen = VIEW_PLAY;
      }
    }
    if ((actions & ACT_SAVE) && screen === VIEW_PLAY) {
      writeSave();
      world.announce('Saved. Carmen would call that keeping receipts.', 3);
    }
    return actions;
  }

  function react(events) {
    if (events & EV_GUNSHOT) audio.gunshot();
    if (events & EV_CRASH) audio.crash();
    if (events & EV_PICKUP) audio.pickup();
    if (events & EV_CASH) audio.cash();
    if (events & EV_JOBDONE) {
      audio.fanfare();
      writeSave();
    }
    if ((events & EV_HONK) && world.state.time - lastHonkAt > 0.5) {
      lastHonkAt = world.state.time;
      audio.honk();
    }
    if (events & EV_BUSTED) {
      const fine = world.applyBust();
      audio.busted();
      screen = VIEW_BUSTED;
      announce(`Busted. Fined $${fine}.`);
      writeSave();
    } else if (events & EV_DOWN) {
      const bill = world.applyDown();
      audio.busted();
      screen = VIEW_DOWN;
      announce(`Taken down. Clinic bill $${bill}.`);
      writeSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === VIEW_PLAY) {
      let first = true;
      while (accumulator >= TICK && screen === VIEW_PLAY) {
        const intent = input.readIntent(renderer.camera);
        react(world.step(TICK, intent, first && (actions & ACT_INTERACT) !== 0));
        first = false;
        accumulator -= TICK;
      }
    } else {
      accumulator = 0;
      if (screen === VIEW_TITLE) world.step(TICK, NO_INTENT(), false); // the town idles behind the title
    }
    const focus = world.focus();
    renderer.draw(world.state, screen, { focus, hasSave: Boolean(readSave()) });
    if (screen === VIEW_PLAY || screen === VIEW_PAUSED) {
      paintHud(canvas.getContext('2d'), world.state, renderer.camera);
    }
    const car = world.state.cars.find((c) => c.id === world.state.player.inCar);
    let nearestCop = Infinity;
    for (const c of world.state.cars) {
      if (c.role === 'police') {
        nearestCop = Math.min(nearestCop, Math.hypot(c.x - focus.x, c.y - focus.y));
      }
    }
    audio.frame(
      TICK,
      screen === VIEW_PLAY && car ? Math.abs(car.speed) / (car.topSpeed ?? 380) : 0,
      screen === VIEW_PLAY && world.state.stars > 0 ? Math.max(0, 1 - nearestCop / 700) : 0,
    );
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === VIEW_PLAY) {
      screen = VIEW_PAUSED;
      writeSave();
      announce('Paused.');
    }
  });

  announce('Solis Heat. Press Enter for a new run.');
  requestAnimationFrame(frame);
}

if (shot) playShot(shot);
else playGame();
