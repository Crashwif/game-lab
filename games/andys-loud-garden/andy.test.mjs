import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [fileURLToPath(new URL('./andy.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createAndy, stepAndy, settleAndy, computePose, solveLimb, worldPoint, canFloorOffset, drawAndy } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
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

/** A 2D context that records its calls in order, so a test can read what is painted over what. */
function recordingContext() {
  const calls=[];
  const ctx=new Proxy({},{get:(styles,key)=>key in styles?styles[key]:(...args)=>calls.push({op:key,args}),set:(styles,key,value)=>{styles[key]=value;return true;}});
  return {ctx,calls};
}

/** Where drawAndy paints each stroke of the far arm and its palm, and the parts of him they layer against. */
function farArmOrder(rig, d) {
  const {ctx,calls}=recordingContext(); drawAndy(ctx,rig,d);
  const {hip,backArm:{root,joint,end}}=computePose(rig);
  const same=(call,op,args)=>call?.op===op&&args.every((value,i)=>Math.abs(call.args[i]-value)<1e-9);
  const at=(op,...args)=>calls.findIndex(c=>same(c,op,args));
  const all=(op,...args)=>calls.flatMap((c,i)=>same(c,op,args)?[i]:[]);
  // Every stroke of a straight segment from a to b.
  const segment=(a,b)=>calls.flatMap((c,i)=>c.op==='stroke'&&same(calls[i-2],'moveTo',[a.x,a.y])&&same(calls[i-1],'lineTo',[b.x,b.y])?[i]:[]);
  return {
    arm:{upper:segment(root,joint),sleeve:segment(root,{x:root.x+(joint.x-root.x)*.45,y:root.y+(joint.y-root.y)*.45}),forearm:segment(joint,end),palm:all('ellipse',end.x,end.y,10,9.5)},
    torso:at('translate',hip.x,hip.y), ear:at('translate',-40,-36), skull:at('moveTo',-47,-28),
  };
}

test('the far arm stays behind the body, even on the can; when caught its forearm rises behind the skull', () => {
  for(const [mode,layer] of [['idle','behind'],['watering','behind'],['busted','raised'],['harvest','behind']]) {
    const rig=createAndy(216), d=drive(mode); settleAndy(rig,d);
    const {arm:{upper,sleeve,forearm,palm},torso,ear,skull}=farArmOrder(rig,d);
    assert.ok([upper,sleeve,forearm,palm].every(strokes=>strokes.length)&&[torso,ear,skull].every(i=>i>=0),`${mode}: every part was drawn`);
    assert.ok(Math.max(...upper,...sleeve)<torso,`${mode}: the far shoulder and upper arm are painted before the torso`);
    if(layer==='behind')assert.ok(Math.max(...forearm,...palm)<torso,`${mode}: the forearm and hand stay behind the body`);
    if(layer==='raised')assert.ok(Math.min(...forearm,...palm)>ear&&Math.max(...forearm,...palm)<skull,`${mode}: the raised forearm and hand pass in front of the ear and behind the skull`);
  }
  // Watering acts ease in and out of the pour; through every frame the whole far arm stays behind the torso.
  const rig=createAndy(216); settleAndy(rig,drive('idle'));
  for(const [mode,frames] of [['idle',30],['watering',180],['idle',60],['watering',60]]) {
    for(let i=0;i<frames;i++) {
      const d=drive(mode); stepAndy(rig,d,1/60,false);
      const {arm,torso}=farArmOrder(rig,d);
      const strokes=Object.values(arm);
      assert.ok(strokes.every(s=>s.length)&&torso>=0,`${mode} frame ${i}: every part was drawn`);
      assert.ok(Math.max(...strokes.flat())<torso,`${mode} frame ${i}: the far arm is painted before the torso`);
    }
  }
});
