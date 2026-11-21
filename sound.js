'use strict';
// Every sound is synthesised here with Web Audio, so there are no audio files to load or license.
// game.js calls sfx(name) for one-off sounds and setLoops(...) every frame for the ones that last.

const sound = { ctx: null, out: null, fx: null, music: null, noise: null, loops: {}, musicAt: 0, step: 0 };
const pref = (key, fallback) => { try { const v = localStorage.getItem(key); return v === null ? fallback : v === '1'; } catch (e) { return fallback; } };
const keep = (key, on) => { try { localStorage.setItem(key, on ? '1' : '0'); } catch (e) { /* private window: just not remembered */ } };
let sfxOn = pref('bungeoppang-sfx', true), musicOn = pref('bungeoppang-music', false);

// Browsers only allow audio after the first click, so the engine starts then.
function wakeAudio() {
  if (sound.ctx) { if (sound.ctx.state === 'suspended') sound.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  const c = sound.ctx = new AC();
  sound.out = c.createGain(); sound.out.connect(c.destination);
  sound.fx = c.createGain(); sound.fx.gain.value = sfxOn ? 1 : 0; sound.fx.connect(sound.out);
  sound.music = c.createGain(); sound.music.gain.value = musicOn ? 0.5 : 0; sound.music.connect(sound.out);
  const n = c.sampleRate * 2, buf = c.createBuffer(1, n, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  sound.noise = buf;
  // Lasting sounds: a noise source through a filter, faded in and out by setLoops.
  const loop = (type, freq, q) => {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; src.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sound.fx); src.start();
    return { f, g };
  };
  sound.loops = { pour: loop('bandpass', 1400, 1.2), paste: loop('lowpass', 420, 0.8), sizzle: loop('highpass', 3600, 0.7), street: loop('lowpass', 380, 0.5) };
  sound.musicAt = c.currentTime + 0.1;
}
addEventListener('pointerdown', wakeAudio, true);

function tone(freq, dur, opt = {}) {
  const c = sound.ctx;
  if (!c || !sfxOn) return;
  const t = c.currentTime + (opt.at || 0), o = c.createOscillator(), g = c.createGain();
  o.type = opt.type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
  g.gain.setValueAtTime(opt.vol || 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sound.fx); o.start(t); o.stop(t + dur + 0.02);
}

function hiss(dur, opt = {}) {
  const c = sound.ctx;
  if (!c || !sfxOn) return;
  const t = c.currentTime + (opt.at || 0), src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = sound.noise; src.playbackRate.value = opt.rate || 1;
  f.type = opt.filter || 'bandpass'; f.Q.value = opt.q || 1;
  f.frequency.setValueAtTime(opt.freq || 1500, t);
  if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
  g.gain.setValueAtTime(opt.vol || 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sound.fx);
  src.start(t, Math.random()); src.stop(t + dur + 0.02);
}

const SOUNDS = {
  pick() { tone(880, 0.07, { vol: 0.06 }); tone(1320, 0.12, { at: 0.06, vol: 0.06 }); },
  drop() { tone(520, 0.08, { to: 360, type: 'triangle', vol: 0.08 }); },
  shut() { hiss(0.12, { freq: 900, q: 0.6, vol: 0.35 }); tone(170, 0.22, { type: 'triangle', vol: 0.2 }); tone(620, 0.16, { type: 'square', vol: 0.03, at: 0.01 }); },
  open() { hiss(0.08, { freq: 1300, vol: 0.2 }); tone(240, 0.14, { type: 'triangle', vol: 0.12 }); },
  tick() { tone(1900, 0.025, { type: 'square', vol: 0.025 }); },
  ding() { tone(988, 0.25, { type: 'triangle', vol: 0.12 }); tone(784, 0.4, { type: 'triangle', vol: 0.12, at: 0.18 }); },
  burnt() { tone(196, 0.18, { type: 'sawtooth', vol: 0.05 }); tone(185, 0.3, { type: 'sawtooth', vol: 0.05, at: 0.2 }); },
  flip() { hiss(0.3, { freq: 500, to: 2600, q: 0.8, vol: 0.22 }); tone(150, 0.25, { type: 'triangle', vol: 0.16, at: 0.26 }); hiss(0.1, { freq: 900, vol: 0.25, at: 0.26 }); },
  reveal() { [784, 988, 1175].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.07, at: i * 0.06 })); },
  lift() { tone(330, 0.16, { to: 660, type: 'triangle', vol: 0.1 }); hiss(0.12, { freq: 2200, vol: 0.08 }); },
  crunch() { for (let k = 0; k < 5; k++) hiss(0.04, { freq: 1800 + Math.random() * 2500, q: 2, vol: 0.18, at: k * 0.03 + Math.random() * 0.02 }); },
  brush() { hiss(0.18, { filter: 'highpass', freq: 2500, to: 6000, vol: 0.2 }); },
  shelve() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { vol: 0.06, at: i * 0.08 })); },
  reset() { tone(660, 0.18, { to: 220, type: 'triangle', vol: 0.08 }); },
};
function sfx(name) { if (SOUNDS[name]) SOUNDS[name](); }

// The lasting sounds, set every frame from what is happening in the game. Levels are 0..1.
function setLoops(level) {
  const c = sound.ctx;
  if (!c) return;
  for (const k in sound.loops) sound.loops[k].g.gain.setTargetAtTime((level[k] || 0) * (k === 'street' ? 0.05 : 0.22), c.currentTime, 0.06);
  // Bubbling: the sizzle wobbles in pitch, and burning adds pops.
  sound.loops.sizzle.f.frequency.setTargetAtTime(3200 + Math.random() * 1600, c.currentTime, 0.02);
  if (level.pops && Math.random() < level.pops) hiss(0.03, { freq: 700 + Math.random() * 600, q: 3, vol: 0.25 });
}

// A short cosy loop in C major pentatonic: square-wave melody over a triangle bass.
const TUNE = [
  [72, 0, 76, 0, 79, 76, 74, 0, 72, 0, 69, 72, 74, 0, 0, 0],
  [72, 0, 76, 0, 79, 81, 79, 0, 76, 0, 74, 76, 72, 0, 0, 0],
];
const BASS = [48, 55, 57, 52];
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

function updateMusic() {
  const c = sound.ctx;
  if (!c || !musicOn) return;
  const beat = 60 / 96 / 2; // eighth notes at 96 bpm
  while (sound.musicAt < c.currentTime + 0.25) {
    const t = sound.musicAt, s = sound.step, bar = (s / 16 | 0) % 4, note = TUNE[bar % 2][s % 16];
    const play = (f, dur, type, vol) => {
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(sound.music); o.start(t); o.stop(t + dur + 0.02);
    };
    if (note) play(midi(note), beat * 1.6, 'square', 0.035);
    if (s % 4 === 0) play(midi(BASS[bar]), beat * 3.5, 'triangle', 0.09);
    sound.musicAt += beat; sound.step++;
  }
}

function setSfx(on) {
  sfxOn = on; keep('bungeoppang-sfx', on);
  if (sound.fx) sound.fx.gain.setTargetAtTime(on ? 1 : 0, sound.ctx.currentTime, 0.05);
}
function setMusic(on) {
  musicOn = on; keep('bungeoppang-music', on);
  if (sound.music) {
    sound.music.gain.setTargetAtTime(on ? 0.5 : 0, sound.ctx.currentTime, 0.05);
    sound.musicAt = Math.max(sound.musicAt, sound.ctx.currentTime + 0.05);
  }
}
