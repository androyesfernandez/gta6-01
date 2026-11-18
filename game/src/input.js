// Keyboard and mouse, translated into what the world understands: one
// plain intent object per frame (movement axes, run, handbrake, firing, the
// aim point in world coordinates) plus a queue of one-shot action flags.
// Scripted drivers — staged shots, tests — build the same intent shape by
// hand and skip this module entirely.

export const ACT_CONFIRM = 1;
export const ACT_PAUSE = 2;
export const ACT_INTERACT = 4;
export const ACT_SAVE = 8;

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function bindInput(canvas) {
  const held = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let queued = 0;

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    if (!event.repeat) {
      if (event.code === 'Enter' || event.code === 'Space') queued |= ACT_CONFIRM;
      if (event.code === 'Escape' || event.code === 'KeyP') queued |= ACT_PAUSE;
      if (event.code === 'KeyF' || event.code === 'KeyE') queued |= ACT_INTERACT;
      if (event.code === 'KeyK') queued |= ACT_SAVE;
    }
    if (MOVE_KEYS.has(event.code) || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    const box = canvas.getBoundingClientRect();
    mouse.x = event.clientX - box.left;
    mouse.y = event.clientY - box.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouse.down = true;
    queued |= ACT_CONFIRM; // a click also starts the game from the title
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });

  const down = (...codes) => codes.some((c) => held.has(c));

  return {
    mouse,
    // The intent for this frame; the camera turns screen aim into world aim.
    readIntent(camera) {
      return {
        moveX: (down('KeyD', 'ArrowRight') ? 1 : 0) - (down('KeyA', 'ArrowLeft') ? 1 : 0),
        moveY: (down('KeyS', 'ArrowDown') ? 1 : 0) - (down('KeyW', 'ArrowUp') ? 1 : 0),
        run: down('ShiftLeft', 'ShiftRight'),
        handbrake: held.has('Space'),
        firing: mouse.down || held.has('KeyJ'),
        aimX: camera.x + mouse.x,
        aimY: camera.y + mouse.y,
      };
    },
    takeActions() {
      const taken = queued;
      queued = 0;
      return taken;
    },
  };
}

// The all-zeros intent: title screens, idling scenes, tests.
export const NO_INTENT = () => ({
  moveX: 0, moveY: 0, run: false, handbrake: false, firing: false, aimX: 0, aimY: 0,
});
