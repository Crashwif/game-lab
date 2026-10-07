import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = new URL('../../games/', import.meta.url);
const cache = new Map();
async function source(path) {
  if (!cache.has(path)) cache.set(path, build({ entryPoints: [fileURLToPath(new URL(path, root))], bundle: true, write: false, format: 'esm', platform: 'node' }).then(r => import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`)));
  return cache.get(path);
}
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('KYC links retain their length and bend continuously across complete scanner cycles', async () => {
  const { mechanicalElbow } = await source('know-your-clown/ministry.ts');
  for (const stage of [0, 1, 4, 5, 7]) {
    const previous = [];
    for (let i = 0; i <= 480; i++) {
      const phase = i / 480, motion = Math.sin(phase * Math.PI * 2), inspect = Math.sin(phase * Math.PI) ** 2;
      const ease = x => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
      const reach = ease((phase - .48) / .21) * (1 - ease((phase - .77) / .18));
      const arms = [
        [[340, 328], [429 + inspect * 15, (stage === 1 ? 285 : stage === 4 ? 355 : 260) + motion * 6], -1, 65, 85],
        [[682, 337], [591 - inspect * 10, stage === 5 ? 241 : 289 + motion * 12], 1, 65, 85],
        stage === 7 ? [[680, 223], [604, 204 + inspect * 80], 1, 90, 95] : [[681, 343], [590 + (514 - 590) * reach, 252 + (334 - 252) * reach], 1, 90, 95],
      ];
      arms.forEach(([base, end, side, upper, lower], arm) => {
        const elbow = mechanicalElbow(base, end, side, upper, lower);
        assert.ok(Math.abs(distance(base, elbow) - upper) < 1e-7);
        assert.ok(Math.abs(distance(elbow, end) - lower) < 1e-7);
        if (previous[arm]) assert.ok(distance(previous[arm], elbow) < 5, `stage ${stage} arm ${arm} should not flip`);
        previous[arm] = elbow;
      });
    }
  }
});

test('OnlyFrens sleeves keep two 48-unit bones through wave, kiss and shock', async () => {
  const { sleeveElbow } = await source('onlyfrens/stream.ts');
  for (const side of [-1, 1]) for (let i = 0; i <= 100; i++) {
    const wave = i / 100, root = { x: side * 60, y: -80 };
    for (const hand of [{ x: side > 0 ? 70 + 22 * wave : -70, y: side > 0 ? -6 - 152 * wave : -6 }, { x: side * 30, y: -140 }, { x: side * 30, y: -150 }]) {
      const e = sleeveElbow(root, hand, side);
      assert.ok(Math.abs(Math.hypot(e.x - root.x, e.y - root.y) - 48) < 1e-7);
      assert.ok(Math.abs(Math.hypot(hand.x - e.x, hand.y - e.y) - 48) < 1e-7);
    }
  }
});

test('Wife typing contacts cancel body bob and remain reachable from the seated shoulders', async () => {
  const { typingHands } = await source('wife-changing-money/trader.ts');
  const { DESK, KEYBOARD_HANDS } = await source('wife-changing-money/kitchen.ts');
  for (let i = 0; i < 600; i++) {
    const time = i / 4, bob = Math.sin(time * 13) * 5, tap = Math.sin(time * 16) * 1.5;
    const hands = typingHands(DESK.x, DESK.y, bob, tap);
    hands.forEach((hand, index) => {
      assert.equal(hand.x + DESK.x, KEYBOARD_HANDS[index].x);
      assert.ok(Math.abs(hand.y + DESK.y + bob - KEYBOARD_HANDS[index].y) <= 1.5 + 1e-8);
      assert.ok(Math.hypot(hand.x - (index ? 14 : -14), hand.y + 46) < 50, 'keyboard is inside fixed arm reach');
    });
  }
});

test('Wife cashout travels along the floor before entering the stair footprint', async () => {
  const { exitPose } = await source('wife-changing-money/trader.ts');
  for (let time = .25; time < 2.05; time += .01) assert.equal(exitPose(time).y, 470);
  for (let time = 2.05; time < 5; time += .01) {
    const p = exitPose(time);
    assert.ok(p.x >= 700 + (470 - p.y) / 2, 'ascending feet remain over the stairs');
  }
});

test('I Got Hacked holds every completed excuse for at least 1.8 seconds at maximum tension', async () => {
  const { createMansion, stepMansion, EXCUSES, excuseDuration } = await source('i-got-hacked/mansion.ts');
  for (const text of EXCUSES) assert.ok(excuseDuration(text) >= text.length * .028 + 1.8);
  const m = createMansion(); let changes = 0, seen = null;
  for (let frame = 0; frame < 1200; frame++) {
    const priorAge = m.excuseAge, prior = m.excuse;
    stepMansion(m, { running: true, tension: 1, multiplier: 1000, reduced: false }, 1 / 60);
    if (m.events.excuse) {
      if (seen !== null) assert.ok(priorAge >= EXCUSES[prior].length * .028 + 1.8 - 1 / 60, `${EXCUSES[prior]} was readable`);
      changes++; seen = m.excuse;
    }
  }
  assert.ok(changes >= 5, 'the readability fix still permits continuing content');
});

const games = ['blanket-champ','andys-loud-garden','gas-fees','onlyfrens','wife-changing-money','not-financial-advice','family-meeting','thanksgiving-uncle','hopium-drip','i-got-hacked'];
for (const game of games) test(`${game} has distinct physical late acts and intervening relief`, async () => {
  const { actAt, drawAct } = await source(`${game}/acts.ts`);
  const poses = [60, 90, 120, 150].map(seconds => actAt(seconds * 1000));
  assert.equal(new Set(poses.map(x => x.stage)).size, 4);
  const commands = poses.map(pose => {
    const events = [];
    const c = new Proxy({}, { get: (_, method) => (...args) => { for (const a of args) if (typeof a === 'number') assert.ok(Number.isFinite(a)); events.push([method,...args]); }, set: () => true });
    drawAct(c, pose);
    return JSON.stringify(events);
  });
  assert.equal(new Set(commands).size, 4, 'actual drawn geometry changes, not only captions');
  for (const at of [32, 52, 75, 100, 125, 145]) {
    assert.ok(actAt((at + 5) * 1000).effort < actAt((at + 12) * 1000).effort - .2, 'calming beat precedes renewed effort');
    assert.equal(actAt((at + 5) * 1000, true).pulse, 0, 'reduced motion removes prop oscillation');
  }
});
