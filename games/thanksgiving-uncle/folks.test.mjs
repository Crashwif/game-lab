import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [fileURLToPath(new URL('./folks.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createFamily, drawRelative } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const INK = '#1c1f26';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
/** Where each of them looks while someone talks (folks.ts LOOK), and at the truck once it is in. */
const LOOKS = {
  dad: [[3, 2], [2, 2], [3, 0], [-3, 1], [3, -2], [1.5, 1.5], [4, -1]],
  niece: [[-1, 3], [-3, 0], [-1, 2], [-3, 1], [3, -2], [-1, 1.5], [4, -1]],
};

/**
 * A canvas that records the shapes drawRelative draws, in room coordinates, and every straight segment the canvas
 * would add by itself: arc() and ellipse() join the current point to their start when the subpath already has one.
 */
function recorder() {
  let m = [1, 0, 0, 1, 0, 0];
  let at = null;
  let start = null;
  const stack = [];
  const shapes = [];
  const joins = [];
  const state = { fillStyle: '', strokeStyle: '', lineWidth: 1 };
  const world = (x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
  const enter = (from) => {
    if (at && distance(at, from) > 1e-6) joins.push({ from: at, to: from });
    start ??= from;
  };
  const methods = {
    save: () => stack.push({ m: [...m], fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, lineWidth: state.lineWidth }),
    restore: () => {
      const saved = stack.pop();
      m = saved.m;
      Object.assign(state, { fillStyle: saved.fillStyle, strokeStyle: saved.strokeStyle, lineWidth: saved.lineWidth });
    },
    translate: (x, y) => {
      const p = world(x, y);
      m[4] = p.x;
      m[5] = p.y;
    },
    rotate: (a) => {
      const [p, q, r, s] = m;
      const c = Math.cos(a), n = Math.sin(a);
      m = [p * c + r * n, q * c + s * n, r * c - p * n, s * c - q * n, m[4], m[5]];
    },
    beginPath: () => { at = start = null; },
    moveTo: (x, y) => { at = start = world(x, y); },
    lineTo: (x, y) => { at = world(x, y); start ??= at; },
    quadraticCurveTo: (cx, cy, x, y) => { at = world(x, y); },
    closePath: () => { at = start; },
    roundRect: (x, y) => { at = start = world(x, y); },
    arc: (x, y, r, a0, a1) => {
      enter(world(x + r * Math.cos(a0), y + r * Math.sin(a0)));
      at = world(x + r * Math.cos(a1), y + r * Math.sin(a1));
      shapes.push({ kind: 'arc', centre: world(x, y), r, fill: state.fillStyle, stroke: state.strokeStyle, width: state.lineWidth });
    },
    ellipse: (x, y, rx, ry, rot, a0, a1) => {
      const on = (t) => world(x + rx * Math.cos(t) * Math.cos(rot) - ry * Math.sin(t) * Math.sin(rot), y + rx * Math.cos(t) * Math.sin(rot) + ry * Math.sin(t) * Math.cos(rot));
      enter(on(a0));
      at = on(a1);
      shapes.push({ kind: 'ellipse', centre: world(x, y), rx, ry, fill: state.fillStyle, stroke: state.strokeStyle, width: state.lineWidth });
    },
    measureText: () => ({ width: 30 }),
  };
  const ctx = new Proxy(state, {
    get: (target, key) => (key in methods ? methods[key] : key in target ? target[key] : () => {}),
    set: (target, key, value) => {
      target[key] = value;
      return true;
    },
  });
  return { ctx, shapes, joins };
}

/** Draws Dad or the niece as the scene would, from how far gone they are, a take's age, their gaze and the blast. */
function draw(kind, { heat = 0, takeAge = 9, look = [0, 0], shock = 0 } = {}) {
  const r = createFamily()[kind === 'dad' ? 0 : 1];
  r.heat.x = heat;
  r.takeAge = takeAge;
  r.look = { x: look[0], y: look[1] };
  r.shock.x = shock;
  const rec = recorder();
  drawRelative(rec.ctx, r, 3.21);
  // Each white of an eye is drawn, then its pupil, clipped to it.
  const eyes = [];
  rec.shapes.forEach((s, i) => {
    if (s.kind === 'ellipse' && s.fill === '#ffffff') eyes.push({ eye: s, pupil: rec.shapes[i + 1] });
  });
  return { ...rec, eyes };
}

test('no stroke joins a lens or any other curve to the point drawn before it', () => {
  for (const kind of ['dad', 'niece']) for (const heat of [0, 0.5, 1]) for (const shock of [0, 1]) {
    const { joins } = draw(kind, { heat, shock });
    assert.deepEqual(joins, [], `${kind} at heat ${heat}, shock ${shock} draws a stray line`);
  }
});

test('Dad’s eyes widen inside his round lenses and stop short of the rims', () => {
  for (let heat = 0; heat <= 1.0001; heat += 0.05) for (const look of LOOKS.dad) {
    const { shapes, eyes } = draw('dad', { heat, look });
    const lenses = shapes.filter((s) => s.kind === 'arc' && s.stroke === '#2a2a30' && s.r === 13);
    assert.equal(lenses.length, 2);
    assert.equal(eyes.length, 2);
    for (const { eye } of eyes) {
      const lens = lenses.reduce((a, b) => (distance(a.centre, eye.centre) <= distance(b.centre, eye.centre) ? a : b));
      assert.ok(distance(lens.centre, eye.centre) < 1e-6, 'each eye sits in the middle of its lens');
      const outline = Math.max(eye.rx, eye.ry) + eye.width / 2;
      assert.ok(outline < lens.r - lens.width / 2, `at heat ${heat.toFixed(2)} the eye (${outline}) reaches the rim (${lens.r - lens.width / 2})`);
    }
  }
});

test('the niece rolls her eyes up under her lids without losing her pupils, through every take', () => {
  for (let heat = 0; heat <= 1.0001; heat += 0.05) for (let takeAge = 0; takeAge <= 0.61; takeAge += 0.03) for (const look of LOOKS.niece) {
    const { eyes } = draw('niece', { heat, takeAge, look });
    assert.equal(eyes.length, 2);
    for (const { eye, pupil } of eyes) {
      assert.equal(pupil.kind, 'arc');
      assert.equal(pupil.fill, INK);
      // The pupil's centre stays on the white, inside the eye's outline, so at least half of it shows.
      const dx = (pupil.centre.x - eye.centre.x) / (eye.rx - eye.width / 2);
      const dy = (pupil.centre.y - eye.centre.y) / (eye.ry - eye.width / 2);
      assert.ok(Math.hypot(dx, dy) <= 1, `heat ${heat.toFixed(2)}, take ${takeAge.toFixed(2)} s, look ${look}: the pupil rolls out of sight`);
    }
  }
  // Fed up, the pupils are pinned at the top of the eye, not back in the middle.
  for (const look of LOOKS.niece) {
    for (const { eye, pupil } of draw('niece', { heat: 1, look }).eyes) assert.ok(pupil.centre.y - eye.centre.y < -(eye.ry - 3), 'the eyes stay rolled up');
  }
});
