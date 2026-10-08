import{endurance}from'./endurance';
import{type Spring,clamp,mulberry32,spring,stepSpring}from'./motion';
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smoothstep=(a:number,b:number,v:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
export const INK='#1c1f26';
export const FLOOR=432;
export const CHUTE_X=130;
export const ARENA_X=470;
export const RAIL={x:838,y:296};
export interface Dust{x:number;y:number;vx:number;vy:number;r:number;age:number}
export interface Bull{x:Spring;phase:number;hop:number;pitch:Spring;kick:number;landed:boolean;seatVelocity:{x:number;y:number}}
export interface Rider{mode:'riding'|'vaulting'|'fence'|'thrown'|'down';modeAge:number;lean:Spring;arm:Spring;hat:Spring;x:number;y:number;vx:number;vy:number;angle:number;spin:number;from:{x:number;y:number;angle:number};landing:Spring;releasedHand:{x:number;y:number}|null}
export interface BullDrive{running:boolean;tension:number;loose:boolean;seconds:number}
export const createBull=():Bull=>({x:spring(CHUTE_X),phase:0.75,hop:0,pitch:spring(0),kick:0,landed:false,seatVelocity:{x:0,y:0}});
export const createRider=():Rider=>({mode:'riding',modeAge:0,lean:spring(0),arm:spring(1.2),hat:spring(0),x:0,y:0,vx:0,vy:0,angle:0,spin:0,from:{x:0,y:0,angle:0},landing:spring(0),releasedHand:null});
export function seat(b:Bull):{x:number;y:number}{
 const p=b.pitch.x;
 return{x:b.x.x-18*Math.cos(p)+44*Math.sin(p),y:FLOOR-92-b.hop-18*Math.sin(p)-44*(Math.cos(p)-1)};
}
export function stepBull(b:Bull,drive:BullDrive,dt:number):void{
 const previousSeat=seat(b);
 const routine=drive.running?Math.floor(drive.seconds/12)%3:0;
 const act=endurance(drive.seconds);
 const travel=drive.running?(routine===1?Math.sin(drive.seconds*.7)*65:0)+(act.act===1?-80:act.act===3?80:0)*act.effort:0;
 stepSpring(b.x,drive.running||drive.loose?ARENA_X+travel:CHUTE_X,3,0.9,dt);
 const rate=drive.running?(0.9+1.7*drive.tension)*(routine===2?1.14:1)*(1-(act.act===2?.48:.12)*act.effort):drive.loose?0.5:0;
 const before=b.phase;
 b.phase+=rate*dt;
 b.hop=Math.max(0,Math.sin(b.phase*Math.PI*2))*(drive.running?20+(routine===2?45:70)*drive.tension*(1-(act.act===2?.55:0)*act.effort):12);
 b.kick=Math.max(0,Math.sin(b.phase*Math.PI*2-0.6));
 b.landed=rate>0&&Math.floor(before+0.5)!==Math.floor(b.phase+0.5);
 stepSpring(b.pitch,drive.running?(0.12+0.45*drive.tension)*Math.sin(b.phase*Math.PI*2+1.2):0,14,0.7,dt);
 if(dt>0){const next=seat(b);b.seatVelocity={x:(next.x-previousSeat.x)/dt,y:(next.y-previousSeat.y)/dt};}
}
export function vault(r:Rider,b:Bull):void{
 const from=seat(b);
 r.releasedHand=riderGrip(r,b).hand;
 Object.assign(r,{mode:'vaulting',modeAge:0,x:from.x,y:from.y,vx:(RAIL.x-from.x)/0.75,vy:(RAIL.y-from.y)/0.75-0.5*900*0.75,angle:r.lean.x,spin:0,from:{...from,angle:r.lean.x}});
}
export function throwRider(r:Rider,b:Bull,crashX100:number,quiet:boolean):void{
 r.releasedHand=riderGrip(r,b).hand;
 const random=mulberry32(crashX100);
 const from=seat(b);
 const vx=(random()>0.4?1:-1)*(150+random()*200);
 Object.assign(r,quiet?{mode:'down',x:from.x+120,y:FLOOR-14,angle:Math.PI/2}:{mode:'thrown',x:from.x,y:from.y,angle:r.lean.x},{modeAge:0,vx:vx+clamp(b.seatVelocity.x,-180,180),vy:-(360+random()*200),spin:(random()>0.5?1:-1)*(5+random()*5)});
}
export function stepRider(r:Rider,b:Bull,fear:number,dt:number,dust:Dust[]):boolean{
 r.modeAge+=dt;
 stepSpring(r.landing,0,18,0.6,dt);
 if(r.mode==='riding'){
   const p=seat(b);
   r.x=p.x;
   r.y=p.y;
   stepSpring(r.lean,-b.pitch.x*1.6-b.hop*0.004,9,0.35,dt);
   stepSpring(r.arm,1.1+b.pitch.x*2+Math.sin(b.phase*Math.PI*2)*0.5*fear,12,0.5,dt);
   stepSpring(r.hat,-b.hop*0.2,16,0.3,dt);
   return false;
 }
 if(r.mode!=='vaulting'&&r.mode!=='thrown')return false;
 if(r.mode==='vaulting'){
   const t=Math.min(0.75,r.modeAge),u=t/0.75;
   r.x=r.from.x+r.vx*t;
   r.y=r.from.y+r.vy*t+450*t*t;
   r.angle=r.from.angle*(1-u*u*(3-2*u))+Math.sin(Math.PI*u)*0.35;
 }else{
   r.x+=r.vx*dt;
   r.y+=r.vy*dt+450*dt*dt;
   r.vy+=900*dt;
   r.angle+=r.spin*dt;
 }
 if(r.mode==='vaulting'&&r.modeAge>=0.75){
   Object.assign(r,{mode:'fence',x:RAIL.x,y:RAIL.y,angle:0});
   r.landing.v+=25;
   return true;
 }
 if(r.mode==='thrown'&&r.y>=FLOOR-14&&r.vy>0){
   r.y=FLOOR-14;
   if(r.vy>220){
     r.vy*=-0.35;
     r.vx*=0.5;
   }else{
     r.mode='down';
     r.angle=r.vx>=0?Math.PI/2:-Math.PI/2;
   }
   puff(dust,r.x,FLOOR,8);
   return true;
 }
 return false;
}
export function puff(dust:Dust[],x:number,y:number,n:number):void{
 for(let i=0;i<n;i+=1)dust.push({x:x+(i-n/2)*6,y,vx:(i-n/2)*40,vy:-40-(i%3)*25,r:6+(i%4)*3,age:0});
}
export function stepDust(dust:Dust[],dt:number):Dust[]{
 for(const d of dust){
   d.age+=dt;
   d.x+=d.vx*dt;
   d.y+=d.vy*dt;
   d.r+=18*dt;
 }
 return dust.filter((d)=>d.age<0.9);
}

export function drawDust(c:CanvasRenderingContext2D,dust:Dust[]):void{
 for(const d of dust){
   c.fillStyle=`rgba(214, 178, 120, ${0.5*(1-d.age/0.9)})`;
   c.beginPath();c.arc(d.x,d.y,d.r,0,Math.PI*2);c.fill();
 }
}
function limb(c:CanvasRenderingContext2D,x:number,y:number,angle:number,length:number,width:number,colour:string):void{
 const ex=x+Math.sin(-angle)*length;
 const ey=y+Math.cos(angle)*length;
 c.lineCap='round';
 for(const[w,k]of[[width+4,INK],[width,colour]]as const){
   c.strokeStyle=k;c.lineWidth=w;
   c.beginPath();c.moveTo(x,y);c.lineTo(ex,ey);c.stroke();
 }
}
function blob(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string,stroke=true):void{
 c.fillStyle=fill;
 c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();
 if(stroke){c.strokeStyle=INK;c.lineWidth=3;c.stroke();}
}
export function drawBull(c:CanvasRenderingContext2D,b:Bull,time:number):void{
 c.save();
 c.translate(b.x.x,FLOOR-62-b.hop);
 c.rotate(b.pitch.x);
 const hide='#4a2c17';
 limb(c,-52,26,-b.kick*1.3,42,14,hide);
 limb(c,-38,24,-b.kick*1.1,42,14,'#3a2110');
 limb(c,40,26,b.kick*0.5,42,14,hide);
 limb(c,56,24,b.kick*0.35,42,14,'#3a2110');
 c.strokeStyle=INK;c.lineWidth=6;
 c.beginPath();c.moveTo(-76,-14);c.quadraticCurveTo(-110,-10+Math.sin(time*12)*30,-104+Math.sin(time*9)*10,-60);c.stroke();
 blob(c,0,0,80,40,hide);
 blob(c,-28,-36,36,22,hide);
 blob(c,8,14,50,18,'#6b4226',false);
 c.fillStyle='#e9d8a6';
 c.font='900 12px Impact, "Arial Black", sans-serif';
 c.textAlign='center';
 c.fillText('$BULL',-20,6);
 c.strokeStyle='#c9a27a';c.lineWidth=4;
 c.beginPath();c.moveTo(-40,-40);c.quadraticCurveTo(-18,-62,10,-40);c.stroke();
 blob(c,84,-10,32,25,hide);
 blob(c,108,2,20,14,'#c9a27a');
 for(const y of[-2,6])blob(c,118,y,2.5,2.5,INK,false);
 c.strokeStyle='#d4a017';c.lineWidth=3;
 c.beginPath();c.arc(126,8,6,0,Math.PI*2);c.stroke();
 blob(c,92,-20,6,6,'#ffffff');
 blob(c,94,-20,2.5,2.5,INK,false);
 c.strokeStyle=INK;c.lineWidth=3;
 c.beginPath();c.moveTo(80,-32);c.lineTo(100,-26);c.stroke();
 c.strokeStyle='#f4ecd2';c.lineWidth=7;
 c.beginPath();c.moveTo(70,-30);c.quadraticCurveTo(52,-62,74,-66);c.moveTo(96,-32);c.quadraticCurveTo(114,-62,96,-68);c.stroke();
 c.restore();
}
export function ropeGrip(b:Bull):{x:number;y:number}{
 const x=-16.5,y=-51;
 return{x:b.x.x+x*Math.cos(b.pitch.x)-y*Math.sin(b.pitch.x),y:FLOOR-62-b.hop+x*Math.sin(b.pitch.x)+y*Math.cos(b.pitch.x)};
}
export function riderGrip(r:Rider,b:Bull){
 const world=ropeGrip(b),c=Math.cos(r.lean.x),s=Math.sin(r.lean.x);
 const hand={x:(world.x-r.x)*c+(world.y-r.y)*s,y:-(world.x-r.x)*s+(world.y-r.y)*c};
 return gripArm(hand);
}
function gripArm(hand:{x:number;y:number}){
 const shoulder={x:-9,y:-34};
 const dx=hand.x-shoulder.x,dy=hand.y-shoulder.y,d=Math.max(.001,Math.hypot(dx,dy));
 const upper=34,lower=38,reach=clamp(d,4.001,71.999);
 const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
 const bend=Math.sqrt(Math.max(0,upper*upper-along*along));
 const elbow={x:shoulder.x+dx/d*along+dy/d*bend,y:shoulder.y+dy/d*along-dx/d*bend};
 return{shoulder,elbow,hand};
}
export function drawRider(c:CanvasRenderingContext2D,r:Rider,fear:number,shades:boolean,bull?:Bull):void{
 c.save();
 c.translate(r.x,r.y+r.landing.x);
 const flying=r.mode==='thrown';
 const fence=r.mode==='fence';
 c.rotate(r.mode==='riding'?r.lean.x:fence?0:r.angle);
 const shirt='#d5fb6d';
 limb(c,-8,0,fence?.4:flying?mix(.55,-.6,smoothstep(0,.2,r.modeAge)):.55,30,9,'#2f4858');
 limb(c,8,0,fence?-.4:flying?mix(-.55,.8,smoothstep(0,.2,r.modeAge)):-.55,30,9,'#2f4858');
 c.fillStyle=shirt;
 c.strokeStyle=INK;c.lineWidth=3;
 c.beginPath();c.roundRect(-12,-42,24,44,8);c.fill();c.stroke();
 if(bull){
   const live=riderGrip(r,bull);
   const shoulder=live.shoulder;
   const targetAngle=flying?2.2:2.9;
   const target={x:shoulder.x-Math.sin(targetAngle)*52,y:shoulder.y+Math.cos(targetAngle)*52};
   const release=r.mode==='riding'?0:smoothstep(0,.24,r.modeAge);
   const from=r.mode==='riding'?live.hand:r.releasedHand??live.hand;
   const hand={x:mix(from.x,target.x,release),y:mix(from.y,target.y,release)};
   const{elbow}=gripArm(hand);
   for(const[width,colour]of[[12,INK],[8,shirt]]as const){
     c.strokeStyle=colour;c.lineWidth=width;c.lineCap='round';c.lineJoin='round';
     c.beginPath();c.moveTo(shoulder.x,shoulder.y);c.lineTo(elbow.x,elbow.y);c.lineTo(hand.x,hand.y);c.stroke();
   }
   blob(c,hand.x,hand.y,4.5,4.5,'#f4d1b0');
 }else limb(c,-9,-34,flying?2.2:2.9,26,8,shirt);
 limb(c,9,-34,fence?-2.6:flying?-r.arm.x-smoothstep(0,.2,r.modeAge):-r.arm.x,30,8,shirt);
 blob(c,0,-56,14,14,'#f4d1b0');
 c.fillStyle=INK;
 if(shades)c.fillRect(-13,-63,26,8);
 else for(const x of[-5,5])blob(c,x,-59,2+fear*1.5,2+fear*1.5,INK,false);
 c.strokeStyle=INK;c.lineWidth=3;
 c.beginPath();
 if(fear>0.5||flying)c.ellipse(0,-48,4,3+4*fear,0,0,Math.PI*2);
 else c.arc(0,-52,6,0.3,Math.PI-0.3);
 c.stroke();
 if(!flying&&r.mode!=='down'){
   c.fillStyle='#8b5a2b';
   const y=-66+clamp(r.hat.x,-12,4);
   c.beginPath();c.ellipse(0,y,24,6,0,0,Math.PI*2);c.fill();c.stroke();
   c.beginPath();c.roundRect(-13,y-16,26,17,5);c.fill();c.stroke();
 }
 c.restore();
}
