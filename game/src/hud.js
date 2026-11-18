// The heads-up display, drawn over the world: cash and respect, the wanted
// stars, health (and the car's, while driving), the current objective with
// its distance and timer, story notices, the bust ring — and the minimap,
// a small live Marina Solis with traffic, police, the job and the player.
import { AVENUES, BEACH_X, STREETS, WORLD_H, WORLD_W } from './config.js';
import { GO_DARK } from './missions.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function meter(ctx, x, y, w, h, ratio, color) {
  ctx.fillStyle = 'rgba(8,14,22,0.72)';
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (ratio > 0) {
    ctx.fillStyle = color;
    rr(ctx, x + 2, y + 2, Math.max(4, (w - 4) * Math.min(1, ratio)), h - 4, (h - 4) / 2);
    ctx.fill();
  }
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

export function paintMinimap(ctx, state, x, y, w, h) {
  const kx = w / WORLD_W;
  const ky = h / WORLD_H;
  ctx.fillStyle = 'rgba(10,24,34,0.85)';
  rr(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.save();
  rr(ctx, x, y, w, h, 10);
  ctx.clip();
  ctx.fillStyle = '#146a89';
  ctx.fillRect(x, y, 250 * kx, h);
  ctx.fillStyle = '#79b657';
  ctx.fillRect(x + BEACH_X * kx, y, w - BEACH_X * kx, h);
  ctx.strokeStyle = '#565d66';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (const a of AVENUES) {
    ctx.moveTo(x + a * kx, y);
    ctx.lineTo(x + a * kx, y + h);
  }
  for (const s of STREETS) {
    ctx.moveTo(x + BEACH_X * kx, y + s * ky);
    ctx.lineTo(x + w, y + s * ky);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(220,225,230,0.6)';
  for (const car of state.cars) {
    if (car.role === 'traffic') ctx.fillRect(x + car.x * kx - 1.5, y + car.y * ky - 1.5, 3, 3);
  }
  const flash = Math.sin(state.time * 8) > 0;
  for (const car of state.cars) {
    if (car.role !== 'police') continue;
    ctx.fillStyle = flash ? '#57b6ff' : '#ff5a4e';
    ctx.beginPath();
    ctx.arc(x + car.x * kx, y + car.y * ky, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  const stage = state.mission && state.mission.stages[state.stageIndex];
  if (stage && stage.at) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x + stage.at.x * kx, y + stage.at.y * ky, 4.6 + Math.sin(state.time * 5) * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  const f = state.cars.find((c) => c.id === state.player.inCar) ?? state.player;
  ctx.save();
  ctx.translate(x + f.x * kx, y + f.y * ky);
  ctx.rotate(f.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(6, 0);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,209,102,0.55)';
  ctx.lineWidth = 1.5;
  rr(ctx, x, y, w, h, 10);
  ctx.stroke();
}

export function paintHud(ctx, state, view) {
  const w = view.w;
  const h = view.h;
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.inCar);
  ctx.textAlign = 'left';

  // Cash and respect, top left.
  ctx.fillStyle = 'rgba(8,14,22,0.66)';
  rr(ctx, 14, 14, 216, 64, 10);
  ctx.fill();
  ctx.fillStyle = '#7bf1a8';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`$${state.cash}`, 26, 44);
  ctx.fillStyle = '#cfe3ee';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`Respect ${state.respect} · Earned $${state.earned}`, 26, 66);

  // Wanted stars, top right.
  ctx.font = '22px system-ui, sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.stars ? '#ffd166' : 'rgba(230,238,245,0.28)';
    ctx.fillText('★', w - 168 + i * 30, 42);
  }
  if (state.stars > 0) {
    ctx.fillStyle = 'rgba(230,238,245,0.75)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('SOLIS PD', w - 22, 58);
    ctx.textAlign = 'left';
  }

  // Health, the car's health and the speedo, bottom left.
  meter(ctx, 16, h - 30, 190, 13, p.health / 100, p.health > 30 ? '#57d977' : '#ff5a4e');
  if (car) {
    meter(ctx, 16, h - 52, 190, 11, Math.max(0, car.health) / 100, '#ffb454');
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 21px system-ui, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(car.speed) * 0.36)} km/h`, 16, h - 64);
    ctx.fillStyle = '#cfe3ee';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(car.model, 16, h - 86);
  } else {
    ctx.fillStyle = '#cfe3ee';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Sidearm · click to shoot', 16, h - 42);
  }

  // The objective, top centre: job title, instruction, distance, timer.
  const stage = state.mission && state.mission.stages[state.stageIndex];
  if (state.mission && stage) {
    const title = state.storyDone ? state.mission.title : `${state.mission.title} — ${state.mission.giver}`;
    let line = stage.text;
    if (stage.kind === GO_DARK) {
      line += ` — heat ${Math.ceil(state.heat)}`;
    } else if (stage.at) {
      const f = car ?? p;
      line += ` · ${Math.round(Math.hypot(stage.at.x - f.x, stage.at.y - f.y))} m`;
    }
    ctx.font = 'bold 15px system-ui, sans-serif';
    const boxW = Math.max(ctx.measureText(title).width, ctx.measureText(line).width) + 34;
    const boxX = w / 2 - boxW / 2;
    ctx.fillStyle = 'rgba(8,14,22,0.7)';
    rr(ctx, boxX, 14, boxW, stage.time ? 74 : 56, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.textAlign = 'center';
    ctx.fillText(title, w / 2, 36);
    ctx.fillStyle = '#eaf6ff';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(line, w / 2, 58);
    if (stage.time) {
      const ratio = Math.max(0, state.stageTimeLeft / stage.time);
      meter(ctx, boxX + 14, 66, boxW - 28, 7, ratio, ratio > 0.3 ? '#ffd166' : '#ff5a4e');
    }
    ctx.textAlign = 'left';
    if (state.holdTime > 0 && stage.holdSeconds) {
      meter(ctx, w / 2 - 90, 96, 180, 10, state.holdTime / stage.holdSeconds, '#ffd166');
    }
  }

  // The bust ring, closing while an officer is on top of you.
  if (state.bust > 0.02) {
    ctx.strokeStyle = '#57b6ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(w / 2, h * 0.36, 34, -Math.PI / 2, -Math.PI / 2 + state.bust * Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#eaf6ff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED?', w / 2, h * 0.36 + 5);
    ctx.textAlign = 'left';
  }

  // Story notices along the bottom centre.
  if (state.notice && state.time < state.noticeUntil) {
    ctx.font = '16px system-ui, sans-serif';
    const boxW = Math.min(780, w - 300);
    const lines = wrapLines(ctx, state.notice, boxW - 20);
    const lineH = 21;
    const boxH = lines.length * lineH + 18;
    const boxY = h - 118 - boxH;
    ctx.fillStyle = 'rgba(8,14,22,0.78)';
    rr(ctx, w / 2 - boxW / 2, boxY, boxW, boxH, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.textAlign = 'center';
    lines.forEach((text, i) => ctx.fillText(text, w / 2, boxY + 24 + i * lineH));
    ctx.textAlign = 'left';
  }

  paintMinimap(ctx, state, w - 214, h - 164, 198, 148);
}
