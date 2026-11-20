'use strict';

// Stage layout in dots comes from tools/build-sprites.ps1.
const L = window.LAYOUT;
const { W, H } = L, CX = L.cx, CY = L.cy;
const TOP = L.top;                // the display rack sits above the stage, at negative y
const SHELF = { scale: 0.5, x0: 8, gap: 65, y: -56, max: 6 };
const HAND = { x: 11, y: 0 };     // fingertip of the bare-hand cursor
const LID_GRAB = 70;              // shut, the lid is grabbed beyond this far from the hinge (its far end)
const MOLD_CRUMBS = 150, BRUSH_TAKE = 16, BRUSH_REACH = 60, BRUSH_MS = 180;
// The mold lies at an angle. u runs across it from hinge to handle, v along the fish from head to tail.
const UX = Math.cos(L.angle * Math.PI / 180), UY = Math.sin(L.angle * Math.PI / 180);
const HINGE = { x: CX + L.hingeU * UX, y: CY + L.hingeU * UY };
const toMold = (x, y, o) => [(x - o.x) * UX + (y - o.y) * UY, (y - o.y) * UX - (x - o.x) * UY];
const toStage = (u, v, o) => [o.x + u * UX - v * UY, o.y + u * UY + v * UX];
const CENTER = { x: CX, y: CY };

// Everything you can pick up. spoutX/Y is where the contents leave the held icon; tilt is its lean while pouring.
const TOOLS = {
  cream: { ...L.tools.cream, sprite: 'creamPouch', icon: 'creamIcon', spoutX: 6, spoutY: 6, tilt: -50 },
  bean: { ...L.tools.bean, sprite: 'beanPouch', icon: 'beanIcon', spoutX: 6, spoutY: 6, tilt: -50 },
  kettle: { ...L.tools.kettle, sprite: 'kettle', icon: 'held', spoutX: 4, spoutY: 12, tilt: -20 },
  // Hook and brush are cut from the cup art, so each has its own highlight and hit area on the same spot.
  hook: { ...L.tools.cup, sprite: 'cupHook', icon: 'hookIcon', spoutX: 2, spoutY: 4, tilt: 0 },
  brush: { ...L.tools.cup, sprite: 'cupBrush', icon: 'brushIcon', spoutX: 24, spoutY: 4, tilt: 0 },
};
const pours = name => name === 'kettle' || name === 'cream' || name === 'bean';
const ANGLES = [180, 165, 150, 135, 120, 105, 90, 75, 60, 45, 30, 15, 0];
const LAST = ANGLES.length - 1;
const FOCAL = 800;                // perspective: the free edge grows as it swings toward you
const DOME = 16, THICK = 14;

// Zones under the batter. Only the right half holds batter; the left half just gets spattered.
const BG = 0, PLATE_R = 1, CAV_R = 2, PLATE_L = 3, CAV_L = 4;
const PLATE_FLOOR = 1.05;         // batter climbs out of the hollow past this level; looks full well before it
const RELIEF = 0.18;              // height of the fish pattern on the hollow's floor
const POUR_RATE = 7700;           // batter units per second
const MIN_POUR = 120;             // ms: a quick click still lets a little out
const FALL_MS = 280, FALL_DOTS = 18; // batter leaves the spout, lands this much later and lower
const FRONT_SPEED = 170;          // dots per second the thin film races outward
const MAX_SOURCES = 10;
const BOUNCE_MS = 220, SPARKLE_MS = 380;

// Fillings are thick pastes: they keep the shape of the rope you lay down instead of running.
const FILL_RATE = 17;             // height added per second at the middle of the rope
const FILL_SEEN = 0.12;           // thinner than this does not show
const FILL_REPOSE = 0.6;          // a pile steeper than this slumps
const FILL_LIFT = 0.12, FILL_LIFT_MAX = 0.5; // how much a pile raises the batter above it, kept under the plate so it can be buried
const COVER_SOLID = 0.34;         // batter this thick over filling hides it, leaving only the bump
const COVER_FULL = 0.7;           // a skin this thick clings to the filling instead of running off
const COVER_RATE = 0.65;          // thickness per second a steady pour lays on filling at 100%
const COVER_FADE = 0.32;          // extra thickness that hides the bump at 100%
const COVER_SPILL = 0.2;          // share of the pour that still reaches the mold while filling is being covered
const COVER_FLOOD = 0.15;         // how far batter must stand above filling before it spills onto it
const CREAM_KIND = 1, BEAN_KIND = 2;
const FILLS = {
  cream: {
    kind: CREAM_KIND, radius: 9.8,
    ramp: ['#a8690f', '#cf8f1c', '#eeb52f', '#f9d052', '#fde588', '#fff3bd'].map(hexColor),
  },
  bean: {
    kind: BEAN_KIND, radius: 9.2,
    ramp: ['#2a0b0e', '#471417', '#651f21', '#832e2b', '#a2433a'].map(hexColor),
  },
};
const CREAM_SHINE = hexColor('#fffbe6'), CREAM_FLECK = hexColor('#96651c');
const BEAN_SKIN = hexColor('#c47560'), BEAN_DARK = hexColor('#1f080a');

function hexColor(s) {
  const n = parseInt(s.slice(1), 16);
  return (0xff000000 | (n & 255) << 16 | (n >> 8 & 255) << 8 | n >> 16) >>> 0;
}
const hex = hexColor;
const CREAM = hex('#f3e4bd'), CREAM_LIT = hex('#fbf1d4'), TAN = hex('#dcc48f'), DOT_LOW = hex('#c4aa78');
const BAND_DARK = hex('#120b09'), BAND_EDGE = hex('#2a1712');
const BAND_IN = hex('#241511'), BAND_IN_EDGE = hex('#3a2318'), BAND_SEAM_LIT = hex('#9a6848'), BAND_RIM = hex('#6b4030');
const SMOKE_WHITE = ['#fff4e0', '#efe2cc', '#bfae98', '#7d6b5a'];
const SMOKE_GRAY = ['#6a6764', '#5a5754', '#4a4643', '#3c3734'];
const SMOKE_BLACK = ['#0d0a0a', '#141010', '#1c1716', '#26201d'];
// How the smoke changes as the bread cooks. until is in seconds; big, gray and black are shares of new dots.
const SMOKE_PHASES = [
  { until: 4, rate: 50, big: 0, gray: 0, black: 0 },
  { until: 7, rate: 38, big: 0.18, gray: 0, black: 0 },
  { until: 11, rate: 38, big: 0.18, gray: 0.3, black: 0 },
  { until: Infinity, rate: 60, big: 0.6, gray: 0.15, black: 0.85 },
];
const COOK_SECONDS = 7;           // test length of the timer
const STEAM_MS = 6000;            // how long fresh bread steams after opening
// Results by cook time, same stage bounds as the smoke. Thin overflow runs a little ahead of the bread.
const RESULTS = [
  // ramp must match the palettes in tools/build-result.ps1: toast steps along it, dark to light.
  { sprite: 'seared', crust: ['#7c2a09', '#a03a0d', '#b84a12', '#cc5c1a', '#dc7424'], steam: 8, toast: 0.6,
    ramp: ['#6e2408', '#8c300b', '#a8400f', '#c04f14', '#d2631c', '#e07a28', '#e8913a', '#efa650', '#f4bc6c'] },
  { sprite: 'pale', crust: ['#a85c24', '#c97c3a', '#d8914c', '#e3a563', '#ecb87a'], steam: 16, toast: 0.6,
    ramp: ['#b5662a', '#c97c3a', '#d8914c', '#e3a563', '#ecb87a', '#f2c88f', '#f6d6a6', '#f9e1ba', '#fcecd0'] },
  { sprite: 'golden', crust: ['#a83a0a', '#c14e0f', '#d86519', '#e67b23', '#f4a444'], steam: 22, toast: 1,
    ramp: ['#9c3109', '#c14e0f', '#d86519', '#e67b23', '#ee8f31', '#f4a444', '#f9bb5a', '#fbca69', '#fcdf88'] },
  { sprite: 'burnt', crust: ['#0a0706', '#120d0b', '#1b1411', '#261b17', '#32241d'], steam: 22, toast: 1,
    ramp: ['#0a0706', '#120d0b', '#1b1411', '#261b17', '#32241d', '#422e24', '#54392b', '#664633', '#7a553c'] },
].map(r => {
  const ramp = r.ramp.map(hexColor);
  return { ...r, ramp, step: new Map(ramp.map((c, i) => [c, i])), crust: r.crust.map(hexColor), art: new Uint32Array(W * H) };
});
const TIMER = { x: 238, y: 64, r: 27 };
// Turning the shut mold over along its own axis, handle end toward the hinge.
const FLIP = { thick: 28, step: 15, drag: 140, arrow: 104 }; // drag: dots to pull for a full turn
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const EXP = Float32Array.from({ length: 1024 }, (_, i) => Math.exp(-i / 128));

const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const image = ctx.createImageData(W, H);
const px = new Uint32Array(image.data.buffer);

const zone = new Uint8Array(W * H);
const relief = new Float32Array(W * H);    // 0 = deepest groove, 1 = highest ridge of the fish
const floorH = new Float32Array(W * H);
const batter = new Float32Array(W * H);
const delta = new Float32Array(W * H);
const baseArt = new Uint32Array(W * H);
const lidInArt = new Uint32Array(W * H);   // inside of the lid, lying open
const lidOutArt = new Uint32Array(W * H);  // outside of the lid, closed
// The open lid runs off the stage, so its art lives on a wider canvas: PAD extra dots left and below.
const PAD = L.lidPad, LID_W = W + PAD, LID_H = H + PAD;
const lidSpot = i => (i / W | 0) * LID_W + i % W + PAD;
const lidInView = new Uint32Array(LID_W * LID_H);  // inside of the lid with its batter painted on
const cavIndex = new Int32Array(W * H).fill(-1);
const fillH = new Float32Array(W * H);     // height of filling
const fillDelta = new Float32Array(W * H);
const fillKind = new Uint8Array(W * H);
const fillView = new Uint32Array(W * H);   // filling colours, repainted only when it changes
const fillShadow = new Uint8Array(W * H);
const fillWas = new Uint8Array(W * H);     // which dots held filling at the last repaint
const fillLight = new Float32Array(W * H); // how each dot of filling faces the light, for the bump under batter
const buried = new Float32Array(W * H);    // batter trapped under filling; batter[] above filling is the covering layer
const raised = new Float32Array(W * H);    // what filling and trapped batter add to the floor
const grain = new Float32Array(W * H);     // per-dot noise
const blotch = new Float32Array(W * H);    // soft noise a few dots across
let cavList = [], frames = [], rim = [], flipFrames = [];
const closedArt = new Uint32Array(W * H);  // the whole shut mold, for turning over
const bakedView = new Uint32Array(W * H);  // what the batter turned into
const bgArt = new Uint32Array(W * H);      // the plate and counter behind everything
const behindHinge = new Uint8Array(W * H); // dots the open lid owns, not the bottom half
const reach = { x0: W, y0: H, x1: 0, y1: 0 }; // bounding box of the batter-holding half
const crumbView = new Uint32Array(W * H);  // what the last bread left behind in the mold
const toastMap = new Float32Array(W * H);  // this bread's own hot spots, kept for as long as it lasts
let bakedCells = [];
const lidInSource = new Uint32Array(LID_W * LID_H); // the whole open lid, hinge tab included, for the turning frames
const art = {};

const state = {
  frame: 0, playing: null, playT: 0, playFrom: 0, playTo: 0, playMs: 0, loopWait: 0,
  held: null, pouring: false, pourUntil: 0, flowing: false, hover: null, inside: false,
  ptr: { x: -99, y: -99, lastX: -99, lastY: -99 },
  drops: [], dropId: 0, sources: [], splash: [], impacts: [],
  bounce: { tool: null, at: -1e9 }, sparkles: [],
  fillDirty: false, fillMoving: false, coverSpeed: 0.7, fadeSpeed: 0.6,
  cooking: false, cook: 0, timerAge: 0,
  flips: 0, sideCook: [0, 0], baked: false, result: 0, toasted: false, steamUntil: 0, steamDebt: 0,
  flip: { angle: 0, turning: false, finishing: false, pull: 0, startX: 0, startY: 0 },
  smokeAt: Infinity, smokeDebt: 0, smoke: [],
  lid: null, bread: null, crumbs: [], shelf: [], moldCrumbs: [], brushAt: -1e9, timerEdit: false, timerDrag: false,
};

function loadImage(src) {
  return new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
}
function pixels(img) {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  return { w: img.width, h: img.height, p: new Uint32Array(g.getImageData(0, 0, img.width, img.height).data.buffer) };
}

function layOutArt(mold, cavity, lidIn, lid) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, near = toMold(x + 0.5, y + 0.5, HINGE)[0] >= 0;
    behindHinge[i] = near ? 0 : 1;
    if (mold.p[i] >>> 24) {
      baseArt[i] = mold.p[i];
      // Open, the two halves meet at the hinge line, so each only owns its own side of it.
      if (near) {
        zone[i] = cavity.p[i] >>> 24 ? CAV_R : PLATE_R;
        reach.x0 = Math.min(reach.x0, x); reach.y0 = Math.min(reach.y0, y);
        reach.x1 = Math.max(reach.x1, x); reach.y1 = Math.max(reach.y1, y);
      }
    }
    const inner = lidIn.p[lidSpot(i)];
    if ((inner >>> 24) && !near) { lidInArt[i] = inner; zone[i] = PLATE_L; }
    if (lid.p[i] >>> 24) lidOutArt[i] = lid.p[i];
  }
  lidInSource.set(lidIn.p);
  lidInView.set(lidIn.p);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (lidOutArt[i] && !(lidOutArt[i - 1] && lidOutArt[i + 1] && lidOutArt[i - W] && lidOutArt[i + W])) rim.push(i);
  }
}

// The art is lit from above, so brightness stands in for height: pale ridges, dark grooves.
function buildRelief() {
  const lum = c => (c & 255) * 0.3 + (c >> 8 & 255) * 0.59 + (c >> 16 & 255) * 0.11;
  const soft = new Float32Array(W * H);
  cavList = [];
  for (let i = 0; i < W * H; i++) {
    if (zone[i] === PLATE_R) floorH[i] = PLATE_FLOOR;
    if (zone[i] !== CAV_R) continue;
    cavIndex[i] = cavList.length;
    cavList.push(i);
    let s = 0, n = 0;
    for (const j of [i, i - 1, i + 1, i - W, i + W]) if (zone[j] === CAV_R) { s += lum(baseArt[j]) * (j === i ? 2 : 1); n += j === i ? 2 : 1; }
    soft[i] = s / n;
  }
  let mean = 0, sq = 0;
  for (const i of cavList) mean += soft[i];
  mean /= cavList.length;
  for (const i of cavList) sq += (soft[i] - mean) ** 2;
  const sd = Math.sqrt(sq / cavList.length);
  for (const i of cavList) {
    relief[i] = Math.max(0, Math.min(1, (soft[i] - mean) / (2.4 * sd) + 0.5));
    floorH[i] = relief[i] * RELIEF;
  }
}

// How far the outer face bulges at a point of the closed lid, in mold coordinates from the hinge.
function domeAt(u, v) {
  const a = (u + L.hingeU * -1) / 88, b = v / 118, r = a * a + b * b;
  return r < 1 ? DOME * (1 - r) : 0;
}

// Pixels that lie just past the face along (dx,dy) show the rim seen edge-on.
function paintRim(f, t, dx, dy, color) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (f.map[i] >= 0) continue;
    for (let k = 1; k <= t; k++) {
      const px = Math.round(x - k * dx), py = Math.round(y - k * dy);
      if (px < 0 || py < 0 || px >= W || py >= H || f.map[py * W + px] < 0) continue;
      f.band[i] = color(k, t);
      break;
    }
  }
}

// For one angle, work out which art pixel lands on each stage pixel, plus the rim seen edge-on.
function bakeFrame(angle) {
  const f = { angle, map: new Int32Array(W * H).fill(-1), band: new Uint32Array(W * H), shade: 1 };
  if (angle === 0 || angle === 180) {
    const src = angle ? lidInArt : lidOutArt;
    for (let i = 0; i < W * H; i++) if (src[i]) f.map[i] = angle ? lidSpot(i) : i;
    return f;
  }
  const rad = angle * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad);
  f.shade = 0.74 + 0.26 * Math.abs(c);
  if (angle === 90) return bakeEdgeOn(f, HINGE, 1.12);
  const outer = angle < 90;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [X, V] = toMold(x + 0.5, y + 0.5, HINGE);
    let shift = 0, su = 0, sv = 0, ok = false;
    for (let pass = 0; pass < (outer ? 3 : 1); pass++) {
      const Xs = X + shift, den = c * FOCAL + Xs * s;
      if (outer ? den <= 0 : den >= 0) { ok = false; break; }
      const d = Xs * FOCAL / den, scale = FOCAL / (FOCAL - d * s);
      su = outer ? d : -d; sv = V / scale; ok = true;
      if (outer) shift = domeAt(su, sv) * s;
    }
    if (!ok) continue;
    const [fx, fy] = toStage(su, sv, HINGE), sx = Math.floor(fx), sy = Math.floor(fy);
    if (outer) {
      if (sx >= 0 && sx < W && sy >= 0 && sy < H && lidOutArt[sy * W + sx]) f.map[y * W + x] = sy * W + sx;
    } else if (sx >= -PAD && sx < W && sy >= 0 && sy < LID_H) {
      const spot = sy * LID_W + sx + PAD;
      if (lidInSource[spot]) f.map[y * W + x] = spot;
    }
  }
  const dir = outer ? 1 : -1, dark = outer ? BAND_DARK : BAND_IN, edge = outer ? BAND_EDGE : BAND_IN_EDGE;
  paintRim(f, Math.round(THICK * s), UX * dir, UY * dir, (k, t) => (k === t ? edge : dark));
  return f;
}

// Edge-on the face disappears and only the side art shows, turned to lie along the mold's axis.
function bakeEdgeOn(f, origin, scale) {
  const side = art.side, w = side.w * scale, h = side.h * scale;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [u, v] = toMold(x + 0.5, y + 0.5, origin);
    const sx = Math.floor((u + w / 2) / scale), sy = Math.floor((v + h / 2) / scale);
    if (sx < 0 || sy < 0 || sx >= side.w || sy >= side.h) continue;
    const p = side.p[sy * side.w + sx];
    if (p >>> 24) f.band[y * W + x] = p;
  }
  return f;
}

// One angle of the shut mold turning over. The handle end swings toward you and across to the
// hinge end. Past 90 degrees the far face comes up: the art is the same on both faces, so only
// the near edge and the rim swap sides.
function bakeFlipFrame(angle) {
  const f = { map: new Int32Array(W * H).fill(-1), band: new Uint32Array(W * H), shade: 1 };
  const a = angle <= 90 ? angle : 180 - angle, dir = angle <= 90 ? 1 : -1;
  if (a === 0) {
    for (let i = 0; i < W * H; i++) if (closedArt[i]) f.map[i] = i;
    return f;
  }
  const rad = a * Math.PI / 180, c = Math.cos(rad), s = Math.sin(rad) * dir;
  f.shade = 0.74 + 0.26 * c;
  if (a === 90) return bakeEdgeOn(f, CENTER, 1.12);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const [X, V] = toMold(x + 0.5, y + 0.5, CENTER), den = c * FOCAL + X * s;
    if (den <= 0) continue;
    const d = X * FOCAL / den, scale = FOCAL / (FOCAL - d * s);
    const [fx, fy] = toStage(d, V / scale, CENTER), sx = Math.floor(fx), sy = Math.floor(fy);
    if (sx < 0 || sx >= W || sy < 0 || sy >= H) continue;
    if (closedArt[sy * W + sx]) f.map[y * W + x] = sy * W + sx;
  }
  // The rim shows on the edge swinging toward you, with the seam where the two halves meet.
  const t = Math.round(FLIP.thick * Math.abs(s)), seam = t >> 1;
  paintRim(f, t, UX * dir, UY * dir, k => (k === t || k === seam ? BAND_DARK : k === seam + 1 || k === 1 ? BAND_SEAM_LIT : BAND_RIM));
  return f;
}

const bayerAt = i => BAYER[(((i / W) | 0) & 3) * 4 + (i % W & 3)];

function batterColor(i) {
  const h = batter[i], z = zone[i];
  if (state.baked && state.result > 0 && rightSide(z)) return 0; // the first stage is still raw inside
  if (h < 0.01) return 0;
  if (z === BG || z === PLATE_L || z === CAV_L) return h > 0.7 ? CREAM : h > 0.1 ? TAN : 0;
  if (z === PLATE_R) {
    if (h >= 0.16) return TAN;
    return h / 0.16 > bayerAt(i) ? TAN : 0;
  }
  // Ridges poke through first, so the same film looks thinner on them and the fish stays readable.
  const e = h * (1 - 0.55 * relief[i] * Math.max(0, 1 - h / 0.42));
  if (e < 0.3) {
    if (Math.pow(e / 0.3, 0.85) < bayerAt(i)) return 0;
    return e < 0.11 ? DOT_LOW : TAN;
  }
  if (e < 0.4) return TAN;
  if (e < 0.5) return (e - 0.4) / 0.1 > bayerAt(i) ? CREAM : TAN;
  return CREAM;
}

// Smooth random patches, cell dots across, as a function of x and y.
function softNoise(cell) {
  const gw = Math.ceil(W / cell) + 2, gh = Math.ceil(H / cell) + 2;
  const grid = Float32Array.from({ length: gw * gh }, () => Math.random());
  return (x, y) => {
    const gx = x / cell | 0, gy = y / cell | 0, u = x / cell - gx, v = y / cell - gy, g = gy * gw + gx;
    return (grid[g] * (1 - u) + grid[g + 1] * u) * (1 - v) + (grid[g + gw] * (1 - u) + grid[g + gw + 1] * u) * v;
  };
}

function buildNoise() {
  const soft = softNoise(8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    blotch[y * W + x] = soft(x, y);
    grain[y * W + x] = Math.random();
  }
}

const rampAt = (ramp, light, i) => ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(light * ramp.length + (bayerAt(i) - 0.5) * 0.7)))];

// Red bean paste: dark and matte, gritty up close, with flecks of skin and small pockets.
function beanColor(i, light, edge) {
  const { ramp } = FILLS.bean;
  if (edge) return ramp[light > 0.6 ? 1 : 0];
  if (grain[i] > 0.955 && light > 0.35) return BEAN_SKIN;
  if (grain[i] < 0.03) return BEAN_DARK;
  const lumps = (blotch[i + 1] - blotch[i - 1] + blotch[i + W] - blotch[i - W]) * 2.6;
  return rampAt(ramp, light - 0.1 + lumps + (grain[i] - 0.5) * 0.3, i);
}

// Custard: silky folds that catch soft highlights, with a few vanilla flecks.
function creamColor(i, light, edge) {
  const { ramp } = FILLS.cream;
  if (edge) return ramp[light > 0.6 ? 1 : 0];
  const x = i % W, y = i / W | 0;
  const fold = Math.sin(x * 0.38 + y * 0.27 + blotch[i] * 9 + fillH[i] * 0.9);
  const l = light - 0.04 + fold * 0.17 + (blotch[i] - 0.5) * 0.14;
  if (l > 0.84 && fold > 0.8) return CREAM_SHINE;
  if (grain[i] > 0.988) return CREAM_FLECK;
  return rampAt(ramp, l, i);
}

function fillColor(i) {
  const h = fillH[i];
  if (h < FILL_SEEN) return 0;
  const edge = fillH[i - 1] < FILL_SEEN || fillH[i + 1] < FILL_SEEN || fillH[i - W] < FILL_SEEN || fillH[i + W] < FILL_SEEN;
  // Lit from the top left: a surface rising to the right and down faces the light.
  // Steep piles are compressed so they roll off softly instead of blowing out.
  const slope = (fillH[i + 2] - fillH[i - 2]) + (fillH[i + 2 * W] - fillH[i - 2 * W]);
  const light = 0.5 + 0.3 * slope / (1 + Math.abs(slope) * 0.9);
  fillLight[i] = light;
  return fillKind[i] === BEAN_KIND ? beanColor(i, light, edge) : creamColor(i, light, edge);
}

function repaintFill() {
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x, c = fillColor(i);
    fillView[i] = c;
    fillShadow[i] = !c && (fillH[i - W - 1] >= FILL_SEEN || fillH[i - 2 * W - 2] >= FILL_SEEN) ? 1 : 0;
    // Filling that slumps onto a new dot slides under the batter there; none of that is a covering.
    if (c && !fillWas[i]) { buried[i] += batter[i]; batter[i] = 0; }
    fillWas[i] = c ? 1 : 0;
    // If the filling slid away, whatever it was sitting on is back in play.
    if (!c && buried[i] > 0) { batter[i] += buried[i]; buried[i] = 0; state.flowing = true; }
    raised[i] = buried[i] + Math.min(FILL_LIFT_MAX, fillH[i] * FILL_LIFT);
  }
  state.fillDirty = false;
}

// Batter lying on filling: dots of it at first, then a skin that still shows the shape underneath.
function coverColor(i, fill) {
  const c = batter[i];
  if (c < 0.02) return fill;
  if (c < COVER_SOLID) {
    if (Math.pow(c / COVER_SOLID, 0.85) < bayerAt(i)) return fill;
    return c < 0.12 ? DOT_LOW : TAN;
  }
  const bump = Math.max(0, 1 - (c - COVER_SOLID) * state.fadeSpeed / COVER_FADE), light = fillLight[i];
  if (bump > 0.55 && light < 0.36) return DOT_LOW;
  if (bump > 0.2 && light < 0.46) return TAN;
  if (bump > 0.3 && light > 0.6) return CREAM_LIT;
  return c < 0.42 ? TAN : CREAM;
}

function withFill(i, c) {
  if (state.baked && bakedView[i]) return bakedView[i];
  const f = fillView[i];
  if (f) return rightSide(zone[i]) ? coverColor(i, f) : batterColor(i) || f;
  return fillShadow[i] && batter[i - W - 1] < COVER_SOLID && batter[i - 2 * W - 2] < COVER_SOLID ? shadeColor(c, 0.66) : c;
}

function shadeColor(c, k) {
  if (k === 1) return c;
  const r = (c & 255) * k, g = (c >> 8 & 255) * k, b = (c >> 16 & 255) * k;
  return (0xff000000 | b << 16 | g << 8 | r) >>> 0;
}

function drawLid(f, into, withBatter) {
  const src = f.angle < 90 ? lidOutArt : withBatter ? lidInView : lidInSource;
  for (let i = 0; i < W * H; i++) {
    const m = f.map[i];
    if (m >= 0) into[i] = shadeColor(src[m], f.shade);
    else if (f.band[i]) into[i] = f.band[i];
  }
}

function drawBase(into, withBatter, open) {
  for (let i = 0; i < W * H; i++) {
    const c = baseArt[i];
    if (!c || (open && behindHinge[i])) continue;
    const mine = withBatter && (zone[i] === PLATE_R || zone[i] === CAV_R);
    const under = (mine && (batterColor(i) || crumbView[i])) || c;
    into[i] = mine ? withFill(i, under) : under;
  }
}

function composite(into, f, withBatter) {
  into.set(bgArt);
  if (withBatter) {
    for (let i = 0; i < W * H; i++) {
      if (zone[i] === BG) into[i] = withFill(i, (batter[i] > 0 && batterColor(i)) || bgArt[i]);
      if (zone[i] === PLATE_L || zone[i] === CAV_L) lidInView[lidSpot(i)] = withFill(i, batterColor(i) || lidInArt[i]);
    }
  }
  if (f.angle > 90) { drawLid(f, into, withBatter); drawBase(into, withBatter, true); }
  else { drawBase(into, withBatter, false); drawLid(f, into, withBatter); }
}

function compositeFlip(into, f) {
  into.set(bgArt);
  for (let i = 0; i < W * H; i++) {
    if (zone[i] === BG) into[i] = withFill(i, (batter[i] > 0 && batterColor(i)) || bgArt[i]);
  }
  for (let i = 0; i < W * H; i++) {
    const m = f.map[i];
    if (m >= 0) into[i] = shadeColor(closedArt[m], f.shade);
    else if (f.band[i]) into[i] = f.band[i];
  }
}

function drawTool(name, now) {
  const tool = TOOLS[name], a = art[name];
  const t = state.bounce.tool === name ? (now - state.bounce.at) / BOUNCE_MS : 2;
  const bouncing = t >= 0 && t < 1, hovered = state.hover === name;
  const grow = bouncing ? Math.round(Math.sin(t * Math.PI) * 4) : 0;
  const x = tool.x - grow, y = tool.y - grow, w = a.w + grow * 2, h = a.h + grow * 2;
  if (hovered && !bouncing) ctx.drawImage(a.glow, tool.x - 1, tool.y - 1);
  ctx.globalAlpha = hovered || bouncing ? 1 : 0.85;
  ctx.drawImage(a.sprite, x, y, w, h);
  if (bouncing) {
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.drawImage(a.flash, x, y, w, h);
  }
  ctx.globalAlpha = 1;
}

function drawSparkles(now) {
  ctx.fillStyle = '#fff6c8';
  for (const s of state.sparkles) {
    const p = (now - s.at) / SPARKLE_MS;
    if (p < 0 || p >= 1) continue;
    const r = p < 0.5 ? 2 : 1;
    ctx.fillRect(s.x - r, s.y, r * 2 + 1, 1);
    ctx.fillRect(s.x, s.y - r, 1, r * 2 + 1);
  }
}

function drawHeldTool() {
  const { y } = state.ptr, tool = TOOLS[state.held], a = art[state.held];
  const swept = performance.now() - state.brushAt;
  const x = state.ptr.x + (state.held === 'brush' && swept < BRUSH_MS ? Math.round(Math.sin(swept / 18) * 6) : 0);
  if (pouringNow()) ctx.drawImage(a.tilted.c, x - a.tilted.spoutX, y - a.tilted.spoutY);
  else ctx.drawImage(a.icon, x - tool.spoutX, y - tool.spoutY);
}

const css = c => '#' + [c & 255, c >> 8 & 255, c >> 16 & 255].map(v => v.toString(16).padStart(2, '0')).join('');

// A falling length of paste: inked sides, a lumpy middle that travels down with it, a lit left edge.
function drawRopeSlice(d, y) {
  const { ramp } = FILLS[d.tool], r = 6, mid = ramp.length >> 1;
  ctx.fillStyle = css(ramp[0]);
  ctx.fillRect(d.x - r, y, r * 2 + 1, 7);
  ctx.fillStyle = css(ramp[mid + (d.id * 7 % 3) - 1]);
  ctx.fillRect(d.x - r + 1, y, r * 2 - 1, 7);
  ctx.fillStyle = css(ramp[ramp.length - 2]);
  ctx.fillRect(d.x - 3, y, 2, 7);
}

function drawBatterInFlight(now) {
  for (const d of state.drops) {
    const p = (now - d.born) / FALL_MS, y = Math.round(d.y + FALL_DOTS * p * p);
    if (d.tool === 'kettle') { ctx.fillStyle = '#f7ebc8'; ctx.fillRect(d.x, y, 1, 1); }
    else drawRopeSlice(d, y);
  }
  // Where the stream hits, fresh batter sits proud and bright for a moment.
  ctx.fillStyle = '#fff8e0';
  for (const m of state.impacts) {
    const r = m.age < 0.06 ? 3 : 2;
    ctx.fillRect(m.x - r, m.y, r * 2 + 1, 1);
    ctx.fillRect(m.x, m.y - r, 1, r * 2 + 1);
  }
  ctx.fillStyle = '#e9d6a6';
  for (const s of state.splash) ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
}

function draw(now) {
  if (state.fillDirty) repaintFill();
  if (state.flip.angle > 0) compositeFlip(px, flipFrames[Math.round(state.flip.angle / FLIP.step)]);
  else composite(px, frames[state.frame], true);
  ctx.putImageData(image, 0, TOP);
  ctx.save();
  ctx.translate(0, TOP);
  ctx.drawImage(art.shelf, 0, -TOP);
  drawShelf();
  ctx.globalAlpha = 0.85;
  ctx.drawImage(art.cup, L.tools.cup.x, L.tools.cup.y);
  ctx.globalAlpha = 1;
  for (const name in TOOLS) drawTool(name, now);
  drawSparkles(now);
  drawBread();
  drawBatterInFlight(now);
  for (const p of state.smoke) {
    ctx.fillStyle = p.ramp[Math.min(p.ramp.length - 1, Math.floor(p.age / p.life * p.ramp.length))];
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  drawFlipPrompt(now);
  drawTimer();
  for (const c of state.crumbs) { ctx.fillStyle = c.color; ctx.fillRect(Math.round(c.x), Math.round(c.y), c.size, c.size); }
  if (state.held && (state.inside || pouringNow())) drawHeldTool();
  else if (!state.held && state.inside) ctx.drawImage(art.hand, state.ptr.x - HAND.x, state.ptr.y - HAND.y);
  ctx.restore();
}

// ---- batter ----

const pouringNow = () => pours(state.held) && state.frame === 0 && !state.playing && !state.baked && (state.pouring || performance.now() < state.pourUntil);

function emit(now, dt) {
  const p = state.ptr, steps = Math.max(1, Math.ceil(Math.hypot(p.x - p.lastX, p.y - p.lastY) / 2));
  for (let s = 1; s <= steps; s++) {
    state.drops.push({
      x: Math.round(p.lastX + (p.x - p.lastX) * s / steps),
      y: Math.round(p.lastY + (p.y - p.lastY) * s / steps),
      born: now, tool: state.held, id: state.dropId++,
      amount: (state.held === 'kettle' ? POUR_RATE : FILL_RATE) * dt / steps,
    });
  }
  p.lastX = p.x; p.lastY = p.y;
}

function updateDrops(now) {
  while (state.drops.length && now - state.drops[0].born >= FALL_MS) {
    const d = state.drops.shift();
    if (d.tool === 'kettle') land(d.x, d.y + FALL_DOTS, d.amount);
    else {
      // Paste folds over itself as it lands, so a held pour coils instead of stacking in one spot.
      const wx = Math.sin(d.id * 0.31) * 5, wy = Math.cos(d.id * 0.23) * 5;
      layFilling(Math.round(d.x + wx), Math.round(d.y + FALL_DOTS + wy), FILLS[d.tool], d.amount);
    }
  }
}

// Paste lands as a rounded bead. Beads overlap into a rope, and a fast hand lays a thinner one.
function layFilling(x, y, fill, amount) {
  const margin = 14;
  if (x < margin || y < margin || x >= W - margin || y >= H - margin || state.frame > 5) return;
  const r = fill.radius * (0.92 + blotch[y * W + x] * 0.16), R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d2 = (dx * dx + dy * dy) / (r * r);
    if (d2 >= 1) continue;
    const i = (y + dy) * W + x + dx, dome = Math.sqrt(1 - d2);
    fillH[i] += amount * dome;
    // Fresh filling sits on top of whatever batter was here.
    buried[i] += batter[i]; batter[i] = 0;
    raised[i] = buried[i] + Math.min(FILL_LIFT_MAX, fillH[i] * FILL_LIFT);
    if (dome > 0.3 || !fillKind[i]) fillKind[i] = fill.kind;
  }
  state.fillDirty = state.fillMoving = true;
}

const leftSide = z => z === PLATE_L || z === CAV_L;
const rightSide = z => z === PLATE_R || z === CAV_R;

function slumpPair(a, b, reach) {
  const diff = fillH[a] - fillH[b];
  // Uneven paste holds a slope here and lets go there, which keeps the pile lumpy.
  const repose = FILL_REPOSE * reach * (0.65 + blotch[a] * 0.7);
  if (Math.abs(diff) < repose) return 0;
  const za = zone[a], zb = zone[b];
  if ((leftSide(za) && rightSide(zb)) || (rightSide(za) && leftSide(zb))) return 0;
  const q = (diff - Math.sign(diff) * repose) * 0.12;
  fillDelta[a] -= q; fillDelta[b] += q;
  if (fillH[b] < FILL_SEEN && q > 0) fillKind[b] = fillKind[a];
  if (fillH[a] < FILL_SEEN && q < 0) fillKind[a] = fillKind[b];
  return Math.abs(q);
}

// A pile only spreads once it is too steep to hold itself up.
function slumpFilling() {
  let moved = 0;
  for (let it = 0; it < 2; it++) {
    fillDelta.fill(0);
    for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
      const i = y * W + x;
      if (fillH[i] <= 0 && fillH[i + 1] <= 0 && fillH[i + W] <= 0 && fillH[i + W + 1] <= 0 && fillH[i + W - 1] <= 0) continue;
      moved += slumpPair(i, i + 1, 1) + slumpPair(i, i + W, 1) + slumpPair(i, i + W + 1, 1.41) + slumpPair(i, i + W - 1, 1.41);
    }
    for (let i = 0; i < W * H; i++) if (fillDelta[i]) fillH[i] += fillDelta[i];
  }
  state.fillDirty = true;
  if (moved < 0.02 && !state.drops.length) state.fillMoving = false;
}

function land(x, y, amount) {
  if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3 || state.frame > 5) return;
  const z = zone[y * W + x];
  state.impacts.push({ x, y, age: 0 });
  if (Math.random() < 0.35) {
    const a = Math.random() * 6.283, v = 12 + Math.random() * 16;
    state.splash.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0 });
  }
  if (z === CAV_R) addSource(x, y, amount);
  else if (z === PLATE_R) stampPlate(x, y, amount);
  else spatter(x, y, amount, z === BG ? 3.6 : 4.6);
}

// Off the hollow it does not run: it lands as rough blobs, which is what lets you draw with it.
function spatter(x, y, amount, radius) {
  const n = Math.ceil(22 * amount / (POUR_RATE / 60) * (radius > 4 ? 0.5 : 1));
  for (let k = 0; k < n; k++) {
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * radius;
    const i = Math.round(y + Math.sin(a) * r) * W + Math.round(x + Math.cos(a) * r);
    if (zone[i] !== PLATE_R && zone[i] !== CAV_R) batter[i] = Math.min(1, batter[i] + 0.4);
  }
}

function stampPlate(x, y, amount) {
  const R = 5, cells = [];
  let sum = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    const d2 = dx * dx + dy * dy, i = (y + dy) * W + x + dx;
    if (d2 > R * R || (zone[i] !== PLATE_R && zone[i] !== CAV_R)) continue;
    const w = 1 - d2 / (R * R + 1);
    cells.push(i, w); sum += w;
  }
  for (let k = 0; k < cells.length; k += 2) batter[cells[k]] += amount * cells[k + 1] / sum;
  state.flowing = true;
}

// Step distance from a landing point, walking only inside the hollow: that is what gives the
// diamond front, and why the tail, behind its narrow neck, fills last.
function walkHollow(start) {
  const dist = new Uint16Array(cavList.length).fill(65535), queue = new Int32Array(cavList.length);
  let head = 0, tail = 0;
  dist[cavIndex[start]] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++], d = dist[cavIndex[i]] + 1;
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      const n = cavIndex[j];
      if (n >= 0 && dist[n] === 65535) { dist[n] = d; queue[tail++] = j; }
    }
  }
  return dist;
}

function addSource(x, y, amount) {
  const s = state.sources[state.sources.length - 1];
  if (s && Math.hypot(s.x - x, s.y - y) < 6) { s.pending += amount; s.landing = true; return; }
  if (state.sources.length >= MAX_SOURCES) release(state.sources.shift(), Infinity, 1);
  state.sources.push({ x, y, pending: amount, age: 0, landing: true, dist: walkHollow(y * W + x) });
  state.flowing = true;
}

// Hand part of a source's batter to the hollow: a thick mound where it lands, plus a thin film
// racing out from it. Grooves catch more of the film than ridges.
function release(s, limit, keep) {
  const take = limit === Infinity ? s.pending : s.pending * 0.2;
  const spread = Math.min(62, 22 + s.age * 46), k = 128 / spread, kMound = 128 / 12;
  const front = limit === Infinity ? 65534 : limit;
  const share = (d, i) => (EXP[Math.min(1023, d * k | 0)] + 3 * EXP[Math.min(1023, d * kMound | 0)]) * (1 - 0.6 * relief[i]);
  let sum = 0;
  for (let n = 0; n < cavList.length; n++) {
    const d = s.dist[n];
    if (d <= front) sum += share(d, cavList[n]);
  }
  if (sum <= 0) return;
  const unit = take * keep / sum;
  for (let n = 0; n < cavList.length; n++) {
    const d = s.dist[n];
    if (d <= front) batter[cavList[n]] += unit * share(d, cavList[n]);
  }
  s.pending -= take;
}

// A steady pour lays its skin over bare filling at a set pace, nearest first. Returns how many
// dots it worked on: while there are any, the mold's level should barely move.
function coverFilling(s, limit, dt) {
  const front = limit + 92, rate = COVER_RATE * state.coverSpeed * dt;
  let working = 0;
  for (let n = 0; n < cavList.length; n++) {
    const i = cavList[n], d = s.dist[n];
    if (d > front || fillH[i] < FILL_SEEN || batter[i] >= COVER_FULL) continue;
    batter[i] += rate * (0.35 + 0.65 * EXP[Math.min(1023, d * 128 / 46 | 0)]);
    working++;
  }
  return working;
}

function updateSources(dt) {
  const list = state.sources, newest = list[list.length - 1];
  // Only batter that is landing right now covers; what is left of a finished pour just settles.
  const covering = newest && newest.landing && coverFilling(newest, 25 + newest.age * FRONT_SPEED, dt) > 0;
  if (newest) newest.landing = false;
  for (const s of list) {
    s.age += dt;
    release(s, 25 + s.age * FRONT_SPEED, covering ? COVER_SPILL : 1);
  }
  state.sources = list.filter(s => s.pending > 0.3);
}

const holdsBatter = z => z === PLATE_R || z === CAV_R;

function flowPair(a, b) {
  const za = zone[a], zb = zone[b];
  if (!holdsBatter(za) || !holdsBatter(zb)) return 0;
  const ha = batter[a], hb = batter[b];
  if (ha <= 0 && hb <= 0) return 0;
  const onA = fillH[a] >= FILL_SEEN, onB = fillH[b] >= FILL_SEEN, bothOn = onA && onB;
  // Across a pile the skin evens out by thickness, wherever the pile sits.
  const diff = bothOn ? ha - hb : floorH[a] + raised[a] + ha - floorH[b] - raised[b] - hb;
  const plate = !bothOn && (za === PLATE_R || zb === PLATE_R);
  if (Math.abs(diff) < (plate ? 0.1 : 0.012)) return 0;
  // Standing batter does not creep up onto filling; only a real flood climbs over it.
  if (!bothOn && (diff > 0 ? onB : onA) && Math.abs(diff) < COVER_FLOOD) return 0;
  // A thin film barely creeps; a thick one levels itself out.
  const giver = diff > 0 ? ha : hb;
  const clinging = !bothOn && (diff > 0 ? onA : onB) ? COVER_FULL : 0;
  if (giver <= clinging) return 0;
  let q = diff * 0.22 * Math.min(1, giver / 0.3);
  q = q > 0 ? Math.min(q, (ha - clinging) * 0.24) : Math.max(q, -(hb - clinging) * 0.24);
  delta[a] -= q; delta[b] += q;
  return Math.abs(q);
}

function flow() {
  let moved = 0;
  for (let it = 0; it < 12; it++) {
    delta.fill(0);
    for (let y = reach.y0; y <= reach.y1; y++) for (let x = reach.x0; x <= reach.x1; x++) {
      const i = y * W + x;
      moved += flowPair(i, i + 1) + flowPair(i, i + W);
    }
    for (let y = reach.y0; y <= reach.y1 + 1; y++) for (let x = reach.x0; x <= reach.x1 + 1; x++) {
      const i = y * W + x;
      if (delta[i]) batter[i] += delta[i];
    }
  }
  if (moved < 0.5 && !state.sources.length && !state.drops.length) state.flowing = false;
}

function updateSpray(dt) {
  for (const m of state.impacts) m.age += dt;
  state.impacts = state.impacts.filter(m => m.age < 0.1);
  for (const s of state.splash) { s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 60 * dt; }
  state.splash = state.splash.filter(s => s.age < 0.22);
}

function hasBatter() {
  let sum = 0;
  for (const i of cavList) sum += batter[i] + buried[i];
  return sum > 8;
}

// ---- smoke ----

const smokePhase = () => SMOKE_PHASES.find(p => state.cook < p.until);

function puffSmoke(phase) {
  const i = rim[Math.random() * rim.length | 0], roll = Math.random();
  const ramp = roll < phase.black ? SMOKE_BLACK : roll < phase.black + phase.gray ? SMOKE_GRAY : SMOKE_WHITE;
  const size = Math.random() < phase.big ? 3 : 2;
  state.smoke.push({
    x: i % W, y: (i / W) | 0, ramp, size,
    vy: -(7 + Math.random() * 11) * (size > 1 ? 0.7 : 1),
    sway: Math.random() * 6.283, age: 0, life: 1 + Math.random() * 1.2,
  });
}

function updateSmoke(now, dt) {
  const closed = state.frame === LAST && !state.playing;
  if (closed && now >= state.smokeAt) {
    const phase = smokePhase();
    state.smokeDebt += dt * phase.rate;
    while (state.smokeDebt >= 1) {
      state.smokeDebt--;
      puffSmoke(phase);
    }
  }
  for (const p of state.smoke) {
    p.age += dt;
    p.y += p.vy * dt;
    p.x += Math.sin(p.sway + p.age * 3) * 6 * dt + dt * 2;
  }
  state.smoke = state.smoke.filter(p => p.age < p.life);
}

// ---- baked result ----

const totalBatter = i => batter[i] + buried[i];
const overflowed = i => zone[i] === PLATE_R && totalBatter(i) >= 0.03;

// Overflow bakes thin and lacy: paler where it pooled, dark along its crisp edge.
function crustColor(i) {
  const h = totalBatter(i);
  if (h < 0.12 && h / 0.12 < bayerAt(i)) return 0;
  const edge = !overflowed(i - 1) && zone[i - 1] !== CAV_R || !overflowed(i + 1) && zone[i + 1] !== CAV_R
    || !overflowed(i - W) && zone[i - W] !== CAV_R || !overflowed(i + W) && zone[i + W] !== CAV_R;
  const { crust } = RESULTS[state.result];
  if (edge) return crust[0];
  return crust[Math.max(1, Math.min(crust.length - 1, Math.floor(1 + h * 5 + (blotch[i] - 0.5) * 2.4 + (bayerAt(i) - 0.5))))];
}

// The bread only exists where batter was: a short pour bakes a partial fish.
function breadColor(i) {
  // Judged on the neighbourhood: one thin dot on a ridge should not bake into a hole.
  let h = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) h += totalBatter(i + dy * W + dx);
  h /= 49;
  if (h < 0.05 || (h < 0.18 && (h - 0.05) / 0.13 < bayerAt(i))) return 0;
  if (fillH[i] >= FILL_SEEN && batter[i] < COVER_SOLID) return 0; // bare filling stays on show
  const { crust } = RESULTS[state.result];
  // Where overflow joins, the bread's dark edge gives way so the two read as one piece.
  for (const j of [i - 1, i + 1, i - W, i + W, i - 2, i + 2, i - 2 * W, i + 2 * W]) {
    if (overflowed(j)) return crust[3 + (bayerAt(i) > 0.5 ? 1 : 0)];
  }
  return toastedColor(i);
}

// Every bread catches the heat differently: toasted patches with paler crumb between. Reopening
// the same bread keeps them, so it only rolls new ones for a new bread.
function rollToast() {
  const wide = softNoise(19), fine = softNoise(8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const n = wide(x, y) * 0.68 + fine(x, y) * 0.32;
    toastMap[y * W + x] = n > 0.52 ? -Math.min(2.4, (n - 0.52) * 11) : n < 0.42 ? (0.42 - n) * 5 : 0;
  }
  state.toasted = true;
}

// Steps along the palette rather than darkening, so the scales keep their shading inside a patch.
function toastedColor(i) {
  const r = RESULTS[state.result], c = r.art[i], step = r.step.get(c);
  if (step === undefined || step <= 1) return c; // the dark outline stays
  const k = Math.round(step + toastMap[i] * r.toast + (bayerAt(i) - 0.5) * 0.9);
  return r.ramp[Math.max(1, Math.min(r.ramp.length - 1, k))];
}

// Without a flip it is just the time so far. After one, any burnt side ruins it; otherwise the
// bread is only as done as its less cooked side.
function cookedFor() {
  if (!state.flips) return state.cook;
  const a = state.sideCook[0], b = state.cook;
  return Math.max(a, b) >= SMOKE_PHASES[2].until ? Math.max(a, b) : Math.min(a, b);
}

function bake(now) {
  const time = cookedFor();
  state.baked = true;
  state.result = SMOKE_PHASES.findIndex(p => time < p.until);
  if (!state.toasted) rollToast();
  state.steamUntil = now + STEAM_MS;
  bakedCells = [];
  for (let i = 0; i < W * H; i++) {
    bakedView[i] = zone[i] === CAV_R ? breadColor(i) : zone[i] === PLATE_R ? (overflowed(i) ? crustColor(i) : 0) : 0;
    if (zone[i] === CAV_R && totalBatter(i) >= 0.05) bakedCells.push(i);
  }
}

// ---- taking the bread out ----

const CRUMB_FLOOR = H - 3, LIFT_SECONDS = 0.45;

// The first stage is still raw inside, so it will not come out in one piece.
const canLift = p => state.held === 'hook' && state.baked && !state.bread && state.result > 0 && state.frame === 0 && !state.playing
  && bakedView[p.y * W + p.x] > 0;

function paintBread(b) {
  const g = b.canvas.getContext('2d'), s = b.shadow.getContext('2d');
  const out = g.createImageData(b.w, b.h), o = new Uint32Array(out.data.buffer);
  o.set(b.px);
  g.putImageData(out, 0, 0);
  s.clearRect(0, 0, b.w, b.h);
  s.drawImage(b.canvas, 0, 0);
  s.globalCompositeOperation = 'source-in';
  s.fillStyle = '#120b09';
  s.fillRect(0, 0, b.w, b.h);
  s.globalCompositeOperation = 'source-over';
}

// Everything baked in the mold becomes one loose piece, resampled level with the head to the left,
// so it can settle flat in the middle of the stage; the mold is left empty.
function liftBread() {
  scatterCrumbs();
  const piece = i => bakedView[i] || (zone[i] === CAV_R ? fillView[i] : 0);
  const at = (x, y) => {
    const [fx, fy] = toStage(-y - 0.5, x + 0.5, CENTER), sx = Math.floor(fx), sy = Math.floor(fy);
    return sx >= 0 && sy >= 0 && sx < W && sy < H ? sy * W + sx : -1;
  };
  let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
  for (let y = -140; y <= 140; y++) for (let x = -170; x <= 170; x++) {
    const i = at(x, y);
    if (i >= 0 && piece(i)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Uint32Array(w * h), crust = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = at(x + x0, y + y0);
    if (i < 0 || !piece(i)) continue;
    px[y * w + x] = piece(i);
    if (zone[i] === PLATE_R) crust.push(y * w + x);
  }
  const canvas = document.createElement('canvas'), shadow = document.createElement('canvas');
  canvas.width = shadow.width = w; canvas.height = shadow.height = h;
  const [fromX, fromY] = toStage(-(y0 + h / 2), x0 + w / 2, CENTER);
  state.bread = {
    w, h, px, crust, canvas, shadow, t: 0, shake: 0, scale: 1, grab: null, homing: false, turn: (L.angle + 90) * Math.PI / 180,
    fromX, fromY, cx: fromX, cy: fromY, x: Math.round(fromX - w / 2), y: Math.round(fromY - h / 2),
  };
  paintBread(state.bread);
  for (let i = 0; i < W * H; i++) if (rightSide(zone[i])) {
    batter[i] = buried[i] = fillH[i] = raised[i] = 0; fillKind[i] = fillView[i] = fillShadow[i] = fillWas[i] = 0;
  }
  bakedView.fill(0);
  state.sources = []; state.flowing = false;
  // The mold is free again for the next bread.
  state.baked = state.toasted = false;
  state.cook = 0; state.flips = 0; state.sideCook = [0, 0];
}

function paintCrumbs() {
  crumbView.fill(0);
  for (const c of state.moldCrumbs) for (const [j, color] of c.cells) crumbView[j] = color;
}

// Bits of the bread stay stuck to the iron, in its own colours, mostly along the edge of the fish.
function scatterCrumbs() {
  const spots = [];
  for (let i = 0; i < W * H; i++) if (bakedView[i] && rightSide(zone[i])) spots.push(i);
  if (!spots.length) return;
  const edge = i => !bakedView[i - 6] || !bakedView[i + 6] || !bakedView[i - 6 * W] || !bakedView[i + 6 * W];
  const pick = () => spots[Math.random() * spots.length | 0];
  for (let n = 0; n < MOLD_CRUMBS; n++) {
    let i = pick();
    for (let tries = 0; tries < 3 && !edge(i); tries++) i = pick();
    const color = bakedView[i], w = 2 + (Math.random() < 0.4), h = 2 + (Math.random() < 0.3), cells = [];
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      const j = i + dy * W + dx;
      if (rightSide(zone[j])) cells.push([j, dy === h - 1 ? shadeColor(color, 0.72) : color]);
    }
    state.moldCrumbs.push({ x: i % W, y: i / W | 0, color, cells });
  }
  state.moldCrumbs = state.moldCrumbs.slice(-400);
  paintCrumbs();
}

// One flick of the brush sends the nearest crumbs flying off.
function brushCrumbs(p, now) {
  state.brushAt = now;
  const away = c => Math.hypot(c.x - p.x, c.y - p.y);
  const near = state.moldCrumbs.filter(c => away(c) <= BRUSH_REACH).sort((a, b) => away(a) - away(b)).slice(0, BRUSH_TAKE);
  for (const c of near) {
    const a = Math.atan2(c.y - p.y, c.x - p.x) + (Math.random() - 0.5) * 0.8, v = 90 + Math.random() * 90;
    state.crumbs.push({ x: c.x, y: c.y, color: css(c.color), size: 2, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, floor: H + 30, blown: true });
  }
  state.moldCrumbs = state.moldCrumbs.filter(c => !near.includes(c));
  paintCrumbs();
}

function shelveBread(b) {
  state.shelf.push(b);
  if (state.shelf.length > SHELF.max) state.shelf.shift();
  state.bread = null;
  state.steamUntil = 0;
}

function drawShelf() {
  state.shelf.forEach((b, k) => {
    const w = Math.round(b.w * SHELF.scale), h = Math.round(b.h * SHELF.scale), x = SHELF.x0 + k * SHELF.gap, y = SHELF.y - (h >> 1);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(b.shadow, x + 3, y + 4, w, h);
    ctx.globalAlpha = 1;
    ctx.drawImage(b.canvas, x, y, w, h);
  });
}

const breadAt = (b, p) => {
  const x = p.x - b.x, y = p.y - b.y;
  return b.t >= 1 && x >= 0 && y >= 0 && x < b.w && y < b.h && b.px[y * b.w + x] !== 0;
};

function dropCrumb(x, y, color, size, vx, vy) {
  state.crumbs.push({ x, y, color, size, vx, vy, floor: CRUMB_FLOOR - Math.random() * 5 });
}

// One knock: a random piece of the baked-on crust breaks away and falls, shedding crumbs.
function chipBread(b) {
  b.shake = 0.14;
  const colorAt = k => css(b.px[k]);
  if (!b.crust.length) {
    // Nothing left to break off: only a dusting from the edge.
    for (let n = 0; n < 6; n++) dropCrumb(b.x + Math.random() * b.w, b.y + b.h * (0.3 + Math.random() * 0.6), '#cc8524', 1, (Math.random() - 0.5) * 30, -10);
    return;
  }
  const seed = b.crust[Math.random() * b.crust.length | 0], sx = seed % b.w, sy = seed / b.w | 0;
  const r = 6 + Math.random() * 8, kick = (sx < b.w / 2 ? -1 : 1) * (20 + Math.random() * 26), stay = [];
  for (const k of b.crust) {
    const x = k % b.w, y = k / b.w | 0;
    if (Math.hypot(x - sx, y - sy) > r * (0.75 + grain[k % (W * H)] * 0.5)) { stay.push(k); continue; }
    dropCrumb(b.x + x, b.y + y, colorAt(k), 2, kick + (Math.random() - 0.5) * 24, -26 - Math.random() * 24);
    b.px[k] = 0;
  }
  b.crust = stay;
  const dust = 8 + Math.random() * 8 | 0;
  for (let n = 0; n < dust; n++) {
    dropCrumb(b.x + sx, b.y + sy, n % 3 ? '#e0a030' : '#8a4714', Math.random() < 0.25 ? 3 : 2, kick * Math.random() * 1.6 + (Math.random() - 0.5) * 60, -44 - Math.random() * 50);
  }
  paintBread(b);
}

function updateBread(dt) {
  const b = state.bread;
  if (b) {
    if (b.t < 1) {
      b.t = Math.min(1, b.t + dt / LIFT_SECONDS);
      const e = b.t * b.t * (3 - 2 * b.t);
      b.cx = b.fromX + (W / 2 - b.fromX) * e;
      b.cy = b.fromY + (H / 2 - b.fromY) * e - Math.sin(b.t * Math.PI) * 22;
      b.turn = (L.angle + 90) * Math.PI / 180 * (1 - e); // it comes up at the mold's angle and settles level
    } else if (b.homing) {
      const k = Math.min(1, dt * 12);
      b.cx += (W / 2 - b.cx) * k; b.cy += (H / 2 - b.cy) * k;
      if (Math.hypot(W / 2 - b.cx, H / 2 - b.cy) < 1) { b.cx = W / 2; b.cy = H / 2; b.homing = false; }
    }
    const overShelf = b.grab && b.grab.moved && state.ptr.y < 0;
    b.scale += ((overShelf ? SHELF.scale : 1) - b.scale) * Math.min(1, dt * 16);
    b.x = Math.round(b.cx - b.w / 2); b.y = Math.round(b.cy - b.h / 2);
    b.shake = Math.max(0, b.shake - dt);
  }
  for (const c of state.crumbs) {
    if (c.vx === 0 && c.vy === 0) continue;
    c.vy += 320 * dt; c.x += c.vx * dt; c.y += c.vy * dt;
    if (c.y >= c.floor) { // a little bounce, then it stays where it lands
      c.y = c.floor;
      if (c.vy > 90 && !c.blown) { c.vy *= -0.3; c.vx *= 0.5; } else c.vx = c.vy = 0;
    }
  }
  state.crumbs = state.crumbs.filter(c => !(c.blown && c.y >= c.floor));
}

function drawBread() {
  const b = state.bread;
  if (!b) return;
  const sx = b.shake > 0 ? (b.shake * 60 | 0) % 2 * 2 - 1 : 0;
  const lift = Math.round(Math.sin(b.t * Math.PI) * 12);
  const at = (img, x, y) => {
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (b.turn) ctx.rotate(b.turn);
    ctx.scale(b.scale, b.scale);
    ctx.drawImage(img, -(b.w >> 1), -(b.h >> 1));
    ctx.restore();
  };
  ctx.globalAlpha = 0.4;
  at(b.shadow, b.cx + 5, b.cy + 6 + lift);
  ctx.globalAlpha = 1;
  at(b.canvas, b.cx + sx, b.cy);
}

function updateSteam(now, dt) {
  if (now >= state.steamUntil || state.frame !== 0 || !bakedCells.length) return;
  state.steamDebt += dt * RESULTS[state.result].steam * 1.6;
  while (state.steamDebt >= 1) {
    state.steamDebt--;
    const i = bakedCells[Math.random() * bakedCells.length | 0];
    state.smoke.push({
      x: i % W + (state.bread ? state.bread.cx - state.bread.fromX : 0),
      y: (i / W | 0) + (state.bread ? state.bread.cy - state.bread.fromY : 0),
      ramp: state.result === 3 ? SMOKE_GRAY : SMOKE_WHITE, size: Math.random() < 0.3 ? 3 : 2,
      vy: -(9 + Math.random() * 10), sway: Math.random() * 6.283, age: 0, life: 1.1 + Math.random() * 1.3,
    });
  }
}

// ---- timer ----

function drawDigit(n, x, y, scale) {
  const bits = DIGITS[n];
  for (let k = 0; k < 15; k++) if (bits[k] === '1') ctx.fillRect(x + (k % 3) * scale, y + (k / 3 | 0) * scale, scale, scale);
}

function drawTimer() {
  if ((!state.cooking && !state.timerEdit) || state.flip.angle > 0) return;
  const a = state.timerEdit ? 1 : state.timerAge, pop = a < 0.12 ? 0.6 + a / 0.12 * 0.55 : a < 0.2 ? 1.15 - (a - 0.12) / 0.08 * 0.15 : 1;
  const r = Math.round(TIMER.r * pop), { x, y } = TIMER;
  const left = COOK_SECONDS - state.cook, done = left <= 0;
  const blink = done && state.cook * 2 % 2 < 1;
  const ringOn = !done ? '#f2b544' : state.cook < 11 ? (blink ? '#b6e07a' : '#86c46f') : (blink ? '#f08a6c' : '#e2664d');

  ctx.fillStyle = '#6b4030';
  ctx.fillRect(x - 5, y - r - 4, 11, 5);
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillStyle = '#120d0b';
    ctx.fillRect(x - half, y + dy, half * 2 + 1, 1);
  }
  const share = done ? 1 : left / COOK_SECONDS;
  for (let deg = 0; deg < 360; deg += 1.5) {
    const rad = (deg - 90) * Math.PI / 180;
    ctx.fillStyle = deg / 360 < share ? ringOn : '#3d2a22';
    ctx.fillRect(Math.round(x + Math.cos(rad) * (r - 3)), Math.round(y + Math.sin(rad) * (r - 3)), 3, 3);
  }
  if (a < 0.12) return;
  ctx.fillStyle = done ? ringOn : '#f7ebc8';
  if (!done) { drawDigit(Math.ceil(left), x - 4, y - 7, 3); return; }
  // Past zero it counts how long the bread has gone over.
  const over = Math.floor(state.cook - COOK_SECONDS), tens = over / 10 | 0;
  ctx.fillRect(x - 16, y - 1, 8, 2); ctx.fillRect(x - 13, y - 4, 2, 8);
  if (tens) drawDigit(tens % 10, x - 6, y - 7, 3);
  drawDigit(over % 10, tens ? x + 5 : x - 3, y - 7, 3);
}

// ---- turning the mold over ----

const canFlip = () => state.cooking && !state.flips && state.cook >= COOK_SECONDS && !state.flip.finishing;

// The glowing edge says the mold is ready; the arrow shows which way to pull, and fills as you do.
function drawFlipPrompt(now) {
  if (!canFlip()) return;
  const fl = state.flip, on = (now / 260 | 0) % 2 === 0;
  if (fl.angle === 0 && on) {
    ctx.fillStyle = '#ffd76a';
    for (const i of rim) ctx.fillRect(i % W, i / W | 0, 1, 1);
  }
  if (fl.angle > 60) return; // the mold has turned out from under it
  const dot = (u, v, size) => {
    const [x, y] = toStage(u, v, CENTER);
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
  };
  const R = FLIP.arrow, head = -R + 16, reached = R - (2 * R) * fl.pull, march = (now / 90 | 0) % 10;
  ctx.fillStyle = '#2a1712';
  for (let u = head; u <= R; u += 1) for (let v = -3; v <= 3; v++) dot(u, v, 1);
  for (let k = 0; k <= 16; k++) for (let v = -k - 1; v <= k + 1; v++) dot(-R + k - 1, v, 2);
  for (let u = R - 1; u > head; u -= 1) {
    ctx.fillStyle = u >= reached ? '#ffd76a' : (u + march) % 10 < 5 ? '#c9a24e' : '#6b5338';
    for (let v = -1; v <= 1; v++) dot(u, v, 2);
  }
  ctx.fillStyle = '#ffd76a';
  for (let k = 0; k <= 14; k++) for (let v = -k; v <= k; v++) dot(-R + k, v, 2);
}

function updateFlip(dt) {
  const fl = state.flip;
  if (fl.finishing) {
    fl.angle = Math.min(180, fl.angle + dt * 520);
    if (fl.angle >= 180) finishFlip();
  } else if (fl.turning) {
    fl.angle += (fl.pull * 170 - fl.angle) * Math.min(1, dt * 18);
    if (fl.pull >= 1) { fl.turning = false; fl.finishing = true; }
  } else if (fl.angle > 0) {
    fl.angle = Math.max(0, fl.angle - dt * 420); // let go too early and it falls back
  }
}

// The second side starts its own clock; the first side's time is kept for the result.
function finishFlip() {
  state.sideCook[0] = state.cook;
  state.cook = 0;
  state.flips = 1;
  state.timerAge = 0;
  state.flip = { angle: 0, turning: false, finishing: false, pull: 0, startX: 0, startY: 0 };
}

// ---- lid ----

function setFrame(n) {
  if (n === state.frame) return;
  state.frame = n;
  frameInput.value = n;
  thumbs.forEach((t, i) => t.classList.toggle('on', i === n));
  lidSettled();
}

// Cooking runs while the lid is shut on batter. Time adds up, so reopening does not undo it.
function lidSettled() {
  // Lifting the lid shows how far it has come; shutting it again carries on cooking.
  if (state.frame !== LAST && state.cooking) bake(performance.now());
  const cooking = state.frame === LAST && !state.playing && hasBatter();
  state.smokeAt = cooking ? performance.now() + 400 : Infinity;
  state.cooking = cooking;
  state.timerAge = 0;
}

function play(dir) {
  state.playing = dir;
  state.playFrom = state.frame;
  state.playTo = dir > 0 ? LAST : 0;
  state.playMs = +speedInput.value * Math.abs(state.playTo - state.playFrom) / LAST;
  state.playT = 0;
  state.loopWait = 0;
}
function stop() { state.playing = null; }

function updateLid(dt) {
  if (state.loopWait > 0) {
    state.loopWait -= dt;
    if (state.loopWait <= 0) play(state.frame === LAST ? -1 : 1);
    return;
  }
  if (!state.playing) return;
  state.playT = state.playMs > 0 ? state.playT + dt * 1000 / state.playMs : 1;
  if (state.playT >= 1) {
    state.playing = null;
    setFrame(state.playTo);
    lidSettled();
    if (loopInput.checked) state.loopWait = 0.35;
    return;
  }
  // A heavy lid starts slow, swings, and eases down.
  const t = state.playT, eased = t * t * (3 - 2 * t);
  setFrame(Math.round(state.playFrom + (state.playTo - state.playFrom) * eased));
}

// ---- input ----

const frameInput = document.getElementById('frame');
const speedInput = document.getElementById('speed');
const loopInput = document.getElementById('loop');
const strip = document.getElementById('strip');
let thumbs = [];

function stagePoint(e) {
  const r = canvas.getBoundingClientRect();
  return { x: Math.floor((e.clientX - r.left) * W / r.width), y: Math.floor((e.clientY - r.top) * (H + TOP) / r.height) - TOP };
}
function toolAt(p) {
  for (const name in TOOLS) {
    const a = art[name], x = p.x - TOOLS[name].x, y = p.y - TOOLS[name].y;
    if (x >= 0 && y >= 0 && x < a.w && y < a.h && (a.px.p[y * a.w + x] >>> 24) !== 0) return name;
  }
  return null;
}

function setHeld(name) {
  state.held = name;
  state.pouring = false;
  state.pourUntil = 0;
}

// Bare-handed, the lid is dragged across the hinge to open or shut it; its far end follows the hand.
function grabLid(p) {
  if (p.y < 0 || state.playing || state.flip.angle > 0) return false;
  const i = p.y * W + p.x, u = toMold(p.x + 0.5, p.y + 0.5, HINGE)[0];
  const onLid = state.frame === LAST ? lidOutArt[i] && u > LID_GRAB
    : state.frame === 0 ? zone[i] === PLATE_L || zone[i] === CAV_L : false;
  if (onLid) state.lid = { reach: Math.abs(u) };
  return !!onLid;
}

function dragLid(p) {
  const u = toMold(p.x + 0.5, p.y + 0.5, HINGE)[0];
  const angle = Math.acos(Math.max(-1, Math.min(1, u / state.lid.reach))) * 180 / Math.PI; // 0 shut, 180 open
  setFrame(Math.round((180 - angle) / (180 / LAST)));
}

function celebrate(name, now) {
  state.bounce = { tool: name, at: now };
  const { edge, w } = art[name], tool = TOOLS[name];
  for (let n = 0; n < 7; n++) {
    const i = edge[Math.random() * edge.length | 0];
    state.sparkles.push({ x: tool.x + i % w, y: tool.y + (i / w | 0), at: now + n * 35 });
  }
}

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('pointerdown', e => {
  const p = stagePoint(e), now = performance.now();
  if (state.timerEdit && e.button === 0 && Math.hypot(p.x - TIMER.x, p.y - TIMER.y) <= TIMER.r + 4) {
    state.timerDrag = true;
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  state.ptr.x = state.ptr.lastX = p.x; state.ptr.y = state.ptr.lastY = p.y;
  if (e.button === 2) { setHeld(null); return; }
  if (e.button !== 0) return;
  const tool = toolAt(p);
  if (tool) {
    if (tool === state.held) setHeld(null);
    else { celebrate(tool, now); setHeld(tool); }
    return;
  }
  const b = state.bread;
  if (b && state.held !== 'brush' && breadAt(b, p)) {
    // Bare-handed it can be dragged; a press that goes nowhere is a knock, same as with a tool.
    if (state.held) chipBread(b);
    else {
      b.grab = { dx: b.cx - p.x, dy: b.cy - p.y, sx: p.x, sy: p.y, moved: false };
      b.homing = false;
      canvas.setPointerCapture(e.pointerId);
    }
    return;
  }
  if (canLift(p)) { liftBread(); return; }
  if (state.held === 'brush' && state.frame === 0 && !state.playing && rightSide(zone[p.y * W + p.x])) { brushCrumbs(p, now); return; }
  if (canFlip() && closedArt[p.y * W + p.x]) {
    setHeld(null);
    Object.assign(state.flip, { turning: true, pull: 0, startX: p.x, startY: p.y });
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (!state.held && grabLid(p)) { canvas.setPointerCapture(e.pointerId); return; }
  if (pours(state.held) && state.frame === 0 && !state.playing) {
    state.pouring = true;
    state.pourUntil = now + MIN_POUR;
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', e => {
  const p = stagePoint(e);
  state.ptr.x = p.x; state.ptr.y = p.y;
  state.inside = true;
  if (state.timerDrag) { TIMER.x = p.x; TIMER.y = p.y; showTimerSpot(); }
  const b = state.bread;
  if (b && b.grab) {
    if (Math.hypot(p.x - b.grab.sx, p.y - b.grab.sy) > 3) b.grab.moved = true;
    if (b.grab.moved) { b.cx = p.x + b.grab.dx; b.cy = p.y + b.grab.dy; }
  }
  state.hover = b && b.grab ? null : toolAt(p);
  if (state.lid) dragLid(p);
  const fl = state.flip;
  if (fl.turning) fl.pull = Math.max(0, Math.min(1, ((fl.startX - p.x) * UX + (fl.startY - p.y) * UY) / FLIP.drag));
});
canvas.addEventListener('pointerleave', () => { state.inside = false; state.hover = null; });
function letGo() {
  state.pouring = false;
  state.timerDrag = false;
  if (state.lid) { state.lid = null; play(state.frame >= LAST / 2 ? 1 : -1); } // it falls the rest of the way
  const b = state.bread;
  if (b && b.grab) {
    const { moved } = b.grab;
    b.grab = null;
    if (!moved) chipBread(b);
    else if (state.ptr.y < 0) shelveBread(b);
    else b.homing = true;
  }
  const fl = state.flip;
  if (fl.turning) Object.assign(fl, { turning: false, pull: 0 });
}
canvas.addEventListener('pointerup', letGo);
canvas.addEventListener('pointercancel', letGo);

document.getElementById('dev').hidden = !new URLSearchParams(location.search).has('dev');
const showTimerSpot = () => { document.getElementById('timerSpot').textContent = 'x: ' + TIMER.x + ', y: ' + TIMER.y; };
document.getElementById('timerEdit').addEventListener('change', e => { state.timerEdit = e.target.checked; });
document.getElementById('close').addEventListener('click', () => play(1));
document.getElementById('open').addEventListener('click', () => play(-1));
document.getElementById('reset').addEventListener('click', () => {
  stop(); state.loopWait = 0;
  batter.fill(0); fillH.fill(0); fillKind.fill(0); fillView.fill(0); fillShadow.fill(0); fillWas.fill(0); buried.fill(0); raised.fill(0);
  state.smoke = []; state.drops = []; state.sources = []; state.splash = []; state.impacts = []; state.sparkles = [];
  state.flowing = state.fillMoving = false;
  state.cook = 0; state.flips = 0; state.sideCook = [0, 0]; state.baked = false; state.toasted = false; state.bread = null; state.crumbs = []; state.shelf = []; state.moldCrumbs = []; crumbView.fill(0); state.steamUntil = 0; bakedView.fill(0); bakedCells = [];
  state.flip = { angle: 0, turning: false, finishing: false, pull: 0, startX: 0, startY: 0 };
  state.lid = null;
  setFrame(0); setHeld(null);
});
loopInput.addEventListener('change', () => {
  if (loopInput.checked && !state.playing) play(state.frame === LAST ? -1 : 1);
  if (!loopInput.checked) state.loopWait = 0;
});
speedInput.addEventListener('input', () => { document.getElementById('speedOut').textContent = speedInput.value + 'ms'; });
for (const [id, key] of [['coverSpeed', 'coverSpeed'], ['fadeSpeed', 'fadeSpeed']]) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    state[key] = +input.value / 100;
    document.getElementById(id + 'Out').textContent = input.value + '%';
  });
}
frameInput.addEventListener('input', () => { stop(); state.loopWait = 0; setFrame(+frameInput.value); });

function buildStrip() {
  const buf = new ImageData(W, H), view = new Uint32Array(buf.data.buffer);
  frames.forEach((f, n) => {
    composite(view, f, false);
    const fig = document.createElement('figure'), c = document.createElement('canvas'), cap = document.createElement('figcaption');
    c.width = W; c.height = H;
    c.getContext('2d').putImageData(buf, 0, 0);
    cap.textContent = f.angle + '°';
    fig.append(c, cap);
    fig.addEventListener('click', () => { stop(); state.loopWait = 0; setFrame(n); });
    if (n === 0) fig.classList.add('on');
    strip.append(fig);
    thumbs.push(fig);
  });
}

// ---- tool art made from the sprites ----

// Lean the held icon spout-down by sampling it through a rotation.
function tiltIcon(icon, tool) {
  const src = pixels(icon), rad = tool.tilt * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  const size = Math.ceil(Math.hypot(src.w, src.h)) + 4, cx = src.w / 2, cy = src.h / 2;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const t = c.getContext('2d'), out = t.createImageData(size, size), o = new Uint32Array(out.data.buffer);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 0.5 - size / 2, dy = y + 0.5 - size / 2;
    const sx = Math.floor(cx + dx * cos + dy * sin), sy = Math.floor(cy - dx * sin + dy * cos);
    if (sx >= 0 && sy >= 0 && sx < src.w && sy < src.h) o[y * size + x] = src.p[sy * src.w + sx];
  }
  t.putImageData(out, 0, 0);
  const ox = tool.spoutX - cx, oy = tool.spoutY - cy;
  return { c, spoutX: Math.round(size / 2 + ox * cos - oy * sin), spoutY: Math.round(size / 2 + ox * sin + oy * cos) };
}

function bakeToolArt(tool, sprite, icon) {
  const k = pixels(sprite), w = k.w, h = k.h, edge = [];
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (k.p[y * w + x] >>> 24) !== 0;

  const glow = document.createElement('canvas');
  glow.width = w + 2; glow.height = h + 2;
  const g = glow.getContext('2d');
  g.fillStyle = '#ffe9a8';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const near = solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1);
    if (solid(x, y) || !near) continue;
    g.fillRect(x + 1, y + 1, 1, 1);
    if (x >= 0 && y >= 0 && x < w && y < h) edge.push(y * w + x);
  }

  const flash = document.createElement('canvas');
  flash.width = w; flash.height = h;
  const f = flash.getContext('2d');
  f.drawImage(sprite, 0, 0);
  f.globalCompositeOperation = 'source-atop';
  f.fillStyle = '#fff6d8';
  f.fillRect(0, 0, w, h);

  return { sprite, icon, px: k, w, h, edge, glow, flash, tilted: tiltIcon(icon, tool) };
}

let last = performance.now();
function tick(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updateLid(dt);
  if (pouringNow()) emit(now, dt);
  updateDrops(now);
  updateSources(dt);
  if (state.flowing) flow();
  if (state.fillMoving) slumpFilling();
  updateSpray(dt);
  updateFlip(dt);
  updateBread(dt);
  if (state.cooking && state.flip.angle === 0) { state.cook += dt; state.timerAge += dt; }
  updateSteam(now, dt);
  updateSmoke(now, dt);
  state.sparkles = state.sparkles.filter(s => now - s.at < SPARKLE_MS);
  draw(now);
  requestAnimationFrame(tick);
}

(async function start() {
  const S = window.SPRITES, names = ['mold', 'cavity', 'lid', 'lidIn', 'side', 'bg', 'cup', 'hand', 'shelf', ...RESULTS.map(r => r.sprite)];
  for (const name in TOOLS) names.push(TOOLS[name].sprite, TOOLS[name].icon);
  const img = {};
  await Promise.all(names.map(async k => { img[k] = await loadImage(S[k]); }));
  art.side = pixels(img.side);
  art.cup = img.cup; art.hand = img.hand; art.shelf = img.shelf;
  bgArt.set(pixels(img.bg).p);
  for (const name in TOOLS) art[name] = bakeToolArt(TOOLS[name], img[TOOLS[name].sprite], img[TOOLS[name].icon]);
  layOutArt(pixels(img.mold), pixels(img.cavity), pixels(img.lidIn), pixels(img.lid));
  buildRelief();
  buildNoise();
  for (const r of RESULTS) r.art.set(pixels(img[r.sprite]).p);
  frames = ANGLES.map(bakeFrame);
  drawBase(closedArt, false, false);
  drawLid(frames[LAST], closedArt, false);
  for (let a = 0; a <= 180; a += FLIP.step) flipFrames.push(bakeFlipFrame(a));
  buildStrip();
  showTimerSpot();
  requestAnimationFrame(tick);
})();
