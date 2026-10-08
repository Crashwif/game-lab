import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorld, stepWorld } from './course.ts';

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
