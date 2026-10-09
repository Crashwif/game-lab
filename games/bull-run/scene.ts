import{portrait}from'./portrait';
import{pageAudio}from'./audio';
import{clamp,mix,smoothstep,spring,stepSpring}from'./motion';
import{type Ctx,type Dust,type Rider,FLOOR,INK,RAIL,blob,createBull,createRider,drawBull,drawDust,drawRider,endurance,limb,puff,stepBull,stepDust,stepRider,throwRider,vault}from'./bull';
export interface SceneView{phase:'waiting'|'betting'|'running'|'crashed';currentX100:number;elapsed:number;crashAge:number;stake:number|null;cashoutX100:number|null;payout:number|null}
export interface Scene{draw(c:Ctx,view:SceneView,now:number):void}
type Outcome='rekt'|'called'|'bucked';
type Secured={x100:number;payout:number|null;at:number};
const RUNGS=[1.2,1.4,2,3,5,8,14];
const CAPTIONS=['HOLD ON TIGHT','NO STOP LOSS','YEEHAW','8 SECONDS IS FOR JEETS','THE BEAR IS WATCHING','DIAMOND SPURS','HE IS NOT TIRED','LEGENDARY RIDE'];
const BANNERS=['$BULL RODEO','NO STOP LOSS SADDLERY','HODL FEED CO','100× LEVERAGED SPURS'];
const BARREL_X=760,BEAR_X=668,HORN=8e3;
function memeText(c:Ctx,text:string,x:number,y:number,size:number,fill:string,align:CanvasTextAlign,maxWidth?:number):void{
 c.font=`900 ${size}px Impact,"Arial Black","Helvetica Neue",Arial,sans-serif`;
 c.letterSpacing=`${Math.round(size*.1)}px`;
 c.textAlign=align;
 c.textBaseline='alphabetic';
 c.lineJoin='round';
 c.lineWidth=Math.max(1,size*(fill==INK?.05:.11));
 c.strokeStyle=fill==INK?'#f4d1b0':INK;
 c.strokeText(text,x,y,maxWidth);
 c.fillStyle=fill;
 c.fillText(text,x,y,maxWidth);
 c.letterSpacing='0px';
}
function captionFor(view:SceneView,rung:number,outcome:Outcome|null,secured:Secured|null):string{
 if(outcome)return outcome=='rekt'?'BULL TRAP':outcome=='called'?'DODGED THE BULL TRAP':'THE BULL WAS A BEAR';
 if(view.phase=='betting')return'GATE OPENS SOON';
 if(view.phase!='running')return'NEXT RIDE SOON';
 if(secured)return view.currentX100>=2*secured.x100?'IT BUCKS ON. YOU GOT PAID.':secured.at<HORN?'JEETED BEFORE THE HORN':'RODE IT. TOOK PROFITS.';
 const act=endurance(view.elapsed/1e3).act;
 return view.elapsed>=HORN&&view.elapsed<9500?'QUALIFIED RIDE':act?['','THE LEFT RAIL IS TOO CLOSE','CATCH YOUR BREATH','HE IS COMING BACK','ONE HAND. STILL HOLDING.'][act]!:CAPTIONS[rung]!;
}
// Heads bob on an integrated phase; after the horn the stands rise, arms up. Seat 15 is the bear's.
function drawArena(c:Ctx,bob:number,cheer:number,stand:number,gate:number,close:boolean):void{
 c.fillStyle='#5a2a1a';
 c.fillRect(0,0,960,300);
 if(!close)memeText(c,'DEGEN RODEO · TONIGHT: $BULL vs GRAVITY',480,150,22,'#f4d1b0','center',700);
 c.strokeStyle=INK;c.lineWidth=3;
 for(const[row,y,n,s]of[[0,278,22,1],[1,250,25,.82]]as const)for(let i=0;i<n;i++){
  if(!row&&i==15)continue;
  const x=20+(i+.5)*920/n,cy=y-12*s*stand+(Math.sin(bob+i*1.3+row)*(1.5+7*cheer));
  if(stand>.05){c.beginPath();for(const k of[-1,1]){c.moveTo(x+7*k*s,cy+12*s);c.lineTo(x+(7+6*stand)*k*s,cy-(4+14*stand)*s)}c.stroke()}
  c.fillStyle=['#f4d1b0','#8d5524','#e0ac69','#c68642'][i%4]!;
  c.beginPath();c.arc(x,cy,11*s,0,7);c.fill();c.stroke();
 }
 c.fillStyle='#c69c6d';
 c.fillRect(0,300,960,240);
 c.fillStyle='#8b5a2b';
 c.strokeStyle=INK;c.lineWidth=2;
 for(let x=43;x<960;x+=96){c.fillRect(x,262,10,84);c.strokeRect(x,262,10,84);}
 for(const y of[292,316]){c.fillRect(0,y,960,8);c.strokeRect(0,y,960,8);}
 for(let i=0;i<4;i++){
  c.fillStyle=i%2?'#d5fb6d':'#f4d1b0';
  c.fillRect(154+i*192,302,172,34);
  c.strokeRect(154+i*192,302,172,34);
  memeText(c,BANNERS[i]!,240+i*192,326,15,INK,'center',160);
 }
 c.fillStyle='#9ca3af';
 for(let y=280;y<440;y+=36)c.fillRect(140-gate,y,66,6);
 c.fillRect(196-gate,262,10,180);
 c.strokeRect(196-gate,262,10,180);
}
// The bear sits in the stands, stands at 3× and, at the crash, vaults the fence.
function drawBear(c:Ctx,x:number,y:number,up:number):void{
 const fur='#3a3a44';
 if(up>.05){for(const k of[-1,1])limb(c,x+13*k,y+20,-k*mix(.5,2.7,up),24,9,fur);blob(c,x,y+30,17,22,fur)}
 for(const k of[-1,1])blob(c,x+12*k,y-12,6,6,fur);
 blob(c,x,y,16,15,fur);
 blob(c,x,y+6,7,5,'#a1887f');
 for(const k of[-6,6])blob(c,x+k,y-4,2.5,2.5,'#fff',false);
}
// He rises in the barrel, stands on it at the crash, then hops off and legs it with the bag.
function drawClown(c:Ctx,peek:number,run:number):void{
 const s=14*Math.sin(run*.06);
 c.save();
 c.strokeStyle=INK;c.lineCap='round';
 if(!run){c.beginPath();c.rect(BARREL_X-30,FLOOR-200,60,136);c.clip()}
 c.translate(BARREL_X+run,run?FLOOR-Math.max(0,64+run*.8-run*run/40):FLOOR+27-50*peek);
 c.lineWidth=6;
 c.beginPath();c.moveTo(-s,0);c.lineTo(0,-30);c.lineTo(s,0);c.stroke();
 blob(c,0,-44,11,18,'#ff4d6d');
 if(run)blob(c,22,-40,12,15,'#c9a227');
 c.translate(0,-76);
 blob(c,0,0,15,15,'#fff');
 for(const k of[-1,1]){blob(c,k*15,-6,7,7,'#22c55e',false);blob(c,k*6,-5,2,2,INK,false)}
 blob(c,0,2,5,5,'#ff4d6d',false);
 c.lineWidth=3;
 c.beginPath();c.arc(0,4,8,.4,Math.PI-.4);c.stroke();
 c.restore();
}

export function createScene():Scene{
 const audio=pageAudio({style:'phonk',crash:'thud'}),bull=createBull(),gate=spring(0),peek=spring(0),pop=spring(0),badge=spring(0),stand=spring(0),up=spring(0);
 let rider=createRider(),gone:Rider|null=null,dust:Dust[]=[],last:number|null=null,previous:SceneView['phase']|null=null,time=0,age=0,bob=0,cheer=0,bear=0,punch=0,rung=0,shake=0,freeze=0,slow=0,run=0,horn=false,muted=false,outcome:Outcome|null=null,secured:Secured|null=null;
 function reset():void{
  gone=rider;
  rider=createRider();
  dust=[];
  rung=shake=freeze=slow=run=peek.x=0;
  horn=muted=false;
  outcome=secured=null;
 }
 function crash(view:SceneView,quiet:boolean):void{
  outcome=view.stake===null?'bucked':secured?'called':'rekt';
  if(rider.mode=='riding')throwRider(rider,bull,view.currentX100,quiet);
  if(quiet){pop.x=1;run=400;muted=true;return audio.crash('thud',true)}
  shake=1;pop.v=14;
  {freeze=.15;slow=.3;punch=1}
  audio.crash(secured?'crowd':'thud');
  if(!secured)audio.fx('scream',.8);
 }

 function draw(c:Ctx,view:SceneView,now:number,close=false):void{
  const real=last===null?0:clamp((now-last)/1e3,0,.1),fresh=previous===null,running=view.phase=='running',crashed=view.phase=='crashed',on=running||crashed,multiplier=Math.max(1,view.currentX100/100),tension=1-1/multiplier,next=RUNGS.filter(r=>multiplier>=r).length;
  last=now;
  // A new scene steps once by 9 s so every spring starts settled.
  let dt=fresh?9:real;
  if(freeze>0){freeze-=real;dt=0}
  else if(slow>0){slow-=real;dt=real*.3}
  time+=dt;
  age+=dt;
  if(view.cashoutX100!==null&&!secured){
   secured={x100:view.cashoutX100,payout:view.payout,at:view.elapsed};
   if(fresh||crashed)rider={...createRider(),mode:'fence',modeAge:1,x:RAIL.x,y:RAIL.y};
   else if(rider.mode=='riding'){vault(rider,bull);audio.cashout();audio.fx('whoosh',.7)}
  }
  if(fresh){
   rung=next;
   if(crashed)crash(view,true);
  }else if(view.phase!=previous){
   age=0;gone=null;
   if(crashed&&!outcome)crash(view,view.crashAge>1500);
   if(running&&previous=='betting'){audio.fx('door',1);audio.fx('clang',.6)}
   if(view.phase=='betting')reset();
  }
  previous=view.phase;
  audio.update(view.phase,tension);
  const ride=secured?.at??view.elapsed,fear=clamp(tension*1.2,0,1);
  if(running&&next>rung)audio.milestone(rung=next);
  // The eight-second buzzer is keyed to the ride clock only.
  if(running&&!horn&&view.elapsed>=HORN){
   horn=true;
   if(!fresh&&!secured){audio.fx('buzz',.8);audio.fx('cheer',.7)}
  }
  stepSpring(gate,on||bull.x.x>150?1:0,6,.6,dt);
  stepBull(bull,{running,tension,loose:crashed,seconds:view.elapsed/1e3},dt);
  if(bull.landed&&!fresh){
   puff(dust,bull.x.x+40,FLOOR,5);
   puff(dust,bull.x.x-50,FLOOR,5);
   if(running)shake=Math.max(shake,.25*tension);
   if(!muted)audio.fx('stomp',.25+.75*tension);
  }
  if(stepRider(rider,bull,fear,dt,dust)&&!muted)audio.fx('thud',rider.mode=='fence'?.4:1);
  dust=stepDust(dust,dt);
  stepSpring(peek,crashed?1.82:running&&tension>.25?tension+.25+.1*Math.sin(time*2):0,5,.7,dt);
  stepSpring(stand,on&&ride>=HORN?1:0,8,.6,dt);
  stepSpring(up,crashed||bear>0||running&&multiplier>=3?1:0,8,.6,dt);
  bear=clamp(bear+dt*(crashed&&view.crashAge>150?1.6:-1.6),0,1);
  cheer+=((running?tension:0)-cheer)*(1-Math.exp(-3*dt));
  bob+=dt*(3+5*cheer);
  if(crashed&&!muted&&peek.x>1.75){
   if(!run)audio.fx('laugh',.7);
   run+=240*dt;
  }
  stepSpring(pop,outcome?1:0,16,.45,dt);
  stepSpring(badge,secured?1:0,14,.5,dt);
  shake=Math.max(0,shake-dt/.45);
  punch=Math.max(0,punch-real/.6);

  c.save();
  if(shake>0)c.translate(Math.sin(time*90)*8*shake,Math.cos(time*70)*5*shake);
  if(punch>0){
   // Hit-stop punch-in: 10% on the rider, held 0.3 s, then eased out.
   const z=1+.1*smoothstep(0,.5,punch),x=clamp(rider.x,200,760),y=rider.y-40;
   c.translate(x,y);c.scale(z,z);c.translate(-x,-y);
  }
  drawArena(c,bob,cheer,stand.x,170*gate.x-(on?0:bull.hop*.6),close);
  drawBear(c,BEAR_X+30*bear,mix(274-22*up.x,FLOOR-52,bear)-380*bear*(1-bear),up.x);
  if(!run)drawClown(c,peek.x,0);
  c.fillStyle='#b91c1c';
  c.strokeStyle=INK;c.lineWidth=3;
  c.beginPath();c.roundRect(BARREL_X-26,FLOOR-64,52,66,10);c.fill();c.stroke();
  c.fillStyle='#f4d1b0';
  for(const y of[FLOOR-50,FLOOR-16])c.fillRect(BARREL_X-26,y,52,5);
  memeText(c,'DEV',BARREL_X,FLOOR-26,14,'#fff','center');
  drawDust(c,dust);
  // Between rounds the old rider fades out; the next fades in as the bull backs into the chute.
  if(gone&&age<.4){c.globalAlpha=1-age/.4;drawRider(c,gone,1,gone.mode=='fence',bull);}
  c.globalAlpha=on?1:clamp((200-bull.x.x)/50,0,1);
  if(rider.mode=='riding')drawRider(c,rider,fear,false,bull,true);
  const alpha=c.globalAlpha;
  c.globalAlpha=1;
  drawBull(c,bull,time);
  c.globalAlpha=alpha;
  drawRider(c,rider,crashed&&rider.mode!='fence'?1:fear,secured!==null,bull);
  c.globalAlpha=1;
  if(run>0&&run<400)drawClown(c,0,run);
  if(outcome&&pop.x>.02){
   c.save();
   c.translate(clamp(rider.x,220,700),clamp(rider.y-90,245,380));
   c.rotate(-.1);
   const k=clamp(pop.x,0,1.3);
   c.scale(k,k);
   memeText(c,outcome=='rekt'?'REKT':outcome=='called'?'CALLED IT':'BUCKED',0,0,84,outcome=='called'?'#ffe27a':'#ff4d6d','center');
   c.restore();
  }
  c.restore();

  memeText(c,captionFor(view,rung,outcome,secured),400,64,40,'#fff','center',600);
  if(secured&&badge.x>.02){
   c.save();
   c.translate(400,104);
   const k=clamp(badge.x,0,1.15);
   c.scale(k,k);
   memeText(c,`${secured.payout!==null?`+${secured.payout} · `:''}${(secured.x100/100).toFixed(2)}× SECURED`,0,0,26,'#7cf67c','center');
   c.restore();
  }
  memeText(c,`${multiplier.toFixed(2)}×`,936,68,56,outcome=='rekt'?'#ff4d6d':running?'#fff':'#ffe08a','right',220);
  if(on){
   // The ride ring fills to the horn.
   c.lineWidth=7;
   for(const[k,s]of[[1,INK],[Math.min(1,ride/HORN),ride<HORN?'#ffe27a':'#7cf67c']]as const){c.strokeStyle=s;c.beginPath();c.arc(42,512,13,-1.571,k*6.283-1.571);c.stroke()}
  }
  memeText(c,on?`${(ride/1e3).toFixed(1)} S ON THE BULL`:'CHUTE 4 · $BULL',on?66:24,520,22,'#ffe6c7','left');
 }

 return{draw:portrait(draw,'BULL RUN',()=>({x:Math.max(20,Math.min(460,rider.x-250)),y:125,w:480,h:350}),v=>captionFor(v,RUNGS.filter(r=>v.currentX100/100>=r).length,outcome,secured))};
}
