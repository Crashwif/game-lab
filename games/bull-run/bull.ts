import{type Spring,clamp,mix,mulberry32,smoothstep,spring,stepSpring}from'./motion';
export const INK='#1c1f26',FLOOR=432,CHUTE_X=130,ARENA_X=470,RAIL={x:838,y:296};
const TAU=Math.PI*2,STRIDE=60;
type P={x:number;y:number};
export type Ctx=CanvasRenderingContext2D;
export interface Dust{x:number;y:number;vx:number;vy:number;r:number;age:number}
export interface Bull{x:Spring;y:number;phase:number;rate:number;amp:Spring;hop:number;pitch:Spring;kick:number;walk:number;gait:number;landed:boolean;seatVx:number}
export interface Rider{mode:'riding'|'vaulting'|'fence'|'thrown'|'down';modeAge:number;lean:Spring;arm:Spring;hat:Spring;x:number;y:number;vx:number;vy:number;angle:number;spin:number;from:P&{angle:number};landing:Spring;held:P[]|null;cap:(P&{vx:number;vy:number;a:number})|null}
export interface BullDrive{running:boolean;tension:number;loose:boolean;seconds:number}
/** Presentation-only endurance acts from 42 s; the loop stays bounded. */
export function endurance(s:number){const u=Math.max(0,s-42)/26,f=u%1;return{act:s<42?0:1+Math.floor(u)%4,effort:smoothstep(0,.24,f)*(1-smoothstep(.62,.9,f))}}
export const createBull=():Bull=>({x:spring(CHUTE_X),y:FLOOR-68,phase:.75,rate:2,amp:spring(5),hop:0,pitch:spring(0),kick:0,walk:0,gait:0,landed:false,seatVx:0});
export const createRider=():Rider=>({mode:'riding',modeAge:0,lean:spring(0),arm:spring(1.2),hat:spring(0),x:0,y:0,vx:0,vy:0,angle:0,spin:0,from:{x:0,y:0,angle:0},landing:spring(0),held:null,cap:null});
/** A point of the bull's body frame in world space. */
export function at(b:Bull,x:number,y:number):P{const c=Math.cos(b.pitch.x),s=Math.sin(b.pitch.x);return{x:b.x.x+x*c-y*s,y:b.y+x*s+y*c}}
export const seat=(b:Bull)=>at(b,-18,-30);
export const ropeGrip=(b:Bull)=>at(b,-16.5,-51);
export function stepBull(b:Bull,d:BullDrive,dt:number):void{
 const s=d.seconds,before=seat(b).x,x=b.x.x,was=b.phase,routine=d.running?Math.floor(s/12)%3:0,{act,effort}=endurance(s),lull=act==2?effort:0;
 stepSpring(b.x,d.running?ARENA_X+(routine==1?Math.sin(s*.7)*65:0)+(act==1?-80:act==3?80:0)*effort:d.loose?ARENA_X:CHUTE_X,3,.9,dt);
 // Rate and height ease, so a hop in the air lands instead of snapping.
 b.rate+=((d.running?(.9+1.7*d.tension)*(routine==2?1.14:1)*(1-.3*lull):d.loose?.5:2)-b.rate)*(1-Math.exp(-4*dt));
 stepSpring(b.amp,d.running?20+(routine==2?45:70)*d.tension*(1-.35*lull):d.loose?12:5,6,1,dt);
 b.phase+=b.rate*dt;
 b.hop=Math.max(0,Math.sin(b.phase*TAU))*b.amp.x;
 b.kick=Math.max(0,Math.sin(b.phase*TAU-.6))*Math.min(1,b.amp.x/50);
 b.landed=Math.floor(was+.5)!=Math.floor(b.phase+.5);
 stepSpring(b.pitch,d.running?(.12+.45*d.tension)*Math.sin(b.phase*TAU+1.2):0,14,.7,dt);
 // The body rocks on its lowest hip, 42 px over the dirt; hooves step by distance.
 const p=b.pitch.x;
 b.y=FLOOR-42-b.hop-26*Math.cos(p)-Math.max(-52*Math.sin(p),40*Math.sin(p));
 b.walk+=(b.x.x-x)/STRIDE;
 b.gait=clamp(Math.abs(b.x.v)/10,0,1);
 if(dt>0)b.seatVx=(seat(b).x-before)/dt;
}
export function vault(r:Rider,b:Bull):void{
 const f=seat(b);
 hold(r,b);
 Object.assign(r,{mode:'vaulting',modeAge:0,x:f.x,y:f.y,vx:(RAIL.x-f.x)/.75,vy:(RAIL.y-f.y)/.75-337.5,angle:r.lean.x,spin:0,from:{...f,angle:r.lean.x}});
}
export function throwRider(r:Rider,b:Bull,crashX100:number,quiet:boolean):void{
 hold(r,b);
 const random=mulberry32(crashX100),f=seat(b),dir=random()>.4||f.x<300?1:-1,a=r.lean.x,k=66-clamp(r.hat.x,-12,4);
 // Out of the chute he goes into the arena; the landing stays on screen.
 const vx=clamp(dir*(150+random()*200)+clamp(b.seatVx,-180,180),(80-f.x)/2,(880-f.x)/2);
 Object.assign(r,quiet?{mode:'down',x:f.x+vx*.6}:{mode:'thrown',x:f.x,y:f.y,angle:a},{modeAge:0,vx,vy:-(380+random()*170),spin:(random()>.5?1:-1)*(5+random()*5),cap:{x:f.x+k*Math.sin(a),y:f.y-k*Math.cos(a),vx:vx*.5,vy:-380,a}});
}
// Pelvis height where his head, back or boots meet the dirt.
const ground=(a:number)=>FLOOR-14-Math.max(16*Math.cos(a),-56*Math.cos(a));
export function stepRider(r:Rider,b:Bull,fear:number,dt:number,dust:Dust[]):boolean{
 const m=r.mode,h=r.cap;
 r.modeAge+=dt;
 stepSpring(r.landing,0,18,.6,dt);
 // The hat flies on its own and rests in the dirt.
 if(h&&h.y<FLOOR-6){h.x+=h.vx*dt;h.y=Math.min(FLOOR-6,h.y+h.vy*dt+500*dt*dt);h.vy+=1e3*dt;h.a*=Math.exp(-4*dt)}
 if(m=='riding'){
  Object.assign(r,seat(b));
  stepSpring(r.lean,-(1.2+.8*fear)*b.pitch.x-b.hop*.004,22,.6,dt);
  stepSpring(r.arm,1.1+b.pitch.x*2+Math.sin(b.phase*TAU)*(.5+.7*fear),12,.5,dt);
  stepSpring(r.hat,-b.hop*.2,16,.3,dt);
  return false;
 }
 if(m=='down'){
  stepSpring(r.lean,r.vx<0?-1.571:1.571,10,.8,dt);
  r.angle=r.lean.x;
  r.y=ground(r.angle);
 }
 if(m=='vaulting'){
  const t=Math.min(.75,r.modeAge),u=t/.75;
  r.x=r.from.x+r.vx*t;
  r.y=r.from.y+r.vy*t+450*t*t;
  r.angle=r.from.angle*(1-smoothstep(0,1,u))+Math.sin(Math.PI*u)*.35;
  if(r.modeAge<.75)return false;
  Object.assign(r,{mode:'fence',x:RAIL.x,y:RAIL.y,angle:0});
  r.landing.v+=25;
  return true;
 }
 if(m!='thrown')return false;
 r.x+=r.vx*dt;
 r.y+=r.vy*dt+700*dt*dt;
 r.vy+=1400*dt;
 r.angle+=r.spin*dt;
 if(r.y<ground(r.angle)||r.vy<=0)return false;
 r.y=ground(r.angle);
 if(r.vy>260){r.vy*=-.25;r.vx*=.5}else{
  // He topples flat: wrap the spin to the nearest side, then spring there.
  const t=r.vx<0?-1.571:1.571;
  Object.assign(r,{mode:'down',modeAge:0,lean:{x:r.angle-Math.round((r.angle-t)/TAU)*TAU,v:r.spin*.5}});
 }
 puff(dust,r.x,FLOOR,8);
 return true;
}
export function puff(dust:Dust[],x:number,y:number,n:number):void{
 for(let i=0;i<n;i++)dust.push({x:x+(i-n/2)*6,y,vx:(i-n/2)*40,vy:-40-(i%3)*25,r:6+(i%4)*3,age:0});
}
export function stepDust(dust:Dust[],dt:number):Dust[]{
 for(const d of dust){d.age+=dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.r+=18*dt}
 return dust.filter(d=>d.age<.9);
}
export function drawDust(c:Ctx,dust:Dust[]):void{
 for(const d of dust){
  c.fillStyle=`rgba(214,178,120,${.5*(1-d.age/.9)})`;
  c.beginPath();c.arc(d.x,d.y,d.r,0,TAU);c.fill();
 }
}
/** Two-bone IK: root, joint (bent to side k) and end, at most u + l out. */
function ik(s:P,t:P,u:number,l:number,k:number):P[]{
 const dx=t.x-s.x,dy=t.y-s.y,d=Math.max(.001,Math.hypot(dx,dy)),r=clamp(d,Math.abs(u-l)+.001,u+l-.001),a=(u*u-l*l+r*r)/2/r,h=k*Math.sqrt(Math.max(0,u*u-a*a));
 return[s,{x:s.x+(dx*a+dy*h)/d,y:s.y+(dy*a-dx*h)/d},{x:s.x+dx*r/d,y:s.y+dy*r/d}];
}
export function line(c:Ctx,p:P[],w:number,k:string):void{
 c.lineCap=c.lineJoin='round';
 for(const[a,s]of[[w+4,INK],[w,k]]as const){
  c.lineWidth=a;c.strokeStyle=s;
  c.beginPath();for(const q of p)c.lineTo(q.x,q.y);c.stroke();
 }
}
export const limb=(c:Ctx,x:number,y:number,a:number,l:number,w:number,k:string)=>line(c,[{x,y},{x:x-Math.sin(a)*l,y:y+Math.cos(a)*l}],w,k);
export function blob(c:Ctx,x:number,y:number,rx:number,ry:number,fill:string,stroke=true):void{
 c.fillStyle=fill;
 c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();
 if(stroke){c.strokeStyle=INK;c.lineWidth=3;c.stroke();}
}
// Far legs first. Diagonal pairs share a trot phase; the front knee bends forward, the hock back.
const LEGS=[[-38,24,.5,-1,'#3a2110'],[56,24,0,1,'#3a2110'],[-52,26,0,-1,'#4a2c17'],[40,26,.5,1,'#4a2c17']]as const;
export function drawBull(c:Ctx,b:Bull,time:number):void{
 for(const[x,y,o,k,hide]of LEGS){
  const f=((b.walk+o)%1+1)%1;
  line(c,ik(at(b,x,y),{x:b.x.x+x+STRIDE*(Math.abs(f-.5)-.25)+(k<0?-40:12)*b.kick,y:FLOOR-7-14*b.gait*Math.max(0,-Math.sin(f*TAU))-(k<0?30:12)*b.kick},21,21,k),14,hide);
 }
 c.save();
 c.translate(b.x.x,b.y);
 c.rotate(b.pitch.x);
 const hide='#4a2c17';
 c.strokeStyle=INK;c.lineWidth=6;
 c.beginPath();c.moveTo(-76,-14);c.quadraticCurveTo(-110,-10+Math.sin(time*12)*30,-104+Math.sin(time*9)*10,-60);c.stroke();
 blob(c,0,0,80,40,hide);
 blob(c,-28,-36,36,22,hide);
 blob(c,8,14,50,18,'#6b4226',false);
 c.fillStyle='#e9d8a6';
 c.font='900 12px Impact,"Arial Black",sans-serif';
 c.textAlign='center';
 c.fillText('$BULL',-20,6);
 c.strokeStyle='#c9a27a';c.lineWidth=4;
 c.beginPath();c.moveTo(-40,-40);c.quadraticCurveTo(-18,-62,10,-40);c.stroke();
 blob(c,84,-10,32,25,hide);
 blob(c,108,2,20,14,'#c9a27a');
 for(const y of[-2,6])blob(c,118,y,2.5,2.5,INK,false);
 c.strokeStyle='#d4a017';c.lineWidth=3;
 c.beginPath();c.arc(126,8,6,0,TAU);c.stroke();
 blob(c,92,-20,6,6,'#fff');
 blob(c,94,-20,2.5,2.5,INK,false);
 c.beginPath();c.moveTo(80,-32);c.lineTo(100,-26);c.stroke();
 c.strokeStyle='#f4ecd2';c.lineWidth=7;
 c.beginPath();c.moveTo(70,-30);c.quadraticCurveTo(52,-62,74,-66);c.moveTo(96,-32);c.quadraticCurveTo(114,-62,96,-68);c.stroke();
 c.restore();
}
const local=(r:Rider,w:P,a:number):P=>{const c=Math.cos(a),s=Math.sin(a),x=w.x-r.x,y=w.y-r.y;return{x:x*c+y*s,y:y*c-x*s}},
 // At release his grip and spurs freeze in his frame.
 hold=(r:Rider,b:Bull)=>r.held=[riderGrip(r,b).hand,...[-8,-2].map(x=>local(r,at(b,x,-8),r.lean.x))];
export function riderGrip(r:Rider,b:Bull){const[shoulder,elbow,hand]=ik({x:-9,y:-34},local(r,ropeGrip(b),r.lean.x),34,38,1);return{shoulder,elbow,hand:hand!}}
/** The rider; `far` draws only the far leg, behind the bull. */
export function drawRider(c:Ctx,r:Rider,fear:number,shades:boolean,b:Bull,far=false):void{
 const m=r.mode,riding=m=='riding',flying=m=='thrown',rot=riding?r.lean.x:m=='fence'?0:r.angle,shirt='#d5fb6d',
  release=riding?0:smoothstep(0,.24,m=='down'?1:r.modeAge),
  fly=flying?smoothstep(0,.2,r.modeAge):m=='down'?1-smoothstep(0,.2,r.modeAge):0,
  sit=m=='fence'||m=='vaulting'?smoothstep(.45,.75,r.modeAge):0;
 c.save();
 c.translate(r.x,r.y+r.landing.x);
 c.rotate(rot);
 // Riding, the pelvis is pinned to the seat and the spurs to the flank; released, the legs ease free.
 for(const i of far?[1]:riding?[0]:[1,0]){
  const hip={x:i?8:-8,y:0},a=(i?-1:1)*mix(mix(.55,i?-.8:-.6,fly),.4,sit),q=r.held?.[i+1]??local(r,at(b,i?-2:-8,-8),rot);
  line(c,ik(hip,{x:mix(q.x,hip.x-Math.sin(a)*30,release),y:mix(q.y,Math.cos(a)*30,release)},18,16,1),9,'#2f4858');
 }
 if(far)return c.restore();
 c.fillStyle=shirt;
 c.strokeStyle=INK;c.lineWidth=3;
 c.beginPath();c.roundRect(-12,-42,24,44,8);c.fill();c.stroke();
 const live=riderGrip(r,b),sh=live.shoulder,ta=mix(2.9,2.2,fly),from=r.held?.[0]??live.hand,
  arm=ik(sh,{x:mix(from.x,sh.x-Math.sin(ta)*52,release),y:mix(from.y,sh.y+Math.cos(ta)*52,release)},34,38,1),hand=arm[2]!;
 line(c,arm,8,shirt);
 blob(c,hand.x,hand.y,4.5,4.5,'#f4d1b0');
 limb(c,9,-34,-mix(r.arm.x+fly,2.6,sit),30,8,shirt);
 blob(c,0,-56,14,14,'#f4d1b0');
 c.fillStyle=INK;
 if(shades)c.fillRect(-13,-63,26,8);
 else for(const x of[-5,5])blob(c,x,-59,2+fear*1.5,2+fear*1.5,INK,false);
 c.beginPath();
 if(fear>.5||flying)c.ellipse(0,-48,4,3+4*fear,0,0,TAU);
 else c.arc(0,-52,6,.3,Math.PI-.3);
 c.stroke();
 const h=r.cap;
 if(h){const p=local(r,h,rot);c.translate(p.x,p.y);c.rotate(h.a-rot)}else c.translate(0,-66+clamp(r.hat.x,-12,4));
 c.fillStyle='#8b5a2b';
 c.beginPath();c.ellipse(0,0,24,6,0,0,TAU);c.fill();c.stroke();
 c.beginPath();c.roundRect(-13,-16,26,17,5);c.fill();c.stroke();
 c.restore();
}
