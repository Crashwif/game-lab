import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const GAMES = ['rage-quit', 'beyond-the-colony', 'mumu-bull-run'];

// A still poster can pass replay and protocol checks. Sample the acting area
// between frames while the round waits, starts and continues beyond three minutes.
test('community scenes keep acting during betting and early and late running rounds', { timeout: 90_000 }, async t => {
  const scripts = new Map();
  for (const game of GAMES) {
    const result = await build({
      stdin: { contents: `import {createScene} from './games/${game}/scene';
const canvas=document.querySelector('canvas');canvas.width=960;canvas.height=540;
const ctx=canvas.getContext('2d',{willReadFrequently:true});
let scene=createScene();
let now=1000;
const view={phase:'betting',currentX100:150,elapsed:0,crashAge:0,stake:50,cashoutX100:null,payout:null};
const frame=()=>{ctx.setTransform(1,0,0,1,0,0);scene.draw(ctx,view,now);};
window.motionFixture={
 reset(phase,elapsed){scene.dispose?.();scene=createScene();now=1000+elapsed;Object.assign(view,{phase,elapsed});frame();},
 sample(){
  const before=ctx.getImageData(120,135,720,340).data;
  let peak=0;
  for(let step=0;step<36;step++){
   now+=1000/30;if(view.phase==='running')view.elapsed+=1000/30;frame();
   if(step%6!==5)continue;
   const after=ctx.getImageData(120,135,720,340).data;
   let changed=0;
   for(let pixel=0;pixel<after.length;pixel+=4){
    if(Math.abs(after[pixel]-before[pixel])+Math.abs(after[pixel+1]-before[pixel+1])+Math.abs(after[pixel+2]-before[pixel+2])>90)changed++;
   }
   peak=Math.max(peak,changed/(720*340));
  }
  return peak;
 }
};frame();`, resolveDir: process.cwd(), loader: 'ts' },
      bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
    });
    scripts.set(game, result.outputFiles[0].text);
  }
  const server = createServer(async (req, res) => {
    const [, game, file] = req.url.split('?')[0].split('/');
    if (!GAMES.includes(game)) { res.writeHead(404); res.end(); return; }
    if (file === 'game.generated.js') {
      res.setHeader('content-type', 'text/javascript'); res.end(scripts.get(game)); return;
    }
    if (!['index.html', 'style.css'].includes(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(await readFile(`games/${game}/${file}`));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => server.close(done)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const game of GAMES) await t.test(game, async () => {
    const page = await browser.newPage({ viewport: { width: 1040, height: 740 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`http://127.0.0.1:${server.address().port}/${game}/index.html`);
      await page.waitForFunction(() => window.motionFixture);
      for (const [phase, elapsed] of [['waiting', 0], ['betting', 0], ['running', 1000], ['running', 181000]]) {
        const motion = await page.evaluate(({ phase, elapsed }) => {
          window.motionFixture.reset(phase, elapsed);
          return window.motionFixture.sample();
        }, { phase, elapsed });
        assert.ok(motion > 0.004, `${game}: ${phase} at ${elapsed}ms must animate its stage with a fixed multiplier (changed ${(motion * 100).toFixed(3)}% of the acting area)`);
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
});

// Real replay navigation covers the browser preference at the shell/scene boundary.
test('replay pages animate characters with either operating-system motion preference', { timeout: 90_000 }, async t => {
  const bundles = new Map();
  for (const game of GAMES) {
    const result = await build({ entryPoints: [`games/${game}/main.ts`], bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022' });
    bundles.set(game, result.outputFiles[0].text);
  }
  const server = createServer(async (req, res) => {
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html');
      res.end(GAMES.map(game => `<a href="/${game}/index.html?mode=replay">${game}</a>`).join(''));
      return;
    }
    const [, game, file] = req.url.split('?')[0].split('/');
    if (!GAMES.includes(game)) { res.writeHead(404); res.end(); return; }
    if (file === 'game.generated.js') { res.setHeader('content-type', 'text/javascript'); res.end(bundles.get(game)); return; }
    if (!['index.html', 'style.css'].includes(file)) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(await readFile(`games/${game}/${file}`));
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => server.close(done)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  for (const reducedMotion of ['reduce', 'no-preference']) for (const game of GAMES) await t.test(`${game}: ${reducedMotion}`, async () => {
    const page = await browser.newPage({ viewport: { width: 1040, height: 740 }, reducedMotion });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const start = new Date('2026-10-08T00:00:00Z');
      await page.clock.install({ time: start });
      await page.clock.pauseAt(new Date(+start + 60_000));
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.getByRole('link', { name: game, exact: true }).click();
      await page.waitForLoadState('load');
      await page.waitForSelector('html[data-mode=replay]');
      await page.clock.runFor(50);
      const measure = async () => {
        await page.locator('canvas').evaluate(canvas => {
          const crop = [260, 195, 340, 280].map((v, i) => Math.round(v * (i % 2 ? canvas.height / 540 : canvas.width / 960)));
          window.motionSample = { crop, before: canvas.getContext('2d').getImageData(...crop).data };
        });
        await page.clock.runFor(850);
        return page.locator('canvas').evaluate(canvas => {
          const { crop, before } = window.motionSample;
          const after = canvas.getContext('2d').getImageData(...crop).data;
          let changed = 0;
          for (let i = 0; i < before.length; i += 4) if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 90) changed++;
          return changed / (crop[2] * crop[3]);
        });
      };
      assert.match(await page.locator('#status').innerText(), /Recorded round · betting/);
      assert.ok(await measure() > 0.004, 'the actor moves during betting');
      await page.clock.runFor(850);
      assert.match(await page.locator('#status').innerText(), /Recorded round · running/);
      assert.ok(await measure() > 0.004, 'the actor moves during running');
      await page.locator('#restart').click();
      await page.clock.runFor(50);
      assert.match(await page.locator('#status').innerText(), /Recorded round · betting/);
      assert.ok(await measure() > 0.004, 'restarting retains full character animation');
      assert.equal(await page.locator('#notice').isVisible(), false);
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
});
