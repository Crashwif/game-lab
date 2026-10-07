import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { ROOT } from './pack.mjs';

const modules = new Map();
async function sceneModule(path) {
  if (!modules.has(path)) modules.set(path, (async () => {
    const output = await build({ absWorkingDir: ROOT, entryPoints: [`games/${path}.ts`], bundle: true, format: 'esm', platform: 'node', write: false });
    return import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].text).toString('base64')}`);
  })());
  return modules.get(path);
}

// Run real controller steps at 60 fps, including a final minute after the old content ladders ended.
function endurance(step) {
  for (let frame = 0; frame <= 180 * 60; frame++) {
    const seconds = frame / 60;
    step({ seconds, elapsed: seconds * 1000, multiplier: 10 ** (seconds / 30), dt: 1 / 60 });
  }
}

test('OnlyFrens still reaches new goals in the third minute without growing its chat', async () => {
  const m = await sceneModule('onlyfrens/chat');
  const c = m.createChat();
  let lateGoals = 0;
  endurance(({ seconds, multiplier, dt }) => {
    const reached = m.stepChat(c, { running: true, multiplier, tension: Math.min(1, seconds / 30) }, dt);
    if (seconds > 120 && reached) lateGoals++;
    assert(c.messages.length <= 18);
    assert(c.menuIndex >= 0 && c.menuIndex < 10);
  });
  assert(lateGoals >= 4);
  assert(Number.isFinite(c.goal) && c.goal > 1_000_000);
  m.settleChat(c, 100_000);
  assert(Number.isFinite(c.fill.x));
  m.resetChat(c);
  assert.equal(c.goalIndex, 0);
});

test('Not Financial Advice keeps rotating sponsor props and stops them at the crash', async () => {
  const m = await sceneModule('not-financial-advice/studio');
  const s = m.createStudio();
  const lateProducts = new Set();
  endurance(({ seconds, dt }) => {
    m.stepStudio(s, { running: true, tension: 1, time: seconds, reads: 8 }, dt);
    if (seconds > 120 && s.events.read) lateProducts.add(s.read.index);
  });
  assert(lateProducts.size >= 4);
  m.endStudio(s, true);
  for (let i = 0; i < 900; i++) {
    m.stepStudio(s, { running: false, tension: 1, time: 180 + i / 60, reads: 8 }, 1 / 60);
    assert.equal(s.events.read, false);
  }
  m.resetStudio(s);
  assert.equal(s.encoreClock, 0);
});

test('Seed Round retains a visible endurance pack through 1000000× with bounded effects', async () => {
  const m = await sceneModule('seed-round/pack');
  const p = m.createPack();
  endurance(({ seconds, multiplier, dt }) => {
    m.stepPack(p, { racing: true, crashed: false, multiplier, tension: Math.min(1, seconds / 30) }, dt);
    assert(p.blobs.length < 50);
  });
  const escorts = p.swimmers.filter(sw => sw.kind === 'chad' && sw.state === 'swim' && sw.rel > -15 && sw.rel < 30);
  assert.equal(escorts.length, 7);
  assert.equal(p.swimmers.length, 235);
  const joined = m.createPack();
  m.settlePack(joined, 100_000, 180);
  assert.equal(joined.swimmers.filter(sw => sw.kind === 'chad' && sw.rel > -15 && sw.rel < 30).length, 7);
});

test('Gas Fees riders keep talking after the lift fills without spawning more bodies', async () => {
  const m = await sceneModule('gas-fees/riders');
  const c = m.createCrowd();
  m.settleCrowd(c, 100_000);
  let lateLines = 0;
  endurance(({ seconds, dt }) => {
    m.stepCrowd(c, { running: true, multiplier: 100_000, tension: 1, suitX: 450, gassed: false, gasAge: 0 }, dt);
    if (seconds > 120 && c.lines.some(line => line.age <= dt)) lateLines++;
    assert.equal(c.list.length, 9);
    assert(c.lines.length <= 2);
  });
  assert(lateLines >= 7);
  m.resetCrowd(c);
  assert.equal(c.chatterClock, 0);
  assert.equal(c.lines.length, 0);
});

test('Wife Changing Money continues its text exchange and caps the stored conversation', async () => {
  const m = await sceneModule('wife-changing-money/kitchen');
  const k = m.createKitchen();
  m.settleKitchen(k, 100_000, 1, null);
  let lateTexts = 0;
  endurance(({ seconds, dt }) => {
    m.stepKitchen(k, { running: true, multiplier: 100_000, fear: 1, time: seconds, traderGone: false, reduced: false }, dt);
    if (seconds > 120 && k.events.text) lateTexts++;
    assert(k.bubbles.length <= 6);
  });
  assert(lateTexts >= 7);
  for (let i = 0; i < 600; i++) {
    m.stepKitchen(k, { running: true, multiplier: 100_000, fear: 1, time: 180 + i / 60, traderGone: true, reduced: false }, 1 / 60);
    assert.equal(k.events.text, false);
  }
  m.resetKitchen(k);
  assert.equal(k.overtimeLine, 0);
});

for (const slug of ['pump-and-dump', 'bonding-curl']) {
  test(`${slug} chart records the current frame after 180 seconds and keeps bounded history`, async () => {
    const m = await sceneModule(`${slug}/gym`);
    const g = m.createGym();
    endurance(({ elapsed, multiplier, dt }) => {
      m.stepGym(g, { running: true, multiplier, growth: Math.log2(multiplier), tension: 1, elapsed, cracks: 1 }, dt);
      assert(g.trail.length <= 900);
    });
    assert.equal(g.trail.at(-1).x, 180_000);
    assert.equal(g.trail.at(-1).y, Math.log2(1_000_000));
    assert.equal(g.trail[0].x, 0);
    assert(g.trail.some(point => point.x > 90_000 && point.x < 180_000));
    m.settleTrail(g, 42_000, 12);
    assert.deepEqual(g.trail.at(-1), { x: 42_000, y: 12 });
  });
}

test('Blanket Champ settles missed prop motion using the supplied duration', async () => {
  const m = await sceneModule('blanket-champ/room');
  const early = m.createRoom(), late = m.createRoom();
  m.settleRoom(early, 1.5, true, 1000);
  m.settleRoom(late, 1.5, true, 30_000);
  assert.equal(early.glassFallen, false);
  assert.equal(late.glassFallen, true);
});

test('Exit Liquidity repeats helicopter drops for three minutes at a bounded crowd size', async () => {
  const m = await sceneModule('exit-liquidity/party');
  const water = await sceneModule('exit-liquidity/pool');
  const p = m.createParty(), pool = water.createPool();
  let lateSplashes = 0;
  endurance(({ seconds, multiplier, dt }) => {
    if (Math.abs(seconds % 12) < 0.0001) m.airdrop(p);
    const growth = Math.log2(multiplier);
    water.stepPool(pool, growth, true, dt);
    m.stepParty(p, pool, growth, true, 1, dt);
    if (seconds > 120 && p.events.splash) lateSplashes++;
    assert(p.holders.length <= 30);
  });
  assert(lateSplashes >= 4);
});

test('King of the Hill keeps its ape grounded and its arms within reach on the steepest hill', async () => {
  const m = await sceneModule('king-of-the-hill/ape');
  const coin = await sceneModule('king-of-the-hill/coin');
  const hill = await sceneModule('king-of-the-hill/hill');
  for (const growth of [0, 3, 8, Math.log2(100_000)]) {
    const c = coin.createCoin();
    coin.settleCoin(c, { x: 60 + 620 * growth, radius: 40 + 50 * (1 - Math.exp(-growth / 2)), growth, running: true });
    const pose = coin.coinPose(c);
    const anchor = { contactX: pose.contact.x, centre: pose.centre, r: pose.r };
    const ape = m.createApe();
    for (let i = 0; i < 120; i++) m.stepApe(ape, { anchor, walking: true, fear: Math.min(1, growth / 3), bump: false }, 1 / 60);
    const { hip, add } = m.apeFooting(ape, anchor);
    const shoulder = add(hip, 50 * Math.cos(ape.lean.x) - 6, 42 + 26 * Math.sin(ape.lean.x));
    const hands = m.apeHands(anchor);
    for (let i = 0; i < 2; i++) {
      const root = add(shoulder, i === 0 ? -8 : 8, i === 0 ? 0 : 2);
      assert(Math.hypot(root.x - hands[i].x, root.y - hands[i].y) < 122, `arm exceeds the rig reach at growth ${growth}`);
    }
    const onScreen = hill.toScreen({ x: pose.contact.x + 40, y: pose.contact.y + 70 }, hip);
    assert(onScreen.y < 510, 'hips should remain in the canvas');
  }
});

test('Balloon Pump fits its growing silhouette below the HUD through repeated inflation pulses', async () => {
  const m = await sceneModule('balloon-pump/balloon');
  const b = m.createBalloon();
  m.settleBalloon(b, { radius: 190, fear: 1, stretch: 1, inflow: false });
  for (let frame = 0; frame < 180 * 60; frame++) {
    m.stepBalloon(b, { radius: 190, fear: 1, stretch: 1, inflow: frame % 30 === 0 }, 1 / 60);
    const g = m.balloonGeometry(b);
    const top = g.centre.y - Math.hypot(g.rx * Math.sin(g.angle), g.ry * Math.cos(g.angle));
    assert(top >= 109.99, `balloon crossed the HUD at y=${top}`);
    assert(g.rx > 0 && g.ry > 0);
  }
});
