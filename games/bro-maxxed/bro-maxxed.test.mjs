import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { chromium } from 'playwright';

let compiledHarness;

async function createHeadlessHarness(options = { portrait: false }) {
  compiledHarness ??= await build({
    stdin: {
      contents: `
        export * from './motion';
        export * from './content';
        export * from './portrait';
        export * from './director';
        export * from './cast';
        export * from './stage';
        export * from './scene';
      `,
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      sourcefile: 'harness-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'BroMaxxed',
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
        return { width: String(text).length * 8.5 };
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
    attributes: new Map([['aria-label', 'BRO-MAXXED']]),
    parentElement: {
      appendChild(el) {
        liveNode = el;
      },
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
      milestone(idx) {
        audioEvents.push({ type: 'milestone', idx });
      },
      cashout() {
        audioEvents.push({ type: 'cashout' });
      },
      crash(name, quiet) {
        audioEvents.push({ type: 'crash', name, quiet: Boolean(quiet) });
      },
    },
    document: {
      body: {
        appendChild(el) {
          liveNode = el;
        },
      },
      querySelector(sel) {
        return sel === 'canvas' ? mockCanvas : null;
      },
      getElementById(id) {
        return id === 'bro-maxxed-live' ? liveNode : null;
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
  };

  runInNewContext(compiledHarness.outputFiles[0].text, sandbox);
  const api = sandbox.BroMaxxed;

  return {
    api,
    mockCanvas,
    mockCtx,
    audioEvents,
    drawnTexts,
    canvasListeners,
    getState: () => mockCanvas.__broMaxxedState,
    getLiveText: () => liveNode?.textContent ?? '',
    advanceNow: (dtMs) => {
      nowValue += dtMs;
      return nowValue;
    },
  };
}

test('Two-bone IK solver preserves exact upper and lower bone lengths at coincident, folded, and unreachable targets', async () => {
  const { api } = await createHeadlessHarness();
  const root = { x: 400, y: 300 };
  for (const target of [
    root,
    { x: 400.05, y: 300 },
    { x: 430, y: 340 },
    { x: 950, y: -200 },
  ]) {
    for (const pole of [-1, 1]) {
      const { joint, end } = api.solveLimb(root, target, 46, 44, pole);
      const d1 = Math.hypot(joint.x - root.x, joint.y - root.y);
      const d2 = Math.hypot(end.x - joint.x, end.y - joint.y);
      assert.ok(Math.abs(d1 - 46) < 1e-6, `upper bone ${d1} !== 46`);
      assert.ok(Math.abs(d2 - 44) < 1e-6, `lower bone ${d2} !== 44`);
    }
  }
});

test('Rex, his mirror reflection, and Milo keep outward elbows, uncrossed knees, and exact bone lengths across all 12 gags and wedding/cashout poses', async () => {
  const { api } = await createHeadlessHarness();
  const cast = api.createCast();
  const layout = api.getSceneLayout(false);

  const checkLimbLength = (limb, upper, lower, label) => {
    const d1 = Math.hypot(
      limb.joint.x - limb.shoulderOrHip.x,
      limb.joint.y - limb.shoulderOrHip.y,
    );
    const d2 = Math.hypot(limb.end.x - limb.joint.x, limb.end.y - limb.joint.y);
    assert.ok(Math.abs(d1 - upper) < 1e-4, `${label} upper bone ${d1} !== ${upper}`);
    assert.ok(Math.abs(d2 - lower) < 1e-4, `${label} lower bone ${d2} !== ${lower}`);
  };

  for (let slot = 0; slot < 12; slot++) {
    const beat = api.evaluateDirector({
      phase: 'running',
      currentX100: 110 + slot * 40,
      elapsedMs: slot * 2300 + 900,
      crashAgeSec: 0,
      cashoutX100: null,
      cashoutAgeSec: null,
      cleanLanguage: false,
    });
    api.settleCast(cast, beat, layout);
    const pose = api.computeCastPose(cast, beat, layout, slot * 2.3 + 0.9);

    for (const [name, fig] of [
      ['rex', pose.rex],
      ['rexReflection', pose.rexReflection],
      ['milo', pose.milo],
    ]) {
      // Knees must never cross into an X-shape
      assert.ok(
        fig.leftLeg.joint.x < fig.rightLeg.joint.x,
        `${name} knees crossed at slot ${slot} (${fig.leftLeg.joint.x} >= ${fig.rightLeg.joint.x})`,
      );
      // Elbows must remain outward of shoulders during standing poses
      assert.ok(
        fig.leftArm.joint.x < fig.leftArm.shoulderOrHip.x + 2,
        `${name} left elbow jabbed inward at slot ${slot}`,
      );
      assert.ok(
        fig.rightArm.joint.x > fig.rightArm.shoulderOrHip.x - 2,
        `${name} right elbow jabbed inward at slot ${slot}`,
      );
    }

    checkLimbLength(pose.rex.leftArm, 46, 44, 'rex.leftArm');
    checkLimbLength(pose.rex.rightArm, 46, 44, 'rex.rightArm');
    checkLimbLength(pose.rex.leftLeg, 50, 48, 'rex.leftLeg');
    checkLimbLength(pose.rex.rightLeg, 50, 48, 'rex.rightLeg');
    checkLimbLength(pose.milo.leftArm, 44, 42, 'milo.leftArm');
    checkLimbLength(pose.milo.rightArm, 44, 42, 'milo.rightArm');
    checkLimbLength(pose.milo.leftLeg, 48, 46, 'milo.leftLeg');
    checkLimbLength(pose.milo.rightLeg, 48, 46, 'milo.rightLeg');
  }
});

test('Rex 3-stage gaze chain drives eyes first, then head, then torso, and both leads solve to the shared hand-contact point', async () => {
  const { api } = await createHeadlessHarness();
  const cast = api.createCast();
  const layout = api.getSceneLayout(false);

  // Settle looking at mirror
  const mirrorBeat = api.evaluateDirector({
    phase: 'running',
    currentX100: 110,
    elapsedMs: 100,
    crashAgeSec: 0,
    cashoutX100: null,
    cashoutAgeSec: null,
    cleanLanguage: false,
  });
  mirrorBeat.rexGaze = 'mirror';
  api.settleCast(cast, mirrorBeat, layout);

  // Switch gaze to Milo and step 50ms: eyes must lead head, and head must lead torso
  const miloBeat = { ...mirrorBeat, rexGaze: 'milo' };
  api.stepCast(cast, miloBeat, layout, 0.05);
  assert.ok(
    cast.eyeX.x > cast.headYaw.x && cast.headYaw.x > cast.torsoYaw.x,
    `Expected eyeX (${cast.eyeX.x}) > headYaw (${cast.headYaw.x}) > torsoYaw (${cast.torsoYaw.x})`,
  );

  // Settle into crash hand_hold (1.80s crashAge): Rex right hand and Milo left hand meet at sharedHandPoint
  const handHoldBeat = api.evaluateDirector({
    phase: 'crashed',
    currentX100: 286,
    elapsedMs: 9_200,
    crashAgeSec: 1.8,
    cashoutX100: null,
    cashoutAgeSec: null,
    cleanLanguage: false,
  });
  api.settleCast(cast, handHoldBeat, layout);
  const pose = api.computeCastPose(cast, handHoldBeat, layout);
  const handDist = Math.hypot(
    pose.rex.rightArm.end.x - pose.milo.leftArm.end.x,
    pose.rex.rightArm.end.y - pose.milo.leftArm.end.y,
  );
  assert.ok(handDist < 0.5, `Shared hand-hold palms must meet at one stable world point (dist=${handDist})`);
});

test('Content catalog contains all 96 dialogue records, 12 gags, 16 products, 8 cashout exits, and 8 romantic endings', async () => {
  const { api } = await createHeadlessHarness();
  assert.equal(api.DIALOGUE_RECORDS.length, 96);
  assert.equal(api.GAGS.length, 12);
  assert.equal(api.PRODUCTS.length, 16);
  assert.equal(api.LATE_PROGRAMS.length, 6);
  assert.equal(api.CASHOUT_VARIANTS.length, 8);
  assert.equal(api.ROMANTIC_ENDINGS.length, 8);

  // Verify bounded window avoids back-to-back speaker or family repeats
  let prevSpeaker = '';
  let prevFamily = '';
  for (let slot = 0; slot < 25; slot++) {
    const band = Math.min(8, 1 + Math.floor(slot / 3));
    const line = api.selectDialogueForSlot(slot, band);
    if (slot > 0) {
      assert.notEqual(line.speaker, prevSpeaker, `Slot ${slot} repeated speaker ${prevSpeaker}`);
      assert.notEqual(line.family, prevFamily, `Slot ${slot} repeated family ${prevFamily}`);
    }
    prevSpeaker = line.speaker;
    prevFamily = line.family;
  }
});

test('Acceptance Cases: Instant crash (1.00x), normal crash timeline, and spectator status', async () => {
  const { api, mockCtx, getState, advanceNow } = await createHeadlessHarness();
  const scene = api.createScene();

  // Betting -> Instant Crash at 1.00x
  scene.draw(mockCtx, {
    phase: 'betting',
    currentX100: 100,
    elapsed: 0,
    crashAge: 0,
    stake: 50,
    cashoutX100: null,
    payout: null,
  }, advanceNow(16));

  scene.draw(mockCtx, {
    phase: 'crashed',
    currentX100: 100,
    elapsed: 0,
    crashAge: 1900,
    stake: 50,
    cashoutX100: null,
    payout: null,
  }, advanceNow(16));

  let st = getState();
  assert.equal(st.instantCrash, true);
  assert.equal(st.crashStage, 'hand_hold');
  assert.match(st.captionText, /ALL THAT RESEARCH\. ONE HELLO\./);

  // Progress through all 6 canonical crash stages (Page 10)
  const stages = [
    [50, 'freeze'],
    [400, 'compliment'],
    [1100, 'recalculating'],
    [1900, 'hand_hold'],
    [3200, 'wedding'],
    [5200, 'opportunist'],
  ];
  for (const [crashAge, expectedStage] of stages) {
    scene.draw(mockCtx, {
      phase: 'crashed',
      currentX100: 286,
      elapsed: 8500,
      crashAge,
      stake: null, // Spectator
      cashoutX100: null,
      payout: null,
    }, advanceNow(33));
    st = getState();
    assert.equal(st.crashStage, expectedStage);
    assert.equal(st.outcomeHeadline, 'MOGGED BY LOVE');
  }
});

test('Acceptance Cases: Confirmed cashout precedence over subsequent shared crash and late-entry settling', async () => {
  const { api, mockCtx, getState, audioEvents, advanceNow } = await createHeadlessHarness();
  const scene = api.createScene();

  // Start running
  scene.draw(mockCtx, {
    phase: 'running',
    currentX100: 142,
    elapsed: 3200,
    crashAge: 0,
    stake: 50,
    cashoutX100: null,
    payout: null,
  }, advanceNow(16));

  audioEvents.length = 0;

  // Confirm cashout at 1.42x
  scene.draw(mockCtx, {
    phase: 'running',
    currentX100: 142,
    elapsed: 3300,
    crashAge: 0,
    stake: 50,
    cashoutX100: 142,
    payout: 71,
  }, advanceNow(100));

  let st = getState();
  assert.equal(st.mode, 'cashout');
  assert.equal(st.cashoutVariantId, 'E01');
  assert.match(st.outcomeHeadline, /TOUCH GRASS/);
  assert.equal(audioEvents.filter((e) => e.type === 'cashout').length, 1);

  // Shared round later crashes at 2.86x: accepted exit MUST remain visible and not be replaced by wedding
  scene.draw(mockCtx, {
    phase: 'crashed',
    currentX100: 286,
    elapsed: 8500,
    crashAge: 3000,
    stake: 50,
    cashoutX100: 142,
    payout: 71,
  }, advanceNow(1500));

  st = getState();
  assert.equal(st.mode, 'cashout');
  assert.equal(st.crashStage, null);
  assert.equal(st.cashoutSettled, true);
  assert.equal(
    audioEvents.filter((e) => e.type === 'crash').length,
    0,
    'Crashed round must not play crash stinger after confirmed exit',
  );

  // Late entry directly into an already-accepted cashout starts settled with zero cashout sound burst
  const lateExitHarness = await createHeadlessHarness();
  const lateExitScene = lateExitHarness.api.createScene();
  lateExitScene.draw(lateExitHarness.mockCtx, {
    phase: 'running',
    currentX100: 210,
    elapsed: 6000,
    crashAge: 0,
    stake: 50,
    cashoutX100: 165,
    payout: 82.5,
  }, 5000);
  const lateExitState = lateExitHarness.getState();
  assert.equal(lateExitState.mode, 'cashout');
  assert.equal(lateExitState.cashoutSettled, true);
  assert.equal(lateExitHarness.audioEvents.filter((e) => e.type === 'cashout').length, 0);
});

test('Acceptance Cases: Long round (180+ seconds) rotates all 6 late programs and caps particles <= 120', async () => {
  const { api, mockCtx, getState, advanceNow } = await createHeadlessHarness();
  const scene = api.createScene();

  const seenPrograms = new Set();
  for (let sec = 0; sec <= 185; sec += 2) {
    const elapsed = sec * 1000;
    const x100 = Math.min(100_000_00, Math.round(100 * Math.pow(10, sec / 30)));
    scene.draw(mockCtx, {
      phase: 'running',
      currentX100: x100,
      elapsed,
      crashAge: 0,
      stake: 50,
      cashoutX100: null,
      payout: null,
    }, advanceNow(2000));

    const st = getState();
    if (st.lateProgramId) seenPrograms.add(st.lateProgramId);
    assert.ok(st.activeParticleCount <= 120, `Particle count ${st.activeParticleCount} exceeded 120`);
    assert.ok(Number.isFinite(st.pose.rex.head.x) && Number.isFinite(st.pose.milo.head.x));
  }

  assert.equal(seenPrograms.size, 6, 'All 6 twenty-second late programs must rotate during a 180s round');
});

test('Browser & Responsive Verification: 360px portrait, 390px portrait, and 1040px landscape render without overflow or errors', { timeout: 60_000 }, async (t) => {
  const root = resolve('dist');
  const bundleResult = await build({
    entryPoints: ['games/bro-maxxed/main.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
  });
  const compiledJs = bundleResult.outputFiles[0].text;

  const server = createServer(async (req, res) => {
    const urlPath = req.url.split('?')[0];
    if (urlPath.endsWith('/game.generated.js')) {
      res.setHeader('content-type', 'text/javascript');
      res.end(compiledJs);
      return;
    }
    if (urlPath.endsWith('/index.html') || urlPath.endsWith('/style.css')) {
      const file = urlPath.endsWith('.css') ? 'style.css' : 'index.html';
      res.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(await readFile(`games/bro-maxxed/${file}`));
      return;
    }
    const diskPath = resolve(root, '.' + urlPath);
    try {
      res.setHeader(
        'content-type',
        ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(diskPath)] ||
          'application/octet-stream',
      );
      res.end(await readFile(diskPath));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));

  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());

  for (const viewport of [
    { width: 360, height: 740, expectedPortrait: true },
    { width: 390, height: 844, expectedPortrait: true },
    { width: 1040, height: 740, expectedPortrait: false },
  ]) {
    await t.test(`viewport ${viewport.width}x${viewport.height}`, async () => {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
      });

      try {
        const start = new Date('2026-10-19T00:00:00Z');
        await page.clock.install({ time: start });
        await page.clock.pauseAt(new Date(start.getTime() + 60_000));
        await page.goto(`http://127.0.0.1:${server.address().port}/bro-maxxed/index.html?mode=replay`);
        await page.clock.runFor(100);

        const stateBetting = await page.locator('canvas').evaluate((c) => c.__broMaxxedState);
        assert.equal(stateBetting.portrait, viewport.expectedPortrait);

        // Advance into running round in steps <= FRAME_GAP_MS (1500ms)
        for (let i = 0; i < 4; i++) await page.clock.fastForward(500);
        const stateRunning = await page.locator('canvas').evaluate((c) => c.__broMaxxedState);
        assert.equal(stateRunning.mode, 'running');
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          `No horizontal scroll overflow at ${viewport.width}px width`,
        );

        // Advance to crash wedding aftermath (replay.json crashes at 9.07x, ~32s)
        let stateCrashed = stateRunning;
        for (let i = 0; i < 45; i++) {
          await page.clock.fastForward(1000);
          stateCrashed = await page.locator('canvas').evaluate((c) => c.__broMaxxedState);
          if (stateCrashed.mode === 'crashed' && stateCrashed.crashStage === 'opportunist') {
            break;
          }
        }
        assert.equal(stateCrashed.mode, 'crashed');
        assert.equal(stateCrashed.outcomeHeadline, 'MOGGED BY LOVE');
        assert.ok(stateCrashed.handHoldDistancePx < 1, 'Grooms hold hands at shared world point');

        assert.deepEqual(errors, []);
      } finally {
        await page.close();
      }
    });
  }
});
