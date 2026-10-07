import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { GAMES } from '../games.mjs';
import { free } from '../../packages/crash-math/dist/index.js';
import { replayCurve } from '../../packages/game-sdk/dist/index.js';

// Validate the published bundles too: controller fixtures cannot catch shell/scene integration failures.
test('all catalog bundles play their verified recording, crash and restart without browser errors', { timeout: 180_000 }, async t => {
  const root=resolve('dist');
  const server=createServer(async(req,res)=>{
    const path=resolve(root,'.'+req.url.split('?')[0]);
    if(!path.startsWith(root+'/')) {res.writeHead(404);res.end();return;}
    try{res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  for(const game of GAMES) await t.test(game,async()=>{
    const page=await browser.newPage({viewport:{width:375,height:812}});
    try{
      const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
      const clockStart = new Date('2026-01-01T00:00:00Z');
      await page.clock.install({time:clockStart});
      // Pause before navigation so an expensive first render cannot consume the betting window.
      await page.clock.pauseAt(new Date(clockStart.getTime()+60_000));
      await page.goto(`http://127.0.0.1:${server.address().port}/${game}/index.html?mode=replay`);
      await page.clock.runFor(50);
      assert.match(await page.locator('#status').innerText(),/Recorded round · betting/);
      const recording=JSON.parse(await readFile(`games/${game}/replay.json`,'utf8'));
      const duration=free.msToReach(recording.crashX100,replayCurve(recording));
      // One render per second keeps the replay's intentional hidden-tab pause below its1500ms boundary.
      for(let elapsed=0;elapsed<duration+4000;elapsed+=1000) await page.clock.fastForward(1000);
      assert.match(await page.locator('#status').innerText(),/Recorded round · crashed at/);
      const pixels=await page.locator('canvas').evaluate(canvas=>{
        const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
        const colors=new Set();for(let i=0;i<bytes.length;i+=64)colors.add(`${bytes[i]},${bytes[i+1]},${bytes[i+2]}`);return colors.size;
      });
      assert.ok(pixels>10,'crash scene must remain rendered');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile shell must not overflow');
      await page.locator('#restart').click();await page.clock.runFor(50);
      assert.match(await page.locator('#status').innerText(),/Recorded round · betting/);
      assert.deepEqual(errors,[]);
    }finally{await page.close();}
  });
});
