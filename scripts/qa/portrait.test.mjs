import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { emptyRoomState } from '../../packages/game-sdk/dist/index.js';
import { free } from '../../packages/crash-math/dist/index.js';

const PORTRAIT_GAMES = [
  'blanket-champ', 'andys-loud-garden', 'gas-fees', 'onlyfrens', 'wife-changing-money',
  'not-financial-advice', 'family-meeting', 'thanksgiving-uncle', 'hopium-drip',
  'i-got-hacked', 'know-your-clown', 'bull-run', 'thin-ice', 'king-of-the-hill',
  'pyramid-scheme', 'the-trenches',
];

// A short host frame must still select the portrait composition by width. If it
// waits for a tall viewport, the host and game's resize handshake can stay stuck
// on the unreadably small landscape picture indefinitely.
test('portrait games recompose inside a short mobile host and retain the shared canvas and controls', { timeout: 90_000 }, async t => {
  const root = resolve('dist');
  const server = createServer(async (req, res) => {
    if (req.url.startsWith('/host/')) {
      const slug = req.url.slice('/host/'.length);
      if (!PORTRAIT_GAMES.includes(slug)) { res.writeHead(404); res.end(); return; }
      res.setHeader('content-type', 'text/html');
      res.end(`<style>body{margin:0}iframe{display:block;border:0;width:100%;height:100px}</style><script>
        window.reportedHeights=[];
        addEventListener('message',event=>{
          const frame=document.querySelector('iframe');
          if(event.source!==frame?.contentWindow || event.data?.proto!=='crashwif-game-embed:v1')return;
          if(event.data.type==='resize'){
            window.reportedHeights.push(event.data.height);
            frame.style.height=event.data.height+'px';
          }
        });
      </script><iframe src="/${slug}/index.html"></iframe>`);
      return;
    }
    const path = resolve(root, '.' + req.url.split('?')[0]);
    if (!path.startsWith(root + '/')) { res.writeHead(404); res.end(); return; }
    try {
      res.setHeader('content-type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const slug of PORTRAIT_GAMES) await t.test(slug, async () => {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/host/${slug}`);
      await page.waitForFunction(() => window.reportedHeights.some(height => height > 500));
      const frame = page.frames()[1];
      const elapsed = 150_000;
      const state = {
        ...emptyRoomState(), connected: true,
        room: { gameId: 'portrait-fixture', chainId: 1, curve: free.DEFAULT_CURVE },
        round: { roundIndex: 1, phase: 'running', runningSince: Date.now() - elapsed, bettingClosesAt: null,
          multiplierX100: free.multiplierAtX100(elapsed, free.DEFAULT_CURVE), crashX100: null,
          rally: { active: false, bettors: 0, percent: 100 }, queued: 0, admitted: 1 },
        you: { creditsLeft: 1000, roundsLeft: 10, ended: false, bet: { status: 'active', stake: 50, cashoutX100: null } },
      };
      await page.evaluate(state => document.querySelector('iframe').contentWindow.postMessage({ proto: 'crashwif-game-embed:v1', type: 'init', state, manifest: {}, allowBets: true, reason: null, maxStake: null }, '*'), state);
      await frame.waitForFunction(() => document.querySelector('#status').textContent.includes('Round running'));
      assert.equal(await frame.locator('canvas').count(), 1, 'the source pack and poster exporter retain one DOM canvas');
      const geometry = await frame.locator('canvas').evaluate(canvas => {
        const rect = canvas.getBoundingClientRect();
        return { width: rect.width, height: rect.height, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(geometry.height > 500, `${slug}: the acting view must use the portrait layout`);
      assert.ok(geometry.width <= 376 && geometry.width >= 370, `${slug}: the portrait picture fits the host width`);
      assert.equal(geometry.overflow, false, 'oversampling must not produce horizontal scrolling');
      assert.equal(await frame.locator('#cashout').isVisible(), true);
      assert.equal(await frame.locator('#cashout').getAttribute('aria-disabled'), 'false');
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
});
