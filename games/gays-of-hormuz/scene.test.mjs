// The actual scene in Chromium: phase handling around the ending, the airlift and the helm.
// Run with node --test games/gays-of-hormuz/*.test.mjs (needs Playwright's Chromium).
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

let browser;
let source;

before(async () => {
  const result = await build({
    stdin: {
      resolveDir: fileURLToPath(new URL('.', import.meta.url)),
      contents: `
        import { createScene } from './scene';
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        let scene = createScene();
        const fillText = ctx.fillText.bind(ctx);
        let labels = [];
        ctx.fillText = (text, ...args) => { labels.push(text); fillText(text, ...args); };
        window.sceneHarness = {
          draw(view, now) {
            labels = [];
            ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0);
            scene.draw(ctx, view, now);
            return { label: canvas.getAttribute('aria-label'), labels };
          },
          dispose: () => scene.dispose(),
          // The shell replaces a scene after a hidden-tab gap; module state such as the helm choice carries over.
          recreate() { scene.dispose(); scene = createScene(); },
        };
      `,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    logLevel: 'silent',
  });
  source = result.outputFiles[0].text;
  try { browser = await chromium.launch({ headless: true }); }
  catch { browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' }); }
});
after(async () => { await browser?.close(); });

async function harness(t, { mode = 'standalone', width = 960, height = 540 } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => {
    await page.evaluate(() => window.sceneHarness?.dispose());
    await page.close();
    assert.deepEqual(errors, [], 'the actual scene renders without browser errors');
  });
  await page.setContent(`<html data-mode="${mode}"><body style="margin:0">
    <canvas width="960" height="540" style="display:block;width:${width}px;height:${height}px"></canvas>
    <button id="sound">Sound: off</button><p id="helm-help">Up and Down steer.</p>
  </body></html>`);
  await page.addScriptTag({ content: source });
  const draw = (view, now) => page.evaluate(({ view, now }) => window.sceneHarness.draw(view, now), { view, now });
  return Object.assign(draw, { page });
}

function view(phase, values = {}) {
  return { phase, currentX100: 100, elapsed: 0, crashAge: 0, stake: null, cashoutX100: null, payout: null, ...values };
}

test('a host that reopens betting two seconds after the crash still sees her go down, then the next sailing boards', async t => {
  const draw = await harness(t);
  await draw(view('running', { elapsed: 11_900, currentX100: 448 }), 9_900);
  const crash = view('crashed', { elapsed: 12_000, currentX100: 450, stake: 50 });
  const sunk = await draw(crash, 10_000);
  assert.match(sunk.label, /Sunk at 4\.50×/);
  await draw({ ...crash, crashAge: 2_000 }, 12_000);
  const ending = await draw(view('betting'), 13_200);
  assert.match(ending.label, /Previous voyage ending; the next round is betting\./);
  assert.ok(ending.labels.includes('NEXT SAILING BOARDING NOW'), 'the open round is named while the ending finishes');
  assert.ok(ending.labels.some(l => /^SUNK AT 4\.50×/.test(l)), 'the old outcome stays on screen');
  assert.ok(ending.labels.includes('YOUR 50 CREDITS WENT DOWN WITH THE SHIP.'));
  const boarding = await draw(view('betting'), 15_600);
  assert.match(boarding.label, /Boarding for the next sailing\./);
  assert.ok(boarding.labels.includes('ALL ABOARD THE SS SASHAY'));
  assert.ok(!boarding.labels.includes('NEXT SAILING BOARDING NOW'));
});

test('a new running round interrupts the old ending at once and leaves the old airlift behind', async t => {
  const draw = await harness(t);
  const confirmed = await draw(view('crashed', { cashoutX100: 100, payout: 50, stake: 50, crashAge: 1_000 }), 10_000);
  assert.match(confirmed.label, /Airlifted at 1\.00×/);
  assert.ok(confirmed.labels.includes('YOU WERE AIRLIFTED AT 1.00×. DRY AND FABULOUS.'));
  const ending = await draw(view('betting'), 12_100);
  assert.ok(ending.labels.includes('NEXT SAILING BOARDING NOW'));
  const next = await draw(view('running'), 13_200);
  assert.match(next.label, /Sailing at 1\.00×/);
  assert.doesNotMatch(next.label, /Previous voyage|Airlifted/);
  assert.ok(!next.labels.includes('NEXT SAILING BOARDING NOW'));
});

test('restarting the recorded round clears the old ending on the first new betting frame', async t => {
  const draw = await harness(t, { mode: 'replay' });
  const crash = view('crashed', { elapsed: 12_000, currentX100: 450 });
  await draw(crash, 10_000);
  await draw({ ...crash, crashAge: 2_000 }, 12_000);
  const restarted = await draw(view('betting'), 13_200);
  assert.match(restarted.label, /Boarding for the next sailing\./);
  assert.ok(restarted.labels.includes('ALL ABOARD THE SS SASHAY'));
});

test('an accepted cash-out brings the airlift and keeps backing the exit as the voyage goes on', async t => {
  const draw = await harness(t);
  let now = 1_000;
  for (let ms = 0; ms <= 8_000; ms += 100) await draw(view('running', { elapsed: ms, currentX100: Math.round(100 * 10 ** (ms / 30_000)), stake: 50 }), now += 100);
  const x = Math.round(100 * 10 ** (8_000 / 30_000));
  await draw(view('running', { elapsed: 8_100, currentX100: x, stake: 50, cashoutX100: x, payout: 92 }), now += 100);
  let frame;
  for (let ms = 8_200; ms <= 13_000; ms += 100) frame = await draw(view('running', { elapsed: ms, currentX100: Math.round(100 * 10 ** (ms / 30_000)), stake: 50, cashoutX100: x, payout: 92 }), now += 100);
  assert.match(frame.label, new RegExp(`Airlifted at ${(x / 100).toFixed(2)}×`));
  assert.ok(frame.labels.some(l => l.startsWith(`AIRLIFTED AT ${(x / 100).toFixed(2)}× · SS SASHAY NOW AT`)), 'the regret card compares the exit with the ship');
  assert.ok(frame.labels.includes('YOU · AIRLIFTED'), 'the helicopter holds off the bow with the player aboard');
});

test('steering takes the helm from the first mate, and the choice survives the next scene', async t => {
  const draw = await harness(t);
  const before = await draw(view('running', { elapsed: 3_000, currentX100: 126 }), 4_000);
  assert.match(before.label, /The first mate has the helm/);
  await draw.page.keyboard.down('ArrowDown');
  await draw(view('running', { elapsed: 3_050, currentX100: 126 }), 4_050);
  await draw.page.keyboard.up('ArrowDown');
  const after = await draw(view('running', { elapsed: 4_100, currentX100: 127 }), 5_100);
  assert.match(after.label, /You have the helm\./);
  await draw.page.evaluate(() => window.sceneHarness.recreate());
  const replaced = await draw(view('running', { elapsed: 5_200, currentX100: 128 }), 6_200);
  assert.match(replaced.label, /You have the helm\./, 'a replaced scene keeps the player at the helm');
});

test('every phase and every moment of the ending draws in landscape and on a tall phone canvas', async t => {
  for (const size of [{ width: 960, height: 540 }, { width: 375, height: 469 }]) {
    const draw = await harness(t, size);
    // The canvas's label refreshes once a second, so these frames are a second apart.
    let now = 1_000;
    await draw(view('waiting'), now += 1_000);
    await draw(view('betting', { stake: 50 }), now += 1_000);
    for (const seconds of [0, 1, 4, 9, 20, 45, 90, 150]) {
      const frame = await draw(view('running', { elapsed: seconds * 1000, currentX100: Math.round(100 * 10 ** (seconds / 30)), stake: 50 }), now += 1_000);
      assert.match(frame.label, /Sailing at/);
    }
    for (const ms of [0, 60, 200, 500, 1_000, 2_000, 3_000, 4_000, 5_000, 6_000, 9_000]) await draw(view('crashed', { elapsed: 150_000, currentX100: 100_000, crashAge: ms, stake: 50 }), now + ms);
  }
});
