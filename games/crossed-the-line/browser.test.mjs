import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, extname, basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { emptyRoomState, replayCurve } from '../../packages/game-sdk/dist/index.js';
import { free } from '../../packages/crash-math/dist/index.js';

const dir = dirname(fileURLToPath(import.meta.url));
const slug = basename(dir), root = resolve(dir, '../..');

// Exercises the built bundle, actual shared shell and postMessage host contract.
test(`${slug}: replay, mobile host, cashout confirmation and late crash`, { timeout: 90_000 }, async t => {
  const server = createServer(async (req, res) => {
    if (req.url === '/host') {
      res.setHeader('content-type', 'text/html');
      res.end(`<style>body{margin:0}iframe{display:block;border:0;width:100%;height:100px}</style>
        <script>window.messages=[];addEventListener('message',e=>{
          const f=document.querySelector('iframe');
          if(e.source!==f?.contentWindow||e.data?.proto!=='crashwif-game-embed:v1')return;
          window.messages.push(e.data);
          if(e.data.type==='resize')f.style.height=e.data.height+'px';
        });</script><iframe src="/${slug}/index.html"></iframe>`);
      return;
    }
    if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
    const path = resolve(root, 'dist', '.' + req.url.split('?')[0]);
    if (!path.startsWith(resolve(root, 'dist') + '/')) { res.writeHead(404); res.end(); return; }
    try {
      res.setHeader('content-type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' })[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const shot = async (page, name) => {
    if (!process.env.GAME_QA_SHOTS) return;
    await mkdir(process.env.GAME_QA_SHOTS, { recursive: true });
    await page.screenshot({ path: join(process.env.GAME_QA_SHOTS, `${slug}-${name}.png`), fullPage: true });
  };

  for (const width of [375, 1100]) await t.test(`host at ${width}px`, async () => {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce', deviceScaleFactor: 2 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    try {
      await page.goto(base + '/host');
      const frame = page.frames()[1];
      await frame.waitForFunction(() => document.querySelector('canvas')?.gameScene);
      const stateFor = (roundIndex, phase, x100, age = 0, cashoutX100 = null) => {
        const elapsed = phase === 'running' ? 150000 : free.msToReach(x100, free.DEFAULT_CURVE) + age;
        return {
          ...emptyRoomState(), connected: true,
          room: { gameId: slug, chainId: 1, curve: free.DEFAULT_CURVE },
          round: { roundIndex, phase, runningSince: Date.now() - elapsed, bettingClosesAt: phase === 'betting' ? Date.now() + 10000 : null,
            multiplierX100: x100, crashX100: phase === 'crashed' ? x100 : null,
            rally: { active: false, bettors: 0, percent: 100 }, queued: 0, admitted: 1 },
          you: { creditsLeft: 1000, roundsLeft: 10, ended: false, bet: { status: 'active', stake: 50, cashoutX100 } },
        };
      };
      const send = async (state, expected) => {
        await page.evaluate(state => document.querySelector('iframe').contentWindow.postMessage({ proto: 'crashwif-game-embed:v1', type: 'init', state, manifest: {}, allowBets: true, reason: null, maxStake: null }, '*'), state);
        await frame.waitForFunction(({expected, state}) => {
          if (document.querySelector('canvas').gameScene.phase !== expected) return false;
          return state.round.phase !== 'crashed' || expected === 'escaped' || document.querySelector('#status').textContent.includes((state.round.crashX100 / 100).toFixed(2));
        }, {expected, state});
      };
      await send(stateFor(1, 'betting', 100), 'betting');
      assert.equal(await frame.locator('#bet').isVisible(), false, 'embedded betting belongs to the host');
      await send(stateFor(1, 'running', 900), 'running');
      assert.equal(await frame.locator('#cashout').getAttribute('aria-disabled'), 'false');
      const geometry = await frame.locator('canvas').evaluate(canvas => ({
        portrait: canvas.gameScene.portrait, height: canvas.clientHeight, width: canvas.clientWidth,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(geometry.portrait, width < 620);
      assert.equal(geometry.overflow, false);
      if (width < 620) assert.ok(geometry.height > 500 && geometry.width >= 370, 'short host expands to the phone composition');
      const before = await frame.locator('canvas').evaluate(c => c.toDataURL());
      await page.waitForTimeout(180);
      assert.notEqual(await frame.locator('canvas').evaluate(c => c.toDataURL()), before, 'long rounds keep acting even with reduced-motion preference');
      assert.ok((await frame.locator('#story').textContent()).length > 20);
      await shot(page, `${width}-running`);
      // A screenshot may take longer than the shell's stale-host guard. Supply a fresh snapshot as a real host would.
      await send(stateFor(1, 'running', 900), 'running');
      await frame.waitForFunction(() => document.querySelector('#cashout').getAttribute('aria-disabled') === 'false');
      await frame.locator('#cashout').click();
      await page.waitForFunction(() => window.messages.some(m => m.type === 'client' && m.message?.type === 'cashout'));
      assert.equal(await frame.locator('canvas').evaluate(c => c.gameScene.phase), 'running', 'click alone cannot confirm an exit');
      await send(stateFor(1, 'running', 900, 0, 800), 'escaped');
      await send(stateFor(1, 'crashed', 901, 5000, 800), 'escaped');
      assert.match(await frame.locator('#status').innerText(), /cashed out at 8\.00/i);
      assert.equal(await frame.locator('#cashout').getAttribute('aria-disabled'), 'true');
      await shot(page, `${width}-cashout`);
      await send(stateFor(2, 'crashed', 100, 1100), 'crashed');
      assert.equal(await frame.locator('canvas').evaluate(c => c.gameScene.stage), 0, 'instant crashes render from the first act');
      await shot(page, `${width}-early-crash`);
      for (const [i, x100] of [900, 901, 902].entries()) {
        await send(stateFor(3 + i, 'crashed', x100, 3200), 'crashed');
        await frame.waitForFunction(() => document.querySelector('canvas').gameScene.outcomeAge >= 3.2);
        const seen = await frame.locator('canvas').evaluate(c => c.gameScene);
        assert.equal(seen.ending, slug === 'bad-trip' ? ['music', 'monster', 'collective'][i] : 'crucifix');
        await shot(page, `${width}-ending-${i}`);
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });

  await t.test('verified replay reaches its ending and restarts', async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    try {
      const start = new Date('2026-01-01T00:00:00Z');
      await page.clock.install({ time: start });
      await page.clock.pauseAt(new Date(start.getTime() + 60000));
      await page.goto(`${base}/${slug}/index.html?mode=replay`);
      await page.clock.runFor(50);
      assert.match(await page.locator('#status').innerText(), /Recorded round · betting/);
      const replay = JSON.parse(await readFile(join(dir, 'replay.json'), 'utf8'));
      const duration = free.msToReach(replay.crashX100, replayCurve(replay));
      for (let elapsed = 0; elapsed < duration + 5000; elapsed += 1000) await page.clock.fastForward(1000);
      assert.match(await page.locator('#status').innerText(), /Recorded round · crashed at 9\.07/);
      assert.equal(await page.locator('canvas').evaluate(c => c.gameScene.phase), 'crashed');
      await page.locator('#restart').click(); await page.clock.runFor(50);
      assert.match(await page.locator('#status').innerText(), /Recorded round · betting/);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
});
