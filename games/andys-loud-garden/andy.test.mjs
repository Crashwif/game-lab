import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [fileURLToPath(new URL('./andy.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createAndy, stepAndy, settleAndy, computePose, solveLimb, worldPoint, canFloorOffset } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const drive = (mode = 'watering', x = 216, growth = .7) => ({ mode, x, growth, ground: 480, bed: { x: 400, y: 452 }, street: { x: 940, y: 400 } });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} should equal ${b}`);
function fixedBones(pose) {
  for (const name of ['frontArm', 'backArm', 'frontLeg', 'backLeg']) {
    const {root, joint, end} = pose[name];
    const length = name.endsWith('Arm') ? 44 : 50;
    near(distance(root, joint), length);
    near(distance(joint, end), length);
  }
}

test('two-bone joints preserve both lengths at folded, unreachable and zero-distance targets', () => {
  for (const side of [-1, 1]) for (const [upper, lower] of [[44,44], [50,37]]) {
    for (const target of [{x:0,y:0},{x:0,y:.00001},{x:1,y:1},{x:50,y:20},{x:300,y:-80}]) {
      const limb = solveLimb({x:0,y:0}, target, upper, lower, side);
      near(distance(limb.root, limb.joint), upper);
      near(distance(limb.joint, limb.end), lower);
      assert.ok(distance(limb.root, limb.end) <= upper + lower);
    }
  }
});

test('watering keeps feet planted and the supporting hand on the actual tilted can', () => {
  const rig = createAndy(216);
  for (let i=0;i<1200;i++) {
    const d = drive('watering',216,(i%600)/600);
    stepAndy(rig,d,1/60,false);
    const pose=computePose(rig);
    fixedBones(pose);
    for (const [index,name] of ['backFoot','frontFoot'].entries()) {
      const foot=worldPoint(rig,pose[name],480);
      near(foot.x,index===0?191:243);
      near(foot.y,480);
    }
    if (i > 100 && rig.reach.x >= .6) {
      const dx=pose.backHand.x-pose.frontHand.x;
      const dy=pose.backHand.y-pose.frontHand.y;
      const x=dx*Math.cos(rig.tilt.x)+dy*Math.sin(rig.tilt.x);
      const y=-dx*Math.sin(rig.tilt.x)+dy*Math.cos(rig.tilt.x);
      near(x,-14); near(y,36);
    }
  }
});

test('harvest keeps a supporting foot still through the turn, acceleration and deceleration', () => {
  for (const fps of [30,60,120]) {
    const rig=createAndy(216);
    settleAndy(rig,drive());
    let planted=0,landings=0;
    for (let i=1;i<fps*4.5;i++) {
      const age=i/fps, u=Math.min(1,Math.max(0,(age-.7)/3.1));
      const x=216-360*u*u*(3-2*u);
      const before=rig.feet.map(f=>({...f}));
      stepAndy(rig,drive('harvest',x),1/fps,false);
      const pose=computePose(rig); fixedBones(pose);
      assert.ok(rig.feet.some(f=>f.lift===0), 'one foot always bears the weight');
      rig.feet.forEach((f,index)=>{
        if(before[index].swing===1 && f.swing===1) { near(f.x,before[index].x); planted++; }
        const rendered=worldPoint(rig,pose[index===0?'backFoot':'frontFoot'],480);
        near(rendered.x,f.x); near(rendered.y,480-f.lift);
      });
      if(rig.events.step)landings++;
    }
    assert.ok(planted>fps*3); assert.ok(landings>=5);
  }
});

test('a crash respects hit-stop, lifts the feet with the body, and lands the entire can above ground', () => {
  const rig=createAndy(216); settleAndy(rig,drive());
  const before=JSON.stringify(rig);
  stepAndy(rig,drive('busted'),0,false);
  assert.equal(JSON.stringify(rig),before,'frozen beat cannot release the can early');
  let airborne=false,landed=false;
  for(let i=0;i<300;i++) {
    stepAndy(rig,drive('busted'),1/60,false);
    const pose=computePose(rig); fixedBones(pose);
    if(rig.hop.x < -3) {
      airborne=true;
      near(worldPoint(rig,pose.frontFoot,480).y,480+rig.hop.x);
      near(worldPoint(rig,pose.backFoot,480).y,480+rig.hop.x);
    }
    assert.ok(rig.can.y+canFloorOffset(rig.can.angle)<=480+1e-7,'can geometry stays above the floor');
    landed ||= rig.events.land;
  }
  assert.ok(airborne && landed);
  assert.equal(rig.can.held,false);
});

test('reduced motion settles every mode immediately without time-dependent poses or prop flights', () => {
  for(const mode of ['idle','watering','busted','harvest']) {
    const rig=createAndy(216), d=drive(mode);
    stepAndy(rig,d,1/60,true);
    const before=JSON.stringify({pose:computePose(rig),can:rig.can,drops:rig.drops,time:rig.time});
    for(let i=0;i<180;i++)stepAndy(rig,d,1/30,true);
    assert.equal(JSON.stringify({pose:computePose(rig),can:rig.can,drops:rig.drops,time:rig.time}),before);
    assert.ok(Object.values(rig.events).every(e=>!e));
    if (!rig.can.held) near(rig.can.y+canFloorOffset(rig.can.angle),480);
    fixedBones(computePose(rig));
  }
});

test('rest beats preserve the can grip; the next round recovers after a bust', () => {
  const rig=createAndy(216); settleAndy(rig,drive());
  for(let i=0;i<45;i++)stepAndy(rig,drive('idle'),1/60,false);
  assert.equal(rig.can.held,true);
  for(let i=0;i<90;i++)stepAndy(rig,drive('busted'),1/60,false);
  for(let i=0;i<120;i++)stepAndy(rig,drive('idle'),1/60,false);
  assert.equal(rig.can.held,true);assert.equal(rig.drops.length,0);
  near(rig.raise.x,0);near(rig.hop.x,0);
  fixedBones(computePose(rig));
});
