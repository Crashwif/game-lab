import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { join } from 'node:path';
import { ROOT } from './pack.mjs';
const cache = new Map();
async function game(path) {
  if (!cache.has(path)) cache.set(path, (async () => {
    const result = await build({ entryPoints: [join(ROOT, 'games', path + '.ts')], bundle: true, platform: 'node', format: 'esm', write: false });
    return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
  })());
  return cache.get(path);
}
const close = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} ≠ ${b}`);
const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const length3 = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

test('Moon cashout inherits actual motion and remains independent of a later crash', async () => {
  const m = await game('moon-boys/rocket'), r = m.createRocket();
  m.settleRocket(r, 3.5, 16.321); r.climb = 17; r.swayX.v = 2;
  const frame = m.rocketFrame(r), contact = m.toWorld(frame, 0, r.you.y, 0.85 + 0.44 * r.you.size);
  m.bailYou(r); assert.deepEqual(m.bailPosition(r), contact); assert.ok(r.you.vel[1] > 19);
  r.you.age = 1.2; const before = m.bailPosition(r);
  m.killRocket(r); assert.deepEqual(m.bailPosition(r), before);
  r.swayX.x += 100; r.alt += 500; r.deadFor = 2;
  assert.deepEqual(m.bailPosition(r), before);
  for (const t of [0.45, 0.8]) {
    const sample = age => { r.you.age = age; return m.bailPosition(r); }, h = 1e-5;
    const a = sample(t - h), b = sample(t), c = sample(t + h);
    for (let i = 0; i < 3; i++) close((b[i] - a[i]) / h, (c[i] - b[i]) / h, 0.002);
  }
  m.stepRocket(r, { racing: false, multiplier: 3.5, tension: 0, crashed: true }, 0, false);
  assert.ok(r.events.includes('bailed'));
  m.stepRocket(r, { racing: false, multiplier: 3.5, tension: 0, crashed: true }, 0, false);
  assert.ok(!r.events.includes('bailed'));
});

test('Moon stagger snapshots at actual release; detached stages preserve their frame', async () => {
  const m = await game('moon-boys/rocket'), r = m.createRocket();
  r.random = () => 0.5; m.killRocket(r);
  const holder = r.holders[0]; assert.equal(holder.frame, undefined);
  m.stepRocket(r, { racing: false, multiplier: 1, tension: 0, crashed: true }, 0.3, false);
  assert.equal(holder.age, 0);
  close(length3(holder.from, m.toWorld(m.rocketFrame(r), Math.sin(holder.theta) * (0.85 + 0.44 * holder.size), holder.y, Math.cos(holder.theta) * (0.85 + 0.44 * holder.size))), 0);
  const launch = m.createRocket(); m.stepRocket(launch, { racing: true, multiplier: 1.4, tension: 0.3, crashed: false }, 1 / 60, false);
  const saved = structuredClone(launch.boosters.frame), pose = m.stagePose(launch.boosters, [1, 0, 0]);
  launch.alt += 500; launch.swayX.x += 20; m.killRocket(launch);
  assert.deepEqual(launch.boosters.frame, saved); assert.deepEqual(m.stagePose(launch.boosters, [1, 0, 0]), pose);
});

test('Moon drawn 3D limbs keep fixed bones and plant all four sockets on the hull', async () => {
  const m = await game('moon-boys/rocket');
  // `grip` 1 holds the hull, 0 is free on the chute, and a bail blends through everything between.
  for (const grip of [1, 0.75, 0.5, 0.25, 0]) for (const side of [-1, 1]) for (const arm of [true, false]) for (let i = 0; i < 90; i++) {
    const pose = m.heroLimb(side, arm, 1.1, i / 5, i / 90, false, grip);
    close(length3(pose.root, pose.joint), pose.bone); close(length3(pose.joint, pose.end), pose.bone);
    const mid = pose.root.map((v, k) => (v + pose.end[k]) / 2);
    assert.ok(arm ? (pose.joint[0] - mid[0]) * side > 0 : pose.joint[2] > mid[2], 'elbows bend out and knees forward, never across the body');
    if (grip === 1) close(Math.hypot(pose.end[0] * 1.1, 0.85 + 0.44 * 1.1 + pose.end[2] * 1.1), 0.85);
  }
});

test('Moon emissions retain equal thrust density at 30 through 144 fps', async () => {
  const m = await game('moon-boys/rocket');
  const counts = [];
  for (const fps of [30, 60, 120, 144]) {
    const r = m.createRocket(); r.thrust = 1; let count = 0;
    for (let i = 0; i < fps; i++) {
      m.stepRocket(r, { racing: true, multiplier: 1, tension: 0, crashed: false }, 1 / fps, false);
      count += r.particles.filter(p => !p.smoke).length; r.particles.length = 0;
    }
    counts.push(count);
  }
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 5, counts.join(', '));
});

test('Tower preserves collapse velocity and accepted emergency transfer never teleports', async () => {
  const t = await game('tower-tension/tower'), w = await game('tower-tension/worker');
  const tower = t.createTower(); for (let i = 0; i < 20; i++) t.landFloor(tower, 0, 0, true);
  tower.floors.at(-1).vx = 73; const velocity = t.topVelocity(tower), worker = w.createWorker();
  worker.y = t.towerTopY(tower); t.collapseTower(tower, 42, false); w.towerFell(worker, tower, 1, false, velocity);
  close(worker.fall.vx, 163);
  for (const mode of ['calling', 'boarding']) {
    const safe = w.createWorker(); safe.mode = mode; safe.x = 460; safe.y = -400;
    const start = { x: safe.x, y: safe.y, cageY: safe.cage.y };
    w.towerFell(safe, tower, 1); assert.equal(safe.mode, 'rescuing');
    assert.deepEqual({ x: safe.x, y: safe.y, cageY: safe.cage.y }, start);
    w.stepWorker(safe, tower, 1, null, 1 / 240);
    assert.ok(Math.hypot(safe.x - start.x, safe.y - start.y) < 1);
    for (let i = 0; i < 1500; i++) w.stepWorker(safe, tower, 1, null, 1 / 240);
    assert.equal(safe.mode, 'safe'); close(safe.y, t.GROUND_Y);
  }
});

test('Boiler releases the held shovel continuously and preserves rigid length in flight and contact', async () => {
  const m = await game('boiler-room/stoker'), e = await game('boiler-room/engine');
  for (const phase of [0.1, 0.5, 0.9]) {
    const s = m.createStoker(); s.mode = 'stoking'; s.phase = phase; s.rate = 1.4;
    const before = m.shovelPose(phase); m.callShield(s);
    assert.deepEqual(m.droppedShovel(s), { grip: before.grip, blade: before.blade });
    for (let i = 0; i < 720; i++) {
      m.stepStoker(s, { rate: 1.4, fear: 0, pressure: 0 }, 1 / 120);
      const pose = m.droppedShovel(s); close(length(pose.grip, pose.blade), m.SHOVEL_LENGTH);
      assert.ok(Math.max(pose.grip.y + 8, pose.blade.y + 13) <= e.FLOOR_Y - 2 + 1e-6);
    }
    assert.equal(s.mode, 'sheltered'); assert.ok(s.drop.rest, 'the shovel settles instead of bouncing indefinitely');
  }
});

test('Exit approaches the ladder continuously and alternates fixed rung supports', async () => {
  const m = await game('exit-liquidity/party'), poolModule = await game('exit-liquidity/pool');
  const p = m.createParty(), pool = poolModule.createPool(); p.avatar.x = poolModule.LADDER_X + 23; m.leavePool(p);
  let lastX = p.avatar.x, prior = null, contactsMoved = [false, false];
  for (let i = 0; i < 600; i++) {
    m.stepParty(p, pool, 1, true, 0, 1 / 120);
    assert.ok(Math.abs(p.avatar.x - lastX) <= 230 / 120 + 0.01); lastX = p.avatar.x;
    if (p.avatar.mode !== 'climbing' || p.avatar.modeAge < 0.36) continue;
    const feet = [-1, 1].map(side => m.climbContact(p.avatar, side, false));
    if (prior) for (let k = 0; k < 2; k++) if (Math.abs(feet[k].y - prior[k].y) > 0.01) {
      contactsMoved[k] = true; assert.ok(Math.abs(feet[k].y - prior[k].y) < 3);
    }
    prior = feet;
  }
  assert.ok(contactsMoved.every(Boolean)); assert.equal(p.avatar.mode, 'lounging');
});

test('Honeypot fox keeps fixed bones and the stamp event occurs at the actual glass socket', async () => {
  const m = await game('honeypot/picnic'), jar = await game('honeypot/jar'), p = m.createPicnic();
  p.fox.x = 655;
  for (let i = -10; i <= 110; i++) {
    p.fox.arm.x = i / 50; const pose = m.foxArmPose(p.fox);
    close(length(pose.shoulder, pose.elbow), 40); close(length(pose.elbow, pose.hand), 40);
  }
  p.fox.mode = 'stamping'; p.fox.age = 0; p.fox.arm.x = p.fox.arm.v = 0; let stamped = false;
  for (let i = 0; i < 150; i++) {
    m.stepPicnic(p, { running: true, multiplier: 3.2, tension: 0.4, level: 0.5, reduced: false }, 1 / 120);
    if (p.events.stamp) { stamped = true; close(length(m.foxArmPose(p.fox).face, jar.AUDIT_AT), 0); }
  }
  assert.ok(stamped);
});

test('Insider winch decelerates smoothly to its hold and suspension settles', async () => {
  const m = await game('insider-wallets/rally'), r = m.createRally();
  m.dumpRally(r, 42, false, true);
  let last = 0, decelerated = false, maxSpeed = 0;
  for (let i = 0; i < 1800; i++) {
    m.stepRally(r, { running: false, multiplier: 4, tension: 0.5, reduced: true }, 1 / 120);
    assert.ok(r.lift >= last - 1e-6 && r.lift <= 150 + 1e-6);
    maxSpeed = Math.max(maxSpeed, r.liftV);
    if (r.lift > 135 && r.liftV < maxSpeed / 2) decelerated = true;
    last = r.lift;
  }
  assert.ok(decelerated); close(r.lift, 150, 1e-4); assert.ok(Math.abs(r.swing.x) < 0.001);
});

test('Wen Binance exit start and final pavement destination survive queue and taxi movement', async () => {
  const m = await game('wen-binance/queue'), c = await game('wen-binance/club'), q = m.createQueue();
  m.settleQueue(q, 3); m.leaveQueue(q, false, true); const from = m.exitPosition(q), direction = Math.sign(c.KERB - 60 - from); let last = from;
  for (let i = 0; i < 480; i++) {
    m.stepQueue(q, { running: true, multiplier: 100000, tension: 1, thump: 0 }, 1 / 120);
    const x = m.exitPosition(q); assert.ok((x - last) * direction >= -1e-8); last = x;
  }
  close(last, c.KERB - 60); assert.equal(q.mode, 'gone');
});

test('Wen Moon pod shares pilot socket at release and harness does not scale with canopy', async () => {
  const m = await game('wen-moon/rocket');
  for (const wobble of [-0.1, 0, 0.1]) {
    const p = m.createPod(800, wobble, 50, 0.2);
    close(p.x + Math.sin(p.angle.x) * 7, 166 * Math.sin(wobble));
    close(p.h + Math.cos(p.angle.x) * 7, 800 + 166 * Math.cos(wobble));
    assert.ok(p.vy > 100);
    for (let i = 0; i < 1200; i++) m.stepPod(p, 1 / 120, false);
    assert.ok([p.x, p.h, p.angle.x, p.vy].every(Number.isFinite)); close(p.vy, -55, 0.01);
  }
  for (const open of [0, 0.1, 0.5, 1]) assert.equal(m.podRig(open).harnessY, -12);
});
