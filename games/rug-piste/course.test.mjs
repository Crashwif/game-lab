import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld, driveAt, slopeDistance, stepWorld } from './course.ts';

const commands = (changes = {}) => ({ steer: 0, target: null, jump: false, touched: true, ...changes });
const contact = (kind) => {
  const world = createWorld();
  world.objects = [{ id: 1_000_000, kind, x: world.x, z: world.distance + 8, used: false }];
  return world;
};

test('a collectible scores once even while the skier remains in contact', () => {
  const world = contact('coin');
  assert.deepEqual(stepWorld(world, 0.02, commands()), ['coin']);
  assert.equal(world.coins, 1);
  assert.ok(world.style > 0);
  const earnedStyle = world.style;

  for (let frame = 0; frame < 100; frame++) stepWorld(world, 0.02, commands());
  assert.equal(world.coins, 1);
  assert.equal(world.style, earnedStyle);
});

test('jumping clears low obstacles while a tree still causes a stumble', () => {
  for (const kind of ['rug', 'rock']) {
    const grounded = contact(kind);
    assert.ok(stepWorld(grounded, 0.02, commands()).includes('bonk'));
    assert.equal(grounded.bonks, 1);

    const airborne = contact(kind);
    airborne.jumpLeft = 0.5;
    assert.equal(stepWorld(airborne, 0.02, commands()).includes('bonk'), false);
    assert.equal(airborne.bonks, 0);
    assert.ok(airborne.style > 0);
  }

  const tree = contact('tree');
  tree.jumpLeft = 0.5;
  assert.ok(stepWorld(tree, 0.02, commands()).includes('bonk'));
  assert.equal(tree.bonks, 1);
  assert.ok(tree.stumble > 0);
});

test('repeated hits and player commands do not end the local ski run', () => {
  const world = createWorld();
  for (let frame = 0; frame < 600; frame++) {
    world.objects = [{ id: frame, kind: 'tree', x: world.x, z: world.distance + 5, used: false }];
    stepWorld(world, 0.05, commands({ steer: frame % 2 ? -1 : 1 }));
  }
  assert.ok(world.bonks > 10, 'the skier experienced repeated collisions');
  assert.ok(world.distance > 1_000, 'collisions slow skiing but cannot end the run');

  const distanceAfterHits = world.distance;
  world.objects = [];
  for (let frame = 0; frame < 240; frame++) stepWorld(world, 1 / 60, commands({ steer: 1, jump: frame === 90 }));
  assert.ok(world.distance > distanceAfterHits + 300, 'skiing continues after recovering');
  assert.ok(world.x > 0.85 && world.x < 1, 'steering remains available within the slope');
});

test('ten-minute play and late entry retain bounded, usable scenery', () => {
  const world = createWorld();
  for (let frame = 0; frame < 600 * 60; frame++) stepWorld(world, 1 / 60, commands({ touched: false }));
  assert.ok(world.distance > 60_000, 'the slope continues after a full music cycle');
  assert.ok(world.objects.length > 0 && world.objects.length < 150, 'scenery remains bounded');
  assert.ok(world.trails.length < 200, 'ski tracks remain bounded');
  assert.ok(world.coins > 0, 'collectibles remain playable');
  assert.ok(Number.isFinite(world.x) && Number.isFinite(world.style));

  const late = createWorld(600_000);
  assert.ok(late.distance > 60_000);
  assert.ok(late.objects.length > 0 && late.objects.length < 150);
  assert.equal(late.coins, 0, 'a late arrival does not invent collected coins');
  assert.equal(late.style, 0);
  const before = late.distance;
  stepWorld(late, 1 / 60, commands());
  assert.ok(late.distance > before);
});

test('the run speeds up with the multiplier, and late entry matches it at any frame rate', () => {
  for (const hz of [30, 60, 144]) {
    const world = createWorld(0, 3);
    for (let frame = 1; frame <= 30 * hz; frame++) {
      const seconds = frame / hz;
      world.objects = [];
      stepWorld(world, 1 / hz, commands(), driveAt(100 * 10 ** (seconds / 30), seconds * 1000));
      if (frame === 9 * hz) assert.ok(world.speed > 215 && world.speed < 230, `2× runs near 225 units/s at ${hz} Hz`);
    }
    assert.ok(Math.abs(world.distance - slopeDistance(30)) < 80, `late entry reconstructs the 30-second distance at ${hz} Hz`);
    assert.ok(world.speed <= 300, 'speed is capped');
  }
  assert.equal(driveAt(100, 0).speed, 0, 'the run pushes off from the gate');
});

test('each round lays its own slope, and the extra hazards arrive only from 1.5×', () => {
  const lanes = seed => createWorld(0, seed).objects.filter(o => o.kind === 'coin').map(o => o.x).join();
  assert.notEqual(lanes(1), lanes(2), 'a fresh local seed changes the layout');
  assert.equal(lanes(5), lanes(5), 'one seed always lays the same slope');
  const extra = world => world.objects.filter(o => o.id % 10 >= 6).length;
  assert.equal(extra(createWorld(4000, 9, driveAt(136, 4000))), 0);
  assert.ok(extra(createWorld(9000, 9, driveAt(200, 9000))) > 2, 'second blockers and coin-line hazards from 1.5×');
});

test('a bonk spills a quarter of the arcade bag, and a jump pressed in the air lands on touchdown', () => {
  const world = contact('tree');
  world.coins = 8;
  assert.ok(stepWorld(world, 0.02, commands()).includes('bonk'));
  assert.equal(world.coins, 6);
  assert.equal(world.spilled, 2);

  const air = createWorld();
  air.jumpLeft = 0.1;
  stepWorld(air, 0.02, commands({ jump: true }));
  let landed = [];
  for (let frame = 0; frame < 6 && !landed.includes('jump'); frame++) landed = stepWorld(air, 0.02, commands());
  assert.ok(landed.includes('jump'), 'the buffered press fires once the skier is down');
});

test('a skier trailing the camera collects and lays tracks where he is drawn, not at the camera line', () => {
  const world = createWorld(0, 3);
  const coin = { id: 1, kind: 'coin', x: world.x, z: world.distance + 10, used: false };
  world.objects = [coin];
  world.speed = 155;
  world.behind = 60;
  let collectedAt = null;
  for (let frame = 0; frame < 40 && collectedAt === null; frame++) {
    world.behind = Math.max(0, world.behind - 2);
    if (stepWorld(world, 1 / 50, commands()).includes('coin')) collectedAt = world.distance - world.behind;
  }
  assert.ok(collectedAt !== null && Math.abs(collectedAt - coin.z) < 15, 'the coin goes when the skier himself reaches it');
  assert.ok(world.trails.length > 0 && world.trails.every(t => t.z <= world.distance - world.behind), 'tracks never appear ahead of the skier');
});
