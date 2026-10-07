import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { join } from 'node:path';
import { ROOT } from './pack.mjs';
const cache = new Map();
async function game(path) {
  if (!cache.has(path)) cache.set(path, (async () => {
    const r = await build({ entryPoints: [join(ROOT, 'games', path + '.ts')], bundle: true, platform: 'node', format: 'esm', write: false });
    return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
  })());
  return cache.get(path);
}
const length = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
test('Honeypot fixed arm enters only through the mouth, then steps clear of the crate', async () => {
  const p = await game('honeypot/picnic'), j = await game('honeypot/jar');
  const state = p.createPicnic();
  for (const level of [0.16,0.57,0.96]) {
    const {shoulder,elbow,paw} = p.bearReach(state,level);
    assert.ok(Math.abs(length(shoulder,elbow)-56)<1e-8);
    assert.ok(Math.abs(length(elbow,paw)-56)<1e-8);
    for(const [a,b] of [[shoulder,elbow],[elbow,paw]]) for(let k=0;k<=100;k++) {
      const q={x:a.x+(b.x-a.x)*k/100,y:a.y+(b.y-a.y)*k/100};
      if(q.x>=j.JAR.cx-j.JAR.w/2 && q.x<=j.JAR.cx+j.JAR.w/2 && q.y>j.JAR.top+16)
        assert.ok(q.x>=j.JAR.cx-58 && q.y<=j.JAR.top+32,'the arm must enter the open neck, never the wall');
    }
  }
  p.pullPaw(state);
  for(let i=0;i<150;i++) {
    p.stepPicnic(state,{running:true,multiplier:100000,tension:1,level:0.96,reduced:false},1/60);
    const {shoulder,elbow,paw}=p.bearReach(state,0.96);
    assert.ok(Math.abs(length(shoulder,elbow)-56)<1e-7);
    assert.ok(Math.abs(length(elbow,paw)-56)<1e-7);
    if(p.bearBaseY(state)>295) assert.ok(state.bear.x<330,'body must clear the crate before descending');
  }
});
test('Boiler shovel stays rigid through the entire scoop',async()=>{
 const s=await game('boiler-room/stoker');
 for(let i=0;i<=1000;i++){const p=s.shovelPose(i/1000);assert.ok(Math.abs(length(p.grip,p.blade)-s.SHOVEL_LENGTH)<1e-8);}
});
test('Boiler blast starts continuously leftward and agrees with late aftermath',async()=>{
 const s=await game('boiler-room/stoker');const a=s.createStoker();a.mode='stoking';s.blastStoker(a,false);
 const start=a.fall.x;s.stepStoker(a,{rate:1,fear:1,pressure:1},1/60);
 assert.ok(a.fall.x<start);assert.ok(start-a.fall.x<=6);
 for(let i=0;i<300;i++)s.stepStoker(a,{rate:1,fear:1,pressure:1},1/60);
 const late=s.createStoker();s.blastStoker(late,true);assert.equal(a.mode,'floored');assert.equal(a.fall.x,late.fall.x);
});
test('Tower collapse camera contains all 99 floors and ground throughout the fall',async()=>{
 const t=await game('tower-tension/tower');const state=t.createTower();for(let i=0;i<99;i++)t.landFloor(state,0,0,true);
 t.collapseTower(state,10000000,false);
 for(let i=0;i<600;i++) {
   t.stepTower(state,0,1/60);
   const c=t.collapseCamera(state);
   for(const d of state.debris) {
     const x=480+(d.x-c.x)*c.s,y=270+(d.y-c.y)*c.s;
     assert.ok(x>=20&&x<=940,'debris inside horizontal safe area');assert.ok(y>=70&&y<=515,'debris inside vertical safe area');
   }
   assert.ok(270+(t.GROUND_Y-c.y)*c.s<=515);
 }
});
test('Driver hands stay on wheel while fixed shoulders remain within arm reach',async()=>{
 const c=await game('liquidation-lane/cockpit');
 for(let a=-0.7;a<=0.7;a+=0.01)for(const side of [-1,1]){
  const hand=c.steeringContact(side,a);assert.ok(Math.abs(length(hand,{x:219,y:505})-Math.hypot(88,54))<1e-8);
  assert.ok(length(hand,{x:side<0?110:320,y:600})<213);
 }
});
test('Astronaut elbows preserve both bones for grip and harness targets',async()=>{
 const r=await game('moon-boys/rocket');
 for(let i=0;i<300;i++)for(const side of [-1,1]){
  const root=[side*0.24,0.65+Math.sin(i/10)*0.035],end=[side*0.42,1.05];const joint=r.heroJoint(root,end,0.3,0.3,side);
  assert.ok(Math.abs(Math.hypot(root[0]-joint[0],root[1]-joint[1])-0.3)<1e-8);
  assert.ok(Math.abs(Math.hypot(end[0]-joint[0],end[1]-joint[1])-0.3)<1e-8);
 }
});

test('Exit developer chain and fist share one jittered wrist through every pose',async()=>{
 const p=await game('exit-liquidity/party'),state=p.createParty();state.tension=1;
 for(const mode of ['lounging','standing','selfie','leaving'])for(const motion of [0,1])for(let i=0;i<=200;i++){
  state.dev.mode=mode;state.dev.lean.x=i/200;state.dev.yank.x=i*0.15;state.time=i*0.073;state.motion=motion;state.dev.x=872+i;
  const pose=p.devArmPose(state);
  assert.deepEqual(p.devWrist(state),pose.wrist,'chain and fist use exactly the same socket');
  assert.ok(Math.abs(length(pose.shoulder,pose.elbow)-34)<1e-8);
  assert.ok(Math.abs(length(pose.elbow,pose.wrist)-36)<1e-8);
  assert.ok(Math.abs(length(pose.body,pose.shoulder)-10)<1e-8,'shoulder stays on the rotated bust');
 }
});

test('Exit ladder grips stay on the rendered rails and bounded 18-unit rungs',async()=>{
 const p=await game('exit-liquidity/party'),pool=await game('exit-liquidity/pool');
 for(let y=240;y<=460;y++)for(const side of [-1,1]){
  const q=p.ladderContact(side,y);assert.equal(q.x,pool.LADDER_X+side*7);
  assert.equal((q.y-(pool.POOL.top-10))%18,0);assert.ok(q.y>=pool.POOL.top-10&&q.y<pool.POOL.top+120);
 }
});

test('Tower running camera retains the swaying tower and crane after 180 continuous seconds',async()=>{
 const t=await game('tower-tension/tower'),c=await game('tower-tension/crane'),m=await game('tower-tension/motion');
 const tower=t.createTower(),crane=c.createCrane(),dt=1/30;
 const camera=m.spring(440),zoom=m.spring(1);let maxTravel=0;
 for(let frame=1;frame<=5400;frame++){
  const seconds=frame*dt,progress=6*Math.log2(10)*seconds/30,wind=m.gust(seconds)*(60+1.8*Math.min(30,t.floorCount(tower)));
  c.stepCrane(crane,progress,t.towerTopY(tower),wind,dt,1);
  if(crane.events.release)t.landFloor(tower,crane.drop.offset,crane.drop.velocity);
  while(t.floorCount(tower)<Math.floor(progress))t.landFloor(tower,0,0,true);
  t.stepTower(tower,wind,dt);
  const fit=t.runningCameraFrame(tower,Math.max(.5,Math.min(1,430/(t.towerHeight(tower)+270))));
  m.stepSpring(camera,fit.x,3,1,dt);m.stepSpring(zoom,fit.s,2.4,1,dt);
  for(const floor of tower.floors){
   maxTravel=Math.max(maxTravel,Math.abs(floor.x));
   const x=480+(t.TOWER_X+floor.x-camera.x)*zoom.x;
   assert.ok(x>35&&x<925,'actual continuously swaying floor stays on screen');
  }
  for(const x of [c.CRANE_X,c.JIB_TIP])assert.ok(480+(x-camera.x)*zoom.x>30&&480+(x-camera.x)*zoom.x<930);
 }
 assert.ok(maxTravel>900,'exercise the accumulated drift that previously escaped the camera');
});

test('Moon hero front points toward the chase camera instead of behind the hull',async()=>{
 const r=await game('moon-boys/rocket'),state=r.createRocket();
 for(const vx of [-40,0,40])for(const vz of [-40,0,40]){
  state.swayX.v=vx;state.swayZ.v=vz;
  const frame=r.rocketFrame(state),front=r.toWorld(frame,0,state.you.y,1),axis=r.toWorld(frame,0,state.you.y,0);
  assert.ok(front[2]>axis[2],'local front must face the world +Z chase camera');
  assert.ok(frame.x[0]>0,'right-handed frame keeps front decals and hero visible');
 }
});

test('Moon accepted-cashout camera retains hero and open canopy through departure',async()=>{
 const r=await game('moon-boys/rocket'),m=await game('moon-boys/math3d');
 for(const multiplier of [1.5,100000]){
  const state=r.createRocket();r.settleRocket(state,multiplier,150);r.bailYou(state);
  for(let age=0;age<=6.5;age+=1/30){
   state.you.age=age;
   const centre=r.cameraCentre(state),at=r.bailPosition(state),az=.55*Math.sin((150+age)*.23+.6),pitch=-.12;
   const eye=[centre[0]+Math.sin(az)*Math.cos(pitch)*19.5,centre[1]+Math.sin(pitch)*19.5,centre[2]+Math.cos(az)*Math.cos(pitch)*19.5];
   const target=m.add(centre,[0,2.4,0]),view=m.mat4(),projection=m.mat4(),vp=m.mat4();
   m.lookAt(view,eye,target,[0,1,0]);m.perspective(projection,71*Math.PI/180,960/540,.1,1400);m.multiply(vp,projection,view);
   for(const y of [-.3,0,2.4,3.8])for(const x of [-1.7,1.7]){
    const p=m.projectToScreen(vp,m.add(at,[x,y,0]),960,540);
    assert.ok(p&&p.x>25&&p.x<935&&p.y>100&&p.y<510,'hero and full canopy remain inside payoff safe area');
   }
  }
 }
});
