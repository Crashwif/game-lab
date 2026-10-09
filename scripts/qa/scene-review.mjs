/** Local-only long-round presentation fixture. No outcome or protocol code enters a published game. */
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname } from 'node:path';
import { GAMES } from '../games.mjs';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(process.argv[2] || '/tmp/crashwif-scene-review');
const games = process.env.REVIEW_GAMES?.split(',').filter(Boolean) || GAMES;
if (games.some(game => !GAMES.includes(game))) throw new Error('REVIEW_GAMES contains an unknown game');
await mkdir(out, { recursive: true });
for (const game of games) {
  const dir = join(out, game);
  await mkdir(dir, { recursive: true });
  await build({ stdin: { contents: `import { createScene } from './games/${game}/scene';
const canvas = document.querySelector('canvas');
canvas.width=960; canvas.height=540;
const ctx=canvas.getContext('2d');
const params=new URLSearchParams(location.search);
let scene=createScene();
let now=1000;
const seconds=Number(params.get('seconds')||150);
const validTime=value=>{if (!Number.isFinite(value) || value < 0 || value > 600) throw new Error('Review seconds must be between 0 and 600');};
validTime(seconds);
const late=params.has('late');
const view={phase:late?'running':'betting',currentX100:late?100*Math.pow(10,seconds/30):100,elapsed:late?seconds*1000:0,crashAge:0,stake:50,cashoutX100:null,payout:null};
now+=view.elapsed;
const frame=()=>{
  ctx.setTransform(canvas.width/960,0,0,canvas.height/540,0,0);
  scene.draw(ctx,view,now);
  document.querySelector('#status').textContent='Presentation review · '+(view.elapsed/1000).toFixed(2)+'s · '+view.phase+(view.cashoutX100===null?'':' · accepted cashout');
  document.querySelector('#readout').textContent=(view.currentX100/100).toFixed(2)+'×';
};
const advance=(end)=>{
  validTime(end);
  if (end*1000<view.elapsed) throw new Error('Use seek to review an earlier time');
  if (view.phase==='crashed') throw new Error('Use tick for crash animation, or seek for a new running scene');
  while(view.elapsed+0.000001<end*1000){
    const dt=Math.min(1000/30,end*1000-view.elapsed);
    now+=dt;view.elapsed+=dt;view.phase='running';view.currentX100=100*Math.pow(10,view.elapsed/30000);frame();
  }
  return {...view};
};
const tick=(duration,phase=view.phase)=>{
  validTime(duration);
  if(!['waiting','betting','running','crashed'].includes(phase))throw new Error('Unknown review phase');
  if(phase!==view.phase && phase==='crashed')view.crashAge=0;
  view.phase=phase;
  const target=now+duration*1000;
  // Exact final steps keep subsecond pose-strip labels aligned with the rendered clock.
  while(now+0.000001<target){
    const dt=Math.min(1000/30,target-now);now+=dt;
    if(phase==='running'){view.elapsed+=dt;view.currentX100=100*Math.pow(10,view.elapsed/30000);}
    else if(phase==='crashed')view.crashAge+=dt;
    frame();
  }
  if(duration===0)frame();
  return {...view};
};
const seek=(at,phase=at===0?'betting':'running')=>{
  validTime(at);
  scene.dispose?.();scene=createScene();now=1000+at*1000;
  Object.assign(view,{phase,currentX100:100*Math.pow(10,at/30),elapsed:at*1000,crashAge:0,cashoutX100:null,payout:null});
  frame();
  // Settle secondary springs without advancing authoritative round duration.
  for(let i=0;i<3;i++){now+=1000/30;frame();}
  return {...view};
};
const cashout=()=>{view.cashoutX100=view.currentX100;view.payout=Math.floor(50*view.currentX100/100);frame();return {...view};};
frame();
if(late){for(let i=0;i<3;i++){now+=1000/30;frame();}}else advance(seconds);
if(params.has('cashout')){cashout();tick(1.5);}
if(params.has('crash'))tick(1.5,'crashed');
window.sceneReview={view,advance,tick,seek,cashout,frame,done:true};
// A portrait renderer chooses its composition from CSS size, so resizing must redraw.
window.addEventListener('resize',frame);
for(const id of ['bet','cashout','restart'])document.querySelector('#'+id).hidden=true;
`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', outfile: join(dir, 'game.generated.js'), target: 'es2022' });
  for (const name of ['index.html','style.css']) await writeFile(join(dir,name),await readFile(join(root,'games',game,name)));
}
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
if (process.env.REVIEW_BUILD_ONLY === '1') console.log(`Built ${games.length} scene review fixtures in ${out}`);
else createServer(async(req,res)=>{try{const path=resolve(out,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(out+'/'))throw Error('path');res.setHeader('content-type',types[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.PORT||4511),'127.0.0.1',()=>console.log('Scene review ready on '+(process.env.PORT||4511)));
