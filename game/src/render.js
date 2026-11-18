// The renderer: it paints Marina Solis from the camera — sea and sand, the
// road grid, pastel buildings with their names over the door, palms, cars,
// people, tracers — and the full-screen states (title, pause, busted,
// taken down). It only reads the world state; it never changes it.
import { AVENUES, BEACH_X, PALETTE, ROAD_W, STREETS, WATER_X, WORLD_H, WORLD_W } from './config.js';

export const VIEW_TITLE = 'title';
export const VIEW_PLAY = 'play';
export const VIEW_PAUSED = 'paused';
export const VIEW_BUSTED = 'busted';
export const VIEW_DOWN = 'down';

export function makeRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const camera = { x: 0, y: 0, w: 1280, h: 720 };

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    camera.w = window.innerWidth;
    camera.h = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', fit);
  fit();

  const onScreen = (x, y, pad = 90) =>
    x > camera.x - pad && x < camera.x + camera.w + pad && y > camera.y - pad && y < camera.y + camera.h + pad;

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function paintRoads() {
    ctx.fillStyle = PALETTE.asphalt;
    for (const a of AVENUES) ctx.fillRect(a - ROAD_W / 2, 0, ROAD_W, WORLD_H);
    for (const s of STREETS) ctx.fillRect(BEACH_X, s - ROAD_W / 2, WORLD_W - BEACH_X, ROAD_W);
    ctx.fillRect(BEACH_X, 0, 26, WORLD_H); // the promenade road
    ctx.strokeStyle = PALETTE.laneMark;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    ctx.beginPath();
    for (const a of AVENUES) {
      ctx.moveTo(a, 0);
      ctx.lineTo(a, WORLD_H);
    }
    for (const s of STREETS) {
      ctx.moveTo(BEACH_X, s);
      ctx.lineTo(WORLD_W, s);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // Zebra crossings on all four sides of every junction.
    ctx.fillStyle = 'rgba(240,240,230,0.55)';
    for (const a of AVENUES) {
      for (const s of STREETS) {
        for (let i = -2; i <= 2; i += 1) {
          ctx.fillRect(a - ROAD_W / 2 - 12, s + i * 20 - 5, 9, 10);
          ctx.fillRect(a + ROAD_W / 2 + 3, s + i * 20 - 5, 9, 10);
          ctx.fillRect(a + i * 20 - 5, s - ROAD_W / 2 - 12, 10, 9);
          ctx.fillRect(a + i * 20 - 5, s + ROAD_W / 2 + 3, 10, 9);
        }
      }
    }
  }

  function paintMarker(state) {
    const stage = state.mission && state.mission.stages[state.stageIndex];
    if (!stage || !stage.at || !onScreen(stage.at.x, stage.at.y, 200)) return;
    const { x, y } = stage.at;
    const beam = ctx.createLinearGradient(x, y - 190, x, y);
    beam.addColorStop(0, 'rgba(255,209,102,0)');
    beam.addColorStop(1, 'rgba(255,209,102,0.5)');
    ctx.fillStyle = beam;
    ctx.fillRect(x - 9, y - 190, 18, 190);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(x, y, 26 + Math.sin(state.time * 4) * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40300a';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', x, y + 4);
  }

  function paintBuilding(b) {
    ctx.fillStyle = 'rgba(60,40,20,0.25)';
    ctx.fillRect(b.x + b.height * 0.35, b.y + b.height * 0.45, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x - 3, b.y - 3, b.w + 6, b.h + 6);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    const rows = Math.max(1, Math.floor(b.h / 34));
    const cols = Math.max(1, Math.floor(b.w / 34));
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        ctx.fillRect(b.x + 12 + c * 34, b.y + 12 + r * 34, 13, 9);
      }
    }
    ctx.fillStyle = 'rgba(40,30,20,0.78)';
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h + 17);
  }

  function paintPalm(p) {
    ctx.strokeStyle = '#8a6b45';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + 4 * p.s, p.y - 8 * p.s, p.x + 7 * p.s, p.y - 13 * p.s);
    ctx.stroke();
    ctx.strokeStyle = '#3e9b4f';
    ctx.lineWidth = 2.4;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + p.x * 0.01;
      ctx.beginPath();
      ctx.moveTo(p.x + 7 * p.s, p.y - 13 * p.s);
      ctx.quadraticCurveTo(
        p.x + 7 * p.s + Math.cos(a) * 10 * p.s,
        p.y - 13 * p.s + Math.sin(a) * 5 * p.s - 3,
        p.x + 7 * p.s + Math.cos(a) * 15 * p.s,
        p.y - 13 * p.s + Math.sin(a) * 9 * p.s + 4,
      );
      ctx.stroke();
    }
  }

  function paintPed(ped, state) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(ped.x, ped.y + 8, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (ped.down) {
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 13, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const bob = Math.sin(state.time * 9 + ped.id) * 1.6;
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y + bob * 0.3, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y - 4 + bob * 0.3, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintCar(car, state) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(3, 6, 27, 14, car.angle, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(car.angle);
    ctx.fillStyle = '#15181d';
    for (const [wx, wy] of [[-15, -12], [15, -12], [-15, 12], [15, 12]]) {
      ctx.fillRect(wx - 5, wy - 3, 10, 6);
    }
    ctx.fillStyle = car.role === 'police' ? '#f4f6f8' : car.color;
    rr(-24, -12, 48, 24, 7);
    ctx.fill();
    if (car.role === 'police') {
      ctx.fillStyle = '#1d2733';
      ctx.fillRect(-8, -12, 15, 24);
    }
    ctx.fillStyle = '#20303e';
    rr(-9, -9, 19, 18, 4);
    ctx.fill();
    ctx.fillStyle = '#9fd8e8';
    rr(-7, -7, 6, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#fff6bf';
    ctx.fillRect(22, -9, 3, 5);
    ctx.fillRect(22, 4, 3, 5);
    if (car.role === 'police') {
      const phase = Math.sin(state.time * 11) > 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#3b82f6';
      ctx.fillRect(-4, -6, 8, 5);
      ctx.fillStyle = phase ? '#3b82f6' : '#ff3b30';
      ctx.fillRect(-4, 1, 8, 5);
    }
    if (car.health < 38) {
      ctx.fillStyle = 'rgba(70,70,70,0.5)';
      ctx.beginPath();
      ctx.arc(20, 0, 7 + Math.sin(state.time * 7 + car.id) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (car.id === state.player.inCar) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(car.x, car.y, 34 + Math.sin(state.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function paintPlayer(state) {
    const p = state.player;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 10, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0aa6a6';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c79b';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#083f3f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 15, p.y + Math.sin(p.angle) * 15);
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(p.x, p.y - 2, 6.5, p.angle + 2.2, p.angle - 2.2, true);
    ctx.fill();
  }

  function paintWorld(state) {
    const { city } = state;
    ctx.fillStyle = PALETTE.seaDeep;
    ctx.fillRect(0, 0, camera.w, camera.h);
    ctx.save();
    ctx.translate(-camera.x, -camera.y);
    // The sea, with slow wave strokes, then sand, then town grass.
    ctx.fillStyle = PALETTE.sea;
    ctx.fillRect(camera.x, camera.y, WATER_X - camera.x + 2, camera.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let y = camera.y - 40; y < camera.y + camera.h + 40; y += 46) {
      for (let x = 20; x < WATER_X - 30; x += 90) {
        const wob = Math.sin(state.time * 0.9 + y * 0.05 + x * 0.11) * 7;
        ctx.moveTo(x, y + wob);
        ctx.quadraticCurveTo(x + 18, y + wob - 6, x + 36, y + wob);
      }
    }
    ctx.stroke();
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WATER_X, 0, BEACH_X - WATER_X, WORLD_H);
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(BEACH_X, 0, WORLD_W - BEACH_X, WORLD_H);
    ctx.fillStyle = PALETTE.sidewalk;
    for (const b of city.blocks) {
      if (onScreen(b.x0 + (b.x1 - b.x0) / 2, b.y0 + (b.y1 - b.y0) / 2, 420)) {
        ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      }
    }
    paintRoads();
    paintMarker(state);
    for (const b of city.buildings) {
      if (onScreen(b.x + b.w / 2, b.y + b.h / 2, 300)) paintBuilding(b);
    }
    for (const p of city.palms) {
      if (onScreen(p.x, p.y, 60)) paintPalm(p);
    }
    for (const ped of state.peds) {
      if (onScreen(ped.x, ped.y, 40)) paintPed(ped, state);
    }
    for (const car of state.cars) {
      if (onScreen(car.x, car.y, 90)) paintCar(car, state);
    }
    if (!state.player.inCar) paintPlayer(state);
    ctx.strokeStyle = '#ffe66d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const b of state.bullets) {
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.014, b.y - b.vy * 0.014);
    }
    ctx.stroke();
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.span);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // A wash of late sun from the north-west corner.
    const glow = ctx.createRadialGradient(
      camera.w * 0.82, -camera.h * 0.25, 60,
      camera.w * 0.82, -camera.h * 0.25, camera.h * 1.15,
    );
    glow.addColorStop(0, 'rgba(255,190,90,0.20)');
    glow.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, camera.w, camera.h);
  }

  // Clickable title-menu buttons in CSS pixels; main.js hit-tests these.
  function titleButtons(hasSave) {
    const bw = 300;
    const bx = camera.w / 2 - bw / 2;
    const buttons = [{ id: 'new', x: bx, y: camera.h * 0.56, w: bw, h: 52, label: 'NEW RUN — Enter' }];
    if (hasSave) buttons.push({ id: 'continue', x: bx, y: camera.h * 0.56 + 66, w: bw, h: 52, label: 'CONTINUE — C' });
    return buttons;
  }

  function paintTitle(hasSave) {
    ctx.fillStyle = 'rgba(8,16,26,0.55)';
    ctx.fillRect(0, 0, camera.w, camera.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd166';
    ctx.font = '900 84px system-ui, sans-serif';
    ctx.fillText('SOLIS HEAT', camera.w / 2, camera.h * 0.3);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '600 22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story in the beach town of Marina Solis', camera.w / 2, camera.h * 0.3 + 40);
    ctx.fillStyle = '#cfe3ee';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('Rafi Solano owes Tía Carmen two months\' rent. She is offering him the town instead — one job at a time.', camera.w / 2, camera.h * 0.3 + 74);
    for (const b of titleButtons(hasSave)) {
      ctx.fillStyle = 'rgba(255,209,102,0.92)';
      rr(b.x, b.y, b.w, b.h, 10);
      ctx.fill();
      ctx.fillStyle = '#231a04';
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.fillText(b.label, camera.w / 2, b.y + 33);
    }
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '15px system-ui, sans-serif';
    const help = [
      'WASD / arrows — move & drive · Shift — run · F — enter / leave a car · Mouse — aim, click — shoot',
      'Space — handbrake · P / Esc — pause · K — save · Steal cars, run jobs, mind the stars.',
    ];
    help.forEach((line, i) => ctx.fillText(line, camera.w / 2, camera.h * 0.86 + i * 22));
  }

  function paintEnd(state, view) {
    ctx.fillStyle = 'rgba(8,10,18,0.62)';
    ctx.fillRect(0, 0, camera.w, camera.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = view === VIEW_BUSTED ? '#7cc4ff' : '#ff8a7a';
    ctx.font = '900 64px system-ui, sans-serif';
    ctx.fillText(view === VIEW_BUSTED ? 'BUSTED' : 'TAKEN DOWN', camera.w / 2, camera.h * 0.42);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '19px system-ui, sans-serif';
    const line = view === VIEW_BUSTED
      ? 'The Solis PD walk you out of the Marina Station a little poorer. Press Enter to keep going.'
      : 'You wake up at Miramar Clinic with a bill and a headache. Press Enter to keep going.';
    ctx.fillText(line, camera.w / 2, camera.h * 0.42 + 44);
    ctx.fillText(`Cash on hand: $${state.cash}`, camera.w / 2, camera.h * 0.42 + 76);
  }

  function draw(state, view, meta = {}) {
    const f = meta.focus ?? state.player;
    camera.x = Math.max(0, Math.min(WORLD_W - camera.w, f.x - camera.w / 2));
    camera.y = Math.max(0, Math.min(WORLD_H - camera.h, f.y - camera.h / 2));
    paintWorld(state);
    if (view === VIEW_TITLE) paintTitle(meta.hasSave ?? false);
    else if (view === VIEW_BUSTED || view === VIEW_DOWN) paintEnd(state, view);
    else if (view === VIEW_PAUSED) {
      ctx.fillStyle = 'rgba(8,16,26,0.55)';
      ctx.fillRect(0, 0, camera.w, camera.h);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = '900 52px system-ui, sans-serif';
      ctx.fillText('PAUSED', camera.w / 2, camera.h * 0.44);
      ctx.fillStyle = '#eaf6ff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('P / Esc — resume · K — save · Your run autosaves after every job', camera.w / 2, camera.h * 0.44 + 40);
    }
  }

  return { draw, camera, titleButtons };
}
