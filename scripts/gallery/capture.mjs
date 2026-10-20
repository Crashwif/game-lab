import { readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, resolve } from 'node:path';
import { captureRuntime } from './capture-runtime.mjs';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png' };

/** Serves a directory on an ephemeral port for the poster captures. */
function serve(root) {
  const server = createServer(async (req, res) => {
    const path = resolve(root, `.${decodeURIComponent((req.url ?? '/').split('?')[0])}`);
    if (!path.startsWith(resolve(root))) { res.writeHead(403); res.end(); return; }
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end();
    }
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done({ server, port: server.address().port })));
}

/** Counts the distinct colours of a PNG, in the page, so WebGL and 2D canvases are checked alike. */
async function countColours(base64) {
  const png = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([png], { type: 'image/png' }));
  const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
  context.drawImage(bitmap, 0, 0);
  return new Set(new Uint32Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer)).size;
}

async function launchChromium() {
  let chromium;
  try {
    ({ chromium } = await captureRuntime());
  } catch (error) {
    if (error.code !== 'MODULE_NOT_FOUND') throw error;
    throw new Error('Playwright is not installed: run `npm ci` and `npx playwright install chromium`, or pass --skip-posters', { cause: error });
  }
  return chromium.launch();
}

export async function capturePosters(dist, out, short, games, {
  concurrency = process.env.GAME_LAB_CAPTURE_CONCURRENCY ?? 2,
  launch = launchChromium,
} = {}) {
  if (!/^[1-8]$/.test(String(concurrency))) throw new Error('GAME_LAB_CAPTURE_CONCURRENCY must be an integer from 1 to 8');
  if (games.length === 0) return;
  const { server, port } = await serve(dist);
  let browser;
  const failures = new Array(games.length);
  let next = 0;
  try {
    browser = await launch();
    // Each worker owns one page at a time. Finish every worker before closing the browser,
    // and retain catalog order for failures regardless of which captures finish first.
    await Promise.all(Array.from({ length: Math.min(Number(concurrency), games.length) }, async () => {
      while (next < games.length) {
        const index = next++;
        const game = games[index];
        const errors = [];
        let page, png;
        try {
          page = await browser.newPage({ viewport: { width: 960, height: 660 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
          // Listen before loading: a bad replay throws while the deferred script runs, before the load event.
          page.on('pageerror', (error) => errors.push(error.message));
          page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
          await page.goto(`http://127.0.0.1:${port}/${game.slug}/index.html?mode=replay`, { waitUntil: 'load' });
          const canvas = page.locator('canvas');
          await canvas.waitFor();
          await page.waitForTimeout(Math.round(game.poster.seconds * 1000));
          png = await canvas.screenshot({ type: 'png' });
          const colours = await page.evaluate(countColours, png.toString('base64'));
          if (colours < 2) errors.push('the poster is a single colour');
        } catch (error) {
          errors.push(error.message);
        } finally {
          try { await page?.close(); } catch (error) { errors.push(error.message); }
        }
        // Errors can arrive until the page closes; only then is the poster known to pass, and written.
        if (!errors.length) {
          try {
            await writeFile(join(out, short, game.slug, 'poster.png'), png);
            console.log(`poster: ${game.slug} at ${game.poster.seconds}s`);
          } catch (error) { errors.push(error.message); }
        }
        if (errors.length) failures[index] = `${game.slug}: ${errors.join('; ')}`;
      }
    }));
  } finally {
    try { await browser?.close(); } finally { await new Promise((done) => server.close(done)); }
  }
  const failed = failures.filter(Boolean);
  if (failed.length) throw new Error(`poster capture failed for ${failed.length} of ${games.length} games:\n  ${failed.join('\n  ')}`);
}

