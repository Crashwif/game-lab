/** Local-only long-round presentation fixture. No outcome or protocol code enters a published game. */
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve, join, extname } from 'node:path';
import { GAMES } from '../games.mjs';
const root = resolve(import.meta.dirname, '../..');
const out = resolve(process.argv[2] || '/tmp/crashwif-scene-review');
await mkdir(out, { recursive: true });
for (const game of GAMES) {
  const dir = join(out, game);
  await mkdir(dir, { recursive: true });
  await build({ stdin: { contents: `import { createScene } from './games/${game}/scene';
const canvas = document.querySelector('canvas');
canvas.width=960; canvas.height=540;
const ctx=canvas.getContext('2d');
const params=new URLSearchParams(location.search);
const scene=createScene({reducedMotion:params.has('reduced')});
let now=1000;
const seconds=Number(params.get('seconds')||150);
if (!Number.isFinite(seconds) || seconds < 0 || seconds > 600) throw new Error('Review seconds must be between 0 and 600');
const late=params.has('late');
const view={phase:late?'running':'betting',currentX100:late?100*Math.pow(10,seconds/30):100,elapsed:late?seconds*1000:0,crashAge:0,stake:50,cashoutX100:null,payout:null};
now+=view.elapsed;
scene.draw(ctx,view,now);
const advance=(end)=>{ while(view.elapsed < end*1000){const dt=Math.min(1000/30,end*1000-view.elapsed);now+=dt;view.elapsed+=dt;view.phase='running';view.currentX100=100*Math.pow(10,view.elapsed/30000);scene.draw(ctx,view,now);} };
if(late){for(let i=0;i<3;i++){now+=1000/30;scene.draw(ctx,view,now);}}else advance(seconds);
if(params.has('cashout')){view.cashoutX100=view.currentX100;view.payout=Math.floor(50*view.currentX100/100);for(let i=0;i<45;i++){now+=1000/30;scene.draw(ctx,view,now);}}
if(params.has('crash')){view.phase='crashed';for(let i=0;i<45;i++){now+=1000/30;view.crashAge=i*1000/30;scene.draw(ctx,view,now);}}
window.sceneReview={view,advance,done:true};
document.querySelector('#status').textContent='Presentation review · '+seconds+'s · '+view.phase;
document.querySelector('#readout').textContent=(view.currentX100/100).toFixed(2)+'×';
for(const id of ['bet','cashout','restart'])document.querySelector('#'+id).hidden=true;
`, resolveDir: root, loader: 'ts' }, bundle: true, format: 'iife', platform: 'browser', outfile: join(dir, 'game.generated.js'), target: 'es2022' });
  for (const name of ['index.html','style.css']) await writeFile(join(dir,name),await readFile(join(root,'games',game,name)));
}
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
createServer(async(req,res)=>{try{const path=resolve(out,'.'+decodeURIComponent(req.url.split('?')[0]));if(!path.startsWith(out+'/'))throw Error('path');res.setHeader('content-type',types[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}}).listen(Number(process.env.PORT||4511),'127.0.0.1',()=>console.log('Scene review ready on '+(process.env.PORT||4511)));
