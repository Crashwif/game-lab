import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { chromium } from 'playwright';

let compiledBundle;

async function createHeadlessHarness(options = { portrait: false, replayMode: false }) {
  compiledBundle ??= await build({
    stdin: {
      contents: `
        export * from './content';
        export * from './layout';
        export * from './feed';
        export * from './character';
        export * from './endings';
        export * from './input';
        export * from './scene';
      `,
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      sourcefile: 'harness-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'RageBait',
    plugins: [
      {
        name: 'mock-audio',
        setup(bundler) {
          bundler.onResolve({ filter: /^\.\/audio$/ }, () => ({
            path: 'audio',
            namespace: 'mock-audio',
          }));
          bundler.onLoad({ filter: /.*/, namespace: 'mock-audio' }, () => ({
            contents: 'export const pageAudio = () => globalThis.__mockAudio;',
          }));
        },
      },
    ],
  });

  const audioEvents = [];
  const canvasListeners = new Map();
  const windowListeners = new Map();
  const capturedPointers = new Set();
  const drawnTexts = [];

  let nowValue = 1_000;
  let liveNode = null;

  const mockCtx = new Proxy(
    {
      canvas: null,
      fillText(text) {
        drawnTexts.push(String(text));
      },
      measureText(text) {
        return { width: String(text).length * 9 };
      },
      createLinearGradient() {
        return { addColorStop() {} };
      },
      createRadialGradient() {
        return { addColorStop() {} };
      },
    },
    {
      get(target, prop) {
        return prop in target ? target[prop] : () => {};
      },
    },
  );

  const mockCanvas = {
    width: options.portrait ? 540 : 960,
    height: options.portrait ? 800 : 540,
    clientWidth: options.portrait ? 390 : 960,
    clientHeight: options.portrait ? 578 : 540,
    tabIndex: -1,
    attributes: new Map([['aria-label', 'Rage Bait']]),
    parentElement: {
      appendChild(el) {
        liveNode = el;
      },
    },
    hasAttribute(name) {
      return this.attributes.has(name);
    },
    getAttribute(name) {
      return this.attributes.get(name) ?? null;
    },
    setAttribute(name, val) {
      this.attributes.set(name, String(val));
    },
    getBoundingClientRect() {
      return {
        left: 0,
        top: 0,
        width: this.clientWidth,
        height: this.clientHeight,
        right: this.clientWidth,
        bottom: this.clientHeight,
      };
    },
    getContext() {
      return mockCtx;
    },
    addEventListener(type, fn) {
      if (!canvasListeners.has(type)) canvasListeners.set(type, new Set());
      canvasListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      canvasListeners.get(type)?.delete(fn);
    },
    setPointerCapture(id) {
      capturedPointers.add(id);
    },
    hasPointerCapture(id) {
      return capturedPointers.has(id);
    },
    releasePointerCapture(id) {
      capturedPointers.delete(id);
    },
    focus() {},
  };
  mockCtx.canvas = mockCanvas;

  const sandbox = {
    performance: { now: () => nowValue },
    Date: { now: () => nowValue },
    Math,
    Number,
    String,
    Object,
    Array,
    Map,
    Set,
     HTMLInputElement: class {},
    HTMLSelectElement: class {},
    HTMLTextAreaElement: class {},
    HTMLButtonElement: class {},
    __mockAudio: {
      mode: 'on',
      enabled: true,
      context: null,
      bus: null,
      update(phase, tension) {
        audioEvents.push({ type: 'update', phase, tension });
      },
      fx(name, strength) {
        audioEvents.push({ type: 'fx', name, strength });
      },
      cashout() {
        audioEvents.push({ type: 'cashout' });
      },
      crash(name, quiet) {
        audioEvents.push({ type: 'crash', name, quiet });
      },
    },
    document: {
      documentElement: {
        dataset: { mode: options.replayMode ? 'replay' : 'standalone' },
      },
      activeElement: mockCanvas,
      body: {
        appendChild(el) {
          liveNode = el;
        },
      },
      querySelector(sel) {
        return sel === 'canvas' ? mockCanvas : null;
      },
      getElementById(id) {
        return id === 'rage-bait-live' ? liveNode : null;
      },
      createElement() {
        return {
          id: '',
          style: {},
          textContent: '',
          setAttribute() {},
        };
      },
    },
    window: {
      addEventListener(type, fn) {
        if (!windowListeners.has(type)) windowListeners.set(type, new Set());
        windowListeners.get(type).add(fn);
      },
      removeEventListener(type, fn) {
        windowListeners.get(type)?.delete(fn);
      },
    },
  };

  runInNewContext(compiledBundle.outputFiles[0].text, sandbox);
  const api = sandbox.RageBait;

  return {
    api,
    mockCanvas,
    mockCtx,
    audioEvents,
    drawnTexts,
    canvasListeners,
    windowListeners,
    capturedPointers,
    getLiveText: () => liveNode?.textContent ?? '',
    setNow: (ms) => {
      nowValue = ms;
    },
    advanceNow: (deltaMs) => {
      nowValue += deltaMs;
      return nowValue;
    },
  };
}

test('Arm IK preserves both bone lengths at coincident, folded, and unreachable targets', async () => {
  const { api } = await createHeadlessHarness();
  const origin = { x: 20, y: 30 };
  for (const target of [origin, { x: 20.1, y: 30 }, { x: 45, y: 90 }, { x: -500, y: 300 }]) {
    for (const pole of [-1, 1]) {
      const { joint, effector } = api.solveLimb(origin, target, 64, 62, pole);
      assert.ok(Math.abs(Math.hypot(joint.x - origin.x, joint.y - origin.y) - 64) < 1e-7);
      assert.ok(Math.abs(Math.hypot(effector.x - joint.x, effector.y - joint.y) - 62) < 1e-7);
    }
  }
});

test('Left hand supports the tilted phone while the right thumb types and presses Post in both layouts', async () => {
  const { api } = await createHeadlessHarness();
  const input = {
    phase: 'running', currentX100: 1_000, elapsedMs: 18_000, crashAgeSec: 0,
    exitAgeSec: null, tension: 0.9, dtSec: 1 / 60, propKind: null,
    cardAdvanceEvent: false, replyToggleEvent: false,
    draft: api.evaluateDraft(api.createFeed(0), 'running', 1_000, 18_000, 0, null),
  };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const phoneLocal = (pose, p) => {
    const dx = (p.x - pose.phone.center.x) / pose.scale;
    const dy = (p.y - pose.phone.center.y) / pose.scale;
    return { x: dx * Math.cos(pose.phone.angle) + dy * Math.sin(pose.phone.angle),
      y: -dx * Math.sin(pose.phone.angle) + dy * Math.cos(pose.phone.angle) };
  };
  function checkPose(state, layout, drive, previous = null) {
    const pose = api.characterPose(state, layout, { ...drive, nowMs: drive.elapsedMs + drive.crashAgeSec * 1000 + (drive.exitAgeSec ?? 0) * 1000 });
    for (const side of ['left', 'right']) {
      const arm = pose[side];
      assert.ok(Math.abs(distance(pose[`${side}Shoulder`], arm.joint) / pose.scale - 64) < 1e-7);
      assert.ok(Math.abs(distance(arm.joint, arm.effector) / pose.scale - 62) < 1e-7);
      if (previous) {
        assert.ok(distance(arm.joint, previous[side].joint) / pose.scale < 700 * drive.dtSec, `${side} elbow jumped`);
      }
    }
    const grip = phoneLocal(pose, pose.left.effector);
    assert.ok(grip.x < -pose.phone.width / 2 && grip.x > -pose.phone.width / 2 - 9, 'Left palm must touch the phone edge');
    assert.ok(Math.abs(grip.y) <= pose.phone.height / 2, 'Grip must stay alongside the phone');
    if (drive.exitAgeSec === null && (drive.phase !== 'crashed' || drive.crashAgeSec <= 0.3)) {
      const tip = phoneLocal(pose, pose.thumb.effector);
      assert.ok(distance(pose.thumb.effector, pose.screenTarget) < 1e-7, 'Right thumb must reach its screen target');
      assert.ok(Math.abs(tip.x) <= 15 && Math.abs(tip.y) <= 29, 'Right thumb stays on the screen');
      assert.ok(phoneLocal(pose, pose.right.effector).x > pose.phone.width / 2, 'Right palm stays beside the phone');
      assert.ok(pose.right.joint.x > pose.rightShoulder.x, 'Right elbow must bend outward');
    }
    return pose;
  }

  for (const portrait of [false, true]) {
    const layout = api.getLayout(portrait);
    for (const fps of [30, 60, 120]) {
      const state = api.createCharacterState();
      let drive = { ...input, dtSec: 1 / fps };
      api.settleCharacter(state, drive);
      let previous = checkPose(state, layout, drive);
      // Two full acting slots include reading, typing, and hovering.
      for (let frame = 1; frame <= fps * 8; frame++) {
        drive = { ...drive, elapsedMs: 18_000 + frame * 1000 / fps };
        api.updateCharacter(state, drive);
        previous = checkPose(state, layout, drive, previous);
      }
      for (let frame = 0; frame <= fps * 1.5; frame++) {
        drive = { ...drive, phase: 'crashed', crashAgeSec: frame / fps };
        api.updateCharacter(state, drive);
        previous = checkPose(state, layout, drive, previous);
      }
      // Return to typing, then place the phone down without losing the supporting hand.
      drive = { ...input, dtSec: 1 / fps };
      api.settleCharacter(state, drive);
      previous = checkPose(state, layout, drive);
      for (let frame = 0; frame <= fps * 2; frame++) {
        drive = { ...drive, exitAgeSec: frame / fps };
        api.updateCharacter(state, drive);
        previous = checkPose(state, layout, drive, previous);
      }
    }
    // Late entry reconstructs the same supported pose without missed animation frames.
    for (const variant of [
      { phase: 'waiting', elapsedMs: 0 }, { phase: 'betting', elapsedMs: 0 },
      { elapsedMs: 150_000 }, { phase: 'crashed', crashAgeSec: 0.2 },
      { phase: 'crashed', crashAgeSec: 2 }, { exitAgeSec: 0.4 }, { exitAgeSec: 2 },
      { phase: 'crashed', crashAgeSec: 2, exitAgeSec: 3 },
    ]) {
      const state = api.createCharacterState();
      const drive = { ...input, ...variant };
      api.settleCharacter(state, drive);
      const pose = checkPose(state, layout, drive);
      if (drive.phase === 'crashed' && drive.crashAgeSec === 0.2) {
        const tip = phoneLocal(pose, pose.thumb.effector);
        assert.ok(tip.x >= 4 && tip.x <= 13 && tip.y >= 16 && tip.y <= 24, 'Press lands inside Post');
      }
    }
  }
});

test('Content bank: 6 recurring accounts, 24 tiered cards, 9 draft steps, 6 crash responses, 8 overtime follow-ups, and 5 overtime props', async () => {
  const { api } = await createHeadlessHarness();
  assert.equal(api.ACCOUNTS.length, 6);
  assert.equal(api.BAIT_CARDS.length, 24);
  assert.equal(api.DRAFT_LADDER.length, 9);
  assert.equal(api.CRASH_RESPONSES.length, 6);
  assert.equal(api.OVERTIME_FOLLOWUPS.length, 8);
  assert.equal(api.OVERTIME_PROPS.length, 5);
  assert.equal(api.SUCCESS_CAPTIONS.length, 3);

  for (let tier = 1; tier <= 6; tier++) {
    const cards = api.BAIT_CARDS.filter((c) => c.tier === tier);
    assert.equal(cards.length, 4, `Tier ${tier} must have 4 authored cards`);
    for (const c of cards) {
      assert.ok(api.ACCOUNT_BY_ID[c.accountId], `Card ${c.id} references valid account`);
      assert.ok(api.DRAFT_BY_ID[c.draftId], `Card ${c.id} references valid draft step`);
      assert.ok(api.CRASH_RESPONSE_BY_ID[c.crashReplyId], `Card ${c.id} references valid crash response`);
      assert.ok(c.replies.length >= 2, `Card ${c.id} provides expanded replies`);
    }
  }
});

test('Tier progression, callback preference, and account alternation across multipliers', async () => {
  const { api } = await createHeadlessHarness();
  assert.equal(api.tierForX100(100), 1);
  assert.equal(api.tierForX100(129), 1);
  assert.equal(api.tierForX100(130), 2);
  assert.equal(api.tierForX100(170), 3);
  assert.equal(api.tierForX100(230), 4);
  assert.equal(api.tierForX100(350), 5);
  assert.equal(api.tierForX100(600), 6);
  assert.equal(api.tierForX100(2000), 6);

  // Verify callback preference when current card has a direct callback in the next tier
  const rb01 = api.CARD_BY_ID['rb-01']; // soft-life
  const chosenCallback = api.selectCardForSlot(0, 2, 1, ['rb-01'], ['soft-life'], rb01);
  assert.equal(chosenCallback.id, 'rb-05', 'rb-05 is a direct callback to rb-01 in Tier 2');

  // Verify no account ever appears 3 times in a row across 24 consecutive slots
  const recentIds = [];
  const recentAccounts = [];
  let prev = null;
  for (let slot = 0; slot < 24; slot++) {
    const tier = Math.min(6, 1 + Math.floor(slot / 2));
    const next = api.selectCardForSlot(0, tier, slot, recentIds, recentAccounts, prev);
    if (prev) {
      assert.notEqual(next.id, prev.id, `Slot ${slot} must not immediately repeat card ${prev.id}`);
    }
    if (recentAccounts.length >= 2) {
      const a1 = recentAccounts[recentAccounts.length - 1];
      const a2 = recentAccounts[recentAccounts.length - 2];
      if (a1 === a2) {
        assert.notEqual(
          next.accountId,
          a1,
          `Account ${next.accountId} must not appear 3 times in a row at slot ${slot}`,
        );
      }
    }
    recentIds.push(next.id);
    if (recentIds.length > 6) recentIds.shift();
    recentAccounts.push(next.accountId);
    if (recentAccounts.length > 6) recentAccounts.shift();
    prev = next;
  }
});

test('Overtime loop beyond 20.00x cycles through 8 follow-ups and 5 prop variations without freezing', async () => {
  const { api, mockCanvas, mockCtx, setNow, advanceNow } = await createHeadlessHarness();
  api.resetPresentationSession(0);
  const scene = api.createScene(mockCanvas);

  setNow(1_000);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 100,
      elapsed: 0,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    1_000,
  );

  const followupsSeen = new Set();
  const propsSeen = new Set();

  for (let slot = 6; slot < 16; slot++) {
    const now = advanceNow(4_000);
    const elapsed = slot * 4_000 + 200;
    scene.draw(
      mockCtx,
      {
        phase: 'running',
        currentX100: 2_500 + slot * 100,
        elapsed,
        crashAge: 0,
        stake: 50,
        cashoutX100: null,
        payout: null,
      },
      now,
    );
    const st = mockCanvas.__rageBaitState;
    assert.equal(st.tier, 6);
    assert.ok(st.overtimeAct !== null && st.overtimeAct >= 0);
    assert.ok(st.followupText, `Slot ${slot} has overtime follow-up text`);
    assert.ok(st.propKind, `Slot ${slot} has overtime propKind`);
    followupsSeen.add(st.followupText);
    propsSeen.add(st.propKind);
  }

  assert.equal(followupsSeen.size, 8, 'All 8 overtime follow-ups cycle cleanly');
  assert.equal(propsSeen.size, 5, 'All 5 overtime prop kinds cycle cleanly');
  scene.dispose();
});

test('Confirmed cash-out precedence over crash: DRAFT DELETED, APP CLOSED, and "You left before this."', async () => {
  const { api, mockCanvas, mockCtx, drawnTexts, setNow, advanceNow } = await createHeadlessHarness();
  api.resetPresentationSession(0);
  const scene = api.createScene(mockCanvas);

  // Start running round
  setNow(1_000);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 180,
      elapsed: 2_000,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    1_000,
  );
  assert.equal(mockCanvas.__rageBaitState.appClosed, false);

  // Backend confirms cash-out at 2.40x -> 0..0.25s shows DRAFT DELETED
  const tConfirm = advanceNow(100);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 240,
      elapsed: 5_000,
      crashAge: 0,
      stake: 50,
      cashoutX100: 240,
      payout: 120,
    },
    tConfirm,
  );
  assert.equal(mockCanvas.__rageBaitState.thumbAction, 'select-delete');
  assert.ok(drawnTexts.some((t) => t.includes('DRAFT DELETED')));

  // Advance 0.8s -> APP CLOSED & peaceful expression
  const tLocked = advanceNow(800);
  drawnTexts.length = 0;
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 310,
      elapsed: 5_800,
      crashAge: 0,
      stake: 50,
      cashoutX100: 240,
      payout: 120,
    },
    tLocked,
  );
  assert.equal(mockCanvas.__rageBaitState.appClosed, true);
  assert.equal(mockCanvas.__rageBaitState.expression, 'peaceful');
  assert.ok(drawnTexts.some((t) => t.includes('APP CLOSED')));
  assert.ok(drawnTexts.some((t) => t.includes('2.40x')));

  // Room subsequently crashes at 4.50x -> must NOT show TOOK THE BAIT; must show "You left before this."
  const tCrash = advanceNow(1_200);
  drawnTexts.length = 0;
  scene.draw(
    mockCtx,
    {
      phase: 'crashed',
      currentX100: 450,
      elapsed: 7_000,
      crashAge: 1_200,
      stake: 50,
      cashoutX100: 240,
      payout: 120,
    },
    tCrash,
  );
  assert.equal(mockCanvas.__rageBaitState.appClosed, true);
  assert.equal(mockCanvas.__rageBaitState.tookTheBait, false);
  assert.equal(mockCanvas.__rageBaitState.activeParticleCount, 0);
  assert.ok(drawnTexts.some((t) => t.includes('You left before this.')));
  assert.ok(!drawnTexts.some((t) => t.includes('TOOK THE BAIT')));
  scene.dispose();
});

test('Crash without exit progresses through freeze, Post press, 36-particle burst, bait reply, and TOOK THE BAIT', async () => {
  const { api, mockCanvas, mockCtx, drawnTexts, setNow, advanceNow } = await createHeadlessHarness();
  api.resetPresentationSession(0);
  const scene = api.createScene(mockCanvas);

  setNow(1_000);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 100,
      elapsed: 0,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    1_000,
  );

  // Advance to 3.80x running
  let now = advanceNow(4_200);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 380,
      elapsed: 4_200,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    now,
  );
  const cardBeforeCrash = mockCanvas.__rageBaitState.activeCardId;

  // 0.05s crashAge: freeze & eyes lock
  now = advanceNow(50);
  scene.draw(
    mockCtx,
    {
      phase: 'crashed',
      currentX100: 380,
      elapsed: 4_250,
      crashAge: 50,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    now,
  );
  assert.equal(mockCanvas.__rageBaitState.activeCardId, cardBeforeCrash, 'Card freezes at crash');
  assert.equal(mockCanvas.__rageBaitState.expression, 'crash-lock');
  assert.equal(mockCanvas.__rageBaitState.thumbAction, 'hover-post');

  // 0.20s crashAge: thumb presses Post
  now = advanceNow(150);
  scene.draw(
    mockCtx,
    {
      phase: 'crashed',
      currentX100: 380,
      elapsed: 4_250,
      crashAge: 200,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    now,
  );
  assert.equal(mockCanvas.__rageBaitState.thumbAction, 'post-press');

  // 0.45s crashAge: notification burst (<= 36 particles, <= 3 live toasts)
  now = advanceNow(250);
  scene.draw(
    mockCtx,
    {
      phase: 'crashed',
      currentX100: 380,
      elapsed: 4_250,
      crashAge: 450,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    now,
  );
  assert.equal(mockCanvas.__rageBaitState.activeParticleCount, 36);
  assert.equal(mockCanvas.__rageBaitState.activeToastCount, 3);
  assert.equal(mockCanvas.__rageBaitState.expression, 'posted-shock');

  // 0.80s crashAge: bait account reply lands
  now = advanceNow(350);
  drawnTexts.length = 0;
  scene.draw(
    mockCtx,
    {
      phase: 'crashed',
      currentX100: 380,
      elapsed: 4_250,
      crashAge: 800,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    now,
  );
  assert.ok(drawnTexts.some((t) => t.includes('replied · 1s ago')));

  // 1.20s crashAge: TOOK THE BAIT stamp settles
  now = advanceNow(400);
  drawnTexts.length = 0;
  scene.draw(
    mockCtx,
    {
      phase: 'crashed',
      currentX100: 380,
      elapsed: 4_250,
      crashAge: 1_200,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    now,
  );
  assert.equal(mockCanvas.__rageBaitState.tookTheBait, true);
  assert.ok(drawnTexts.some((t) => t.includes('TOOK THE BAIT')));
  scene.dispose();
});

test('Spectator round (stake === null, cashoutX100 === null) shows spectator copy without personal loss', async () => {
  const { api, mockCanvas, mockCtx, drawnTexts, setNow } = await createHeadlessHarness();
  api.resetPresentationSession(0);
  const scene = api.createScene(mockCanvas);

  setNow(2_000);
  drawnTexts.length = 0;
  scene.draw(
    mockCtx,
    {
      phase: 'crashed',
      currentX100: 275,
      elapsed: 6_000,
      crashAge: 1_300,
      stake: null,
      cashoutX100: null,
      payout: null,
    },
    2_000,
  );
  assert.ok(drawnTexts.some((t) => t.includes('SPECTATING · CRASHED AT 2.75x')));
  assert.ok(!drawnTexts.some((t) => t.includes('YOU REPLIED AT')));
  scene.dispose();
});

test('Late entry mid-round and post-crash settles springs immediately and stays silent until next transition', async () => {
  const { api, mockCanvas, mockCtx, audioEvents, setNow, advanceNow } = await createHeadlessHarness();
  api.resetPresentationSession(0);
  const scene = api.createScene(mockCanvas);

  // Late entry directly at 4.20x (16.5s into running round)
  setNow(5_000);
  audioEvents.length = 0;
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 420,
      elapsed: 16_500,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    5_000,
  );

  const st = mockCanvas.__rageBaitState;
  assert.equal(st.tier, 5);
  assert.ok(st.historyLength <= 5, 'Late entry reconstructs bounded history without simulating all missed frames');
  const fxEvents = audioEvents.filter((e) => e.type !== 'update');
  assert.equal(fxEvents.length, 0, 'Late entry must not fire past sound effects');

  // Next slot transition fires live card advance cue normally
  const nextNow = advanceNow(4_000);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 460,
      elapsed: 20_500,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    nextNow,
  );
  assert.ok(audioEvents.some((e) => e.type === 'fx' && e.name === 'whoosh'));
  scene.dispose();
});

test('Pointer capture only inside feedRect, 12 CSS px swipe threshold, and full listener cleanup on dispose', async () => {
  const {
    api,
    mockCanvas,
    mockCtx,
    canvasListeners,
    windowListeners,
    capturedPointers,
    setNow,
  } = await createHeadlessHarness();
  api.resetPresentationSession(0);
  const scene = api.createScene(mockCanvas);

  setNow(1_000);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 150,
      elapsed: 1_000,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    1_000,
  );

  // 1. pointerdown in header (outside feedRect) must NOT capture pointer
  for (const fn of canvasListeners.get('pointerdown') ?? []) {
    fn({ button: 0, pointerId: 11, clientX: 100, clientY: 20 });
  }
  assert.equal(capturedPointers.has(11), false);

  // 2. pointerdown inside feedRect captures pointer
  const layout = mockCanvas.__rageBaitState.layout;
  const replyX = layout.repliesHitRect.x + 30;
  const replyY = layout.repliesHitRect.y + 20;
  for (const fn of canvasListeners.get('pointerdown') ?? []) {
    fn({ button: 0, pointerId: 22, clientX: replyX, clientY: replyY });
  }
  assert.equal(capturedPointers.has(22), true);

  // 3. Vertical movement > 12 CSS px triggers swipe and suppresses tap on pointerup
  const cardBeforeSwipe = mockCanvas.__rageBaitState.activeCardId;
  for (const fn of canvasListeners.get('pointermove') ?? []) {
    fn({ pointerId: 22, clientX: replyX, clientY: replyY - 24 });
  }
  for (const fn of canvasListeners.get('pointerup') ?? []) {
    fn({ pointerId: 22, clientX: replyX, clientY: replyY - 24 });
  }
  assert.equal(capturedPointers.has(22), false);
  scene.draw(
    mockCtx,
    {
      phase: 'running',
      currentX100: 150,
      elapsed: 1_100,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    },
    1_100,
  );
  assert.notEqual(mockCanvas.__rageBaitState.activeCardId, cardBeforeSwipe, 'Swipe > 12px advances card');
  assert.equal(mockCanvas.__rageBaitState.threadExpanded, false, 'Swipe suppresses tap on Replies');

  // 4. dispose() removes all canvas and window listeners
  scene.dispose();
  for (const [, set] of canvasListeners) {
    assert.equal(set.size, 0, 'All canvas listeners removed on dispose()');
  }
  for (const [, set] of windowListeners) {
    assert.equal(set.size, 0, 'All window listeners removed on dispose()');
  }
});

test('Browser integration: landscape (1280×800), portrait (390×844), thread expansion, manual browse, and replay determinism', { timeout: 60_000 }, async (t) => {
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    const filePath = resolve(root, '.' + urlPath);
    if (!filePath.startsWith(root + '/')) {
      res.writeHead(404);
      res.end();
      return;
    }
    try {
      const ext = extname(filePath);
      const mime =
        {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
        }[ext] || 'application/octet-stream';
      res.setHeader('content-type', mime);
      res.end(await readFile(filePath));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  const port = server.address().port;

  // 1. Landscape 1280×800 replay determinism & thread expansion
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`http://127.0.0.1:${port}/rage-bait/index.html?mode=replay`);
  await page.waitForFunction(() => Boolean(document.querySelector('canvas')?.__rageBaitState));

  const initialLandscape = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    return c.__rageBaitState;
  });
  assert.equal(initialLandscape.portrait, false);
  assert.equal(initialLandscape.width, 960);
  assert.equal(initialLandscape.height, 540);
  assert.equal(initialLandscape.variant, 0, 'Replay mode always uses deterministic deck variant 0');

  // Tap Replies hit target in browser -> expands thread; Escape collapses thread
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const rect = c.getBoundingClientRect();
    const st = c.__rageBaitState;
    const hit = st.layout.repliesHitRect;
    const clientX = rect.left + ((hit.x + hit.w / 2) / st.width) * rect.width;
    const clientY = rect.top + ((hit.y + hit.h / 2) / st.height) * rect.height;
    c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX, clientY, pointerId: 1, button: 0 }));
    c.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX, clientY, pointerId: 1, button: 0 }));
  });
  await page.waitForFunction(() => document.querySelector('canvas').__rageBaitState.threadExpanded === true);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('canvas').__rageBaitState.threadExpanded === false);

  // 2. Portrait 390×844 recomposition, >= 44×44 CSS px hit targets, and zero horizontal overflow
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('canvas').__rageBaitState.portrait === true);

  const portraitMetrics = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const rect = c.getBoundingClientRect();
    const st = c.__rageBaitState;
    const hit = st.layout.repliesHitRect;
    const cssHitW = (hit.w / st.width) * rect.width;
    const cssHitH = (hit.h / st.height) * rect.height;
    const cssPostFont = (st.layout.fonts.post / st.width) * rect.width;
    const cssReplyFont = (st.layout.fonts.reply / st.width) * rect.width;
    return {
      width: st.width,
      height: st.height,
      cssHitW,
      cssHitH,
      cssPostFont,
      cssReplyFont,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  assert.equal(portraitMetrics.width, 540);
  assert.equal(portraitMetrics.height, 800);
  assert.ok(portraitMetrics.cssHitW >= 44 && portraitMetrics.cssHitH >= 44, 'Replies hit target >= 44×44 CSS px');
  assert.ok(portraitMetrics.cssPostFont >= 18, 'Post body copy >= 18 CSS px at mobile width');
  assert.ok(portraitMetrics.cssReplyFont >= 14, 'Top reply copy >= 14 CSS px at mobile width');
  assert.equal(portraitMetrics.overflow, false, 'No horizontal overflow in portrait');
  assert.deepEqual(errors, []);

  await page.close();
});
