// Every sound is synthesised with WebAudio — there are no audio files, so
// the game stays fully offline. Two loops (the engine, whose pitch follows
// the car's speed, and the police siren) run under a set of one-shot blips.
// If the browser has no AudioContext, everything quietly does nothing.

export function makeAudio() {
  let ac = null;
  let engine = null;
  let engineLevel = null;
  let siren = null;
  let sirenLevel = null;
  let sirenPhase = 0;

  function start() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      return true;
    }
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      ac = new Ctor();
      const loop = (type, freq) => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.value = 0;
        osc.connect(gain).connect(ac.destination);
        osc.start();
        return { osc, gain };
      };
      ({ osc: engine, gain: engineLevel } = loop('sawtooth', 55));
      ({ osc: siren, gain: sirenLevel } = loop('triangle', 700));
      return true;
    } catch {
      ac = null;
      return false;
    }
  }

  function blip(freq, seconds, { type = 'square', volume = 0.08, slide = 0 } = {}) {
    if (!start()) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, ac.currentTime + seconds);
    gain.gain.setValueAtTime(volume, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + seconds);
    osc.connect(gain).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + seconds);
  }

  const later = (ms, fn) => setTimeout(fn, ms);

  return {
    unlock() {
      start();
    },
    // Called every frame: speedRatio 0..1, sirenNear 0..1.
    frame(dt, speedRatio, sirenNear) {
      if (!ac) return;
      const target = speedRatio > 0.02 ? 0.05 : 0;
      engineLevel.gain.value += (target - engineLevel.gain.value) * Math.min(1, dt * 8);
      engine.frequency.value = 50 + speedRatio * 130;
      sirenPhase += dt * 2.4;
      sirenLevel.gain.value = sirenNear * 0.035;
      siren.frequency.value = 660 + Math.sin(sirenPhase * Math.PI) * 190;
    },
    gunshot() { blip(190, 0.09, { volume: 0.1, slide: 60 }); },
    crash() { blip(120, 0.12, { type: 'sawtooth', volume: 0.09, slide: 50 }); },
    honk() { blip(340, 0.16, { volume: 0.05 }); },
    pickup() {
      blip(660, 0.09, { type: 'sine', volume: 0.09 });
      later(70, () => blip(880, 0.12, { type: 'sine', volume: 0.09 }));
    },
    cash() {
      blip(990, 0.08, { type: 'sine', volume: 0.1 });
      later(80, () => blip(1320, 0.16, { type: 'sine', volume: 0.1 }));
    },
    busted() {
      blip(392, 0.18, { type: 'triangle', volume: 0.11 });
      later(170, () => blip(311, 0.18, { type: 'triangle', volume: 0.11 }));
      later(340, () => blip(233, 0.34, { type: 'triangle', volume: 0.11 }));
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => later(i * 110, () => blip(f, 0.16, { type: 'sine', volume: 0.1 })));
    },
  };
}
