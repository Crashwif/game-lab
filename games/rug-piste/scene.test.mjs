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
        const scene = createScene();
        const fillText = ctx.fillText.bind(ctx);
        let labels = [];
        ctx.fillText = (text, ...args) => { labels.push(text); fillText(text, ...args); };
        window.sceneHarness = {
          draw(view, now) {
            labels = [];
            scene.draw(ctx, view, now);
            return { label: canvas.getAttribute('aria-label'), labels };
          },
          dispose: () => scene.dispose(),
        };
      `,
    },
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
  });
  source = result.outputFiles[0].text;
  browser = await chromium.launch({ headless: true });
});

after(async () => { await browser?.close(); });

async function harness(t, mode = 'standalone') {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(async () => {
    await page.evaluate(() => window.sceneHarness?.dispose());
    await page.close();
    assert.deepEqual(errors, [], 'the actual scene renders without browser errors');
  });
  await page.setContent(`<html data-mode="${mode}"><body>
    <canvas width="960" height="540" style="width:960px;height:540px"></canvas>
    <button id="sound">Sound: off</button><p id="gameplay-help">Arrow keys steer.</p>
  </body></html>`);
  await page.addScriptTag({ content: source });
  return (view, now) => page.evaluate(({ view, now }) => window.sceneHarness.draw(view, now), { view, now });
}

function view(phase, values = {}) {
  return { phase, currentX100: 100, elapsed: 0, crashAge: 0, stake: null, cashoutX100: null, payout: null, ...values };
}

test('a two-second host crash still finishes the visible ending during the next betting phase', async t => {
  const draw = await harness(t);
  const crash = view('crashed', { elapsed: 12_000, currentX100: 450 });
  await draw(crash, 10_000);
  await draw({ ...crash, crashAge: 2_000 }, 12_000);

  const lift = await draw(view('betting'), 13_200);
  assert.match(lift.label, /Previous round ending; current round is betting\. 4\.50×/);
  assert.ok(lift.labels.includes('PREVIOUS ROUND'), 'the previous multiplier is identified correctly');
  assert.ok(lift.labels.includes('PREVIOUS RUN • NEXT ROUND OPEN'), 'the new round remains clearly identified');
  assert.ok(!lift.labels.includes('GM. THE SLOPE IS OPEN.'), 'the ending remains on screen during the lift');

  const finished = await draw(view('betting'), 14_900);
  assert.ok(finished.labels.includes('GOBBLED AT 4.50×'), 'the mouth sequence reaches its ending caption');
  const nextRound = await draw(view('betting'), 15_300);
  assert.match(nextRound.label, /Rug Piste\. betting 1\.00×/);
  assert.ok(nextRound.labels.includes('GM. THE SLOPE IS OPEN.'), 'the slope resets after the 5.25-second ending');
  assert.ok(!nextRound.labels.includes('PREVIOUS ROUND'));
});

test('a new running round immediately interrupts the old ending and clears an instant-crash cashout', async t => {
  const draw = await harness(t);
  const old = view('crashed', { elapsed: 0, cashoutX100: 100, payout: 10 });
  const confirmed = await draw(old, 10_000);
  assert.match(confirmed.label, /Cashout confirmed at 1\.00×/);
  const ending = await draw(view('betting'), 12_100);
  assert.ok(ending.labels.includes('PREVIOUS ROUND'));
  assert.ok(ending.labels.includes('BAGS SECURED'));

  // Both rounds have elapsed=0: phase change must reset the old cashout even without a clock rollback.
  const next = await draw(view('running'), 13_200);
  assert.match(next.label, /Rug Piste\. running 1\.00×/);
  assert.doesNotMatch(next.label, /Previous round|Cashout confirmed/);
  assert.ok(next.labels.includes('FULL SEND, FREN.'));
  assert.ok(!next.labels.includes('PREVIOUS ROUND'));
  assert.ok(!next.labels.includes('BAGS SECURED'), 'the new skier does not inherit the previous lift escape');
});

test('restarting replay clears the old ending on the first new betting frame', async t => {
  const draw = await harness(t, 'replay');
  const crash = view('crashed', { elapsed: 12_000, currentX100: 450 });
  await draw(crash, 10_000);
  await draw({ ...crash, crashAge: 2_000 }, 12_000);
  const restarted = await draw(view('betting'), 13_200);
  assert.match(restarted.label, /Rug Piste\. betting 1\.00×/);
  assert.doesNotMatch(restarted.label, /Previous round/);
  assert.ok(restarted.labels.includes('GM. THE SLOPE IS OPEN.'));
  assert.ok(!restarted.labels.includes('PREVIOUS ROUND'));
});
