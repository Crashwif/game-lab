import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { emptyRoomState } from '../../packages/game-sdk/dist/index.js';
import { free } from '../../packages/crash-math/dist/index.js';

// Protects the real shell's room/replay boundary; only the expensive picture is replaced.
test('shell follows each room curve through long play, cashout and late crash; old replays keep their pace', async t => {
  const built = await build({entryPoints:['games/balloon-pump/main.ts'],bundle:true,write:false,format:'iife',platform:'browser',plugins:[{name:'capture-view',setup(b){b.onResolve({filter:/^\.\/scene$/},()=>({path:'scene',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export function createScene(){return {draw(ctx,view){window.lastSceneView={...view}}}}',loader:'js'}));}}]});
  const html = await readFile('games/balloon-pump/index.html','utf8');
  const server=createServer((req,res)=>{res.setHeader('content-type',req.url.includes('.js')?'text/javascript':'text/html');res.end(req.url.includes('.js')?built.outputFiles[0].text:req.url.startsWith('/game')?html:'<iframe src="/game" style="width:960px;height:700px"></iframe>');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>new Promise(r=>server.close(r)));
  const browser=await chromium.launch({headless:true});t.after(()=>browser.close());
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const frame=page.frames()[1];await frame.waitForFunction(()=>window.lastSceneView);
  const send=async(state)=>{await page.evaluate(state=>document.querySelector('iframe').contentWindow.postMessage({proto:'crashwif-game-embed:v1',type:'init',state,manifest:{},allowBets:true},'*'),state);await frame.waitForTimeout(60);};
  const stateFor=(curve,elapsed,phase='running')=>({...emptyRoomState(),connected:true,room:{gameId:'fixture',chainId:1,curve},round:{roundIndex:1,phase,runningSince:Date.now()-elapsed,bettingClosesAt:null,multiplierX100:free.multiplierAtX100(elapsed,curve),crashX100:phase==='crashed'?free.multiplierAtX100(elapsed,curve):null,rally:{active:false,bettors:0,percent:100},queued:0,admitted:1},you:{creditsLeft:1000,roundsLeft:10,ended:false,bet:{status:'active',stake:50,cashoutX100:null}}});
  for(const curve of [free.DEFAULT_CURVE,free.FIRST_CURVE,{kind:'exponential',growthRatePerMs:0.00002}]){
    const state=stateFor(curve,150000);await send(state);
    const view=await frame.evaluate(()=>window.lastSceneView);
    assert.ok(view.elapsed>=150000 && view.elapsed<151000);
    assert.ok(Math.abs(view.currentX100/free.multiplierAtContinuousX100(view.elapsed,curve)-1)<0.00001);
    assert.match(await frame.locator('#readout').innerText(),/Worth .* credits now/);
  }
  const cashed=stateFor(free.DEFAULT_CURVE,150000);cashed.you.bet.cashoutX100=100000;await send(cashed);
  assert.match(await frame.locator('#status').innerText(),/Cashed out at 1000\.00/);
  assert.equal(await frame.locator('#cashout').getAttribute('aria-disabled'),'true');
  await send(stateFor(free.DEFAULT_CURVE,150000,'crashed'));
  assert.ok(Math.abs((await frame.evaluate(()=>window.lastSceneView)).elapsed-150000)<2);
  await frame.goto(`http://127.0.0.1:${server.address().port}/game?mode=replay`);
  await frame.waitForTimeout(1800);
  const recorded=await frame.evaluate(()=>window.lastSceneView);
  assert.equal(recorded.phase,'running');
  assert.ok(Math.abs(recorded.currentX100/free.multiplierAtContinuousX100(recorded.elapsed,free.FIRST_CURVE)-1)<0.00001);
  assert.deepEqual(errors,[]);
});
