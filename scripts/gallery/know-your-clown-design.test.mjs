import assert from 'node:assert/strict';
import { test } from 'node:test';
import { directionAt } from '../../games/know-your-clown/direction.ts';

test('KYC retains its accumulated escalation when the dog hearing returns', () => {
  assert.equal(directionAt(0).level, 0);
  const climax = directionAt(42_000);
  const appeal = directionAt(50_000);
  assert.equal(climax.level, 7);
  assert.equal(appeal.stage, 2, 'the recurring appointment uses the dog witness apparatus');
  assert.notEqual(appeal.stage, climax.stage);
  assert.equal(appeal.level, climax.level, 'returning to an earlier procedure retains the applicant and machinery escalation');
});

test('all recurring KYC procedures preserve full escalation across repeated audit cycles', () => {
  const procedures = new Set();
  for (let appointment = 0; appointment < 18; appointment++) {
    const elapsed = 50_000 + appointment * 12_000;
    const arrival = directionAt(elapsed);
    const departure = directionAt(elapsed + 11_999);
    procedures.add(arrival.stage);
    assert.equal(arrival.level, 7, `${arrival.title} starts with the accumulated escalation`);
    assert.equal(departure.level, 7, `${arrival.title} retains it throughout the inspection`);
    assert.equal(departure.stage, arrival.stage);
  }
  assert.equal(procedures.size, 6, 'preserving escalation still permits every recurring apparatus to appear');
});

test('a direct jump into a long KYC round reconstructs its escalation without prior frames', () => {
  for (const elapsed of [50_001, 245_000, 600_000, 3_600_000]) {
    const joined = directionAt(elapsed);
    assert.equal(joined.level, 7);
    directionAt(0);
    directionAt(27_000);
    directionAt(42_000);
    assert.equal(directionAt(elapsed).level, joined.level);
  }
  assert.equal(directionAt(0).level, 0, 'the next round begins without the previous round\'s accumulated appearance');
});
