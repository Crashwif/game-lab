import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: [fileURLToPath(new URL('./andy.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createAndy, stepAndy, settleAndy, computePose, solveLimb, worldPoint, canFloorOffset, drawAndy } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const raid = await build({ entryPoints: [fileURLToPath(new URL('./police.ts', import.meta.url))], bundle: true, write: false, format: 'esm', platform: 'node' });
const { gait, police } = await import(`data:text/javascript;base64,${Buffer.from(raid.outputFiles[0].text).toString('base64')}`);
const drive = (mode = 'watering', x = 216, tension = .7) => ({ mode, x, tension, ground: 480, bed: { x: 400, y: 452 }, street: { x: 940, y: 400 } });
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
    stepAndy(rig,d,1/60);
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
      stepAndy(rig,drive('harvest',x),1/fps);
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
  stepAndy(rig,drive('busted'),0);
  assert.equal(JSON.stringify(rig),before,'frozen beat cannot release the can early');
  let airborne=false,landed=false;
  for(let i=0;i<300;i++) {
    stepAndy(rig,drive('busted'),1/60);
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

test('rest beats preserve the can grip; the next round recovers after a bust', () => {
  const rig=createAndy(216); settleAndy(rig,drive());
  for(let i=0;i<45;i++)stepAndy(rig,drive('idle'),1/60);
  assert.equal(rig.can.held,true);
  for(let i=0;i<90;i++)stepAndy(rig,drive('busted'),1/60);
  for(let i=0;i<120;i++)stepAndy(rig,drive('idle'),1/60);
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
      const d=drive(mode); stepAndy(rig,d,1/60);
      const {arm,torso}=farArmOrder(rig,d);
      const strokes=Object.values(arm);
      assert.ok(strokes.every(s=>s.length)&&torso>=0,`${mode} frame ${i}: every part was drawn`);
      assert.ok(Math.max(...strokes.flat())<torso,`${mode} frame ${i}: the far arm is painted before the torso`);
    }
  }
});

test('a scare (headlights, a siren) ducks him at any frame rate without lifting a planted foot', () => {
  for (const fps of [30,60,144]) {
    const rig=createAndy(216); settleAndy(rig,drive());
    let deepest=0;
    for (let i=0;i<fps*3;i++) {
      const alarm=Math.max(0,Math.sin(Math.PI*i/fps/1.4));
      stepAndy(rig,{...drive('watering',216,.5),alarm},1/fps);
      const pose=computePose(rig); fixedBones(pose);
      for (const [index,name] of ['backFoot','frontFoot'].entries()) {
        const foot=worldPoint(rig,pose[name],480);
        near(foot.x,index===0?191:243); near(foot.y,480);
      }
      deepest=Math.max(deepest,rig.crouch.x);
    }
    assert.ok(deepest>.25,`${fps} fps: he visibly ducks (${deepest})`);
  }
});

test('the agents walk in by distance: a stance foot holds still on the ground and both land planted', () => {
  for (const [walked,steps,scale] of [[101,4,.85],[53,3,.78]]) {
    const travel=walked/scale, stride=2*travel/steps;
    for (const offset of [0,.5]) {
      let held=null;
      for (let i=0;i<=600;i++) {
        const d=travel*i/600, foot=gait(d,stride,offset), world=foot.x*scale-d*scale;
        if (foot.lift===0) { if (held!==null) near(world,held,1e-6); held=world; } else held=null;
        if (i>0) { const before=gait(travel*(i-1)/600,stride,offset); assert.ok(Math.abs(foot.x-before.x)<stride/40,'no snap between frames'); }
      }
      const end=gait(travel,stride,offset); near(end.lift,0,1e-6);
    }
  }
});

/** A 2D context that applies its own transforms, so a test can read where each stroke lands on the canvas. */
function placedStrokes() {
  let m=[1,0,0,1,0,0],path=[]; const stack=[],strokes=[],styles={};
  const mul=([a2,b2,c2,d2,e2,f2])=>{const [a,b,c,d,e,f]=m; m=[a*a2+c*b2,b*a2+d*b2,a*c2+c*d2,b*c2+d*d2,a*e2+c*f2+e,b*e2+d*f2+f];};
  const point=(x,y)=>path.push({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]});
  const ops={save:()=>stack.push(m),restore:()=>{m=stack.pop();},translate:(x,y)=>mul([1,0,0,1,x,y]),scale:(x,y)=>mul([x,0,0,y,0,0]),
    rotate:a=>mul([Math.cos(a),Math.sin(a),-Math.sin(a),Math.cos(a),0,0]),beginPath:()=>{path=[];},moveTo:point,lineTo:point,stroke:()=>strokes.push({width:styles.lineWidth,path})};
  return {ctx:new Proxy(styles,{get:(s,k)=>k in ops?ops[k]:k in s?s[k]:()=>{},set:(s,k,v)=>{s[k]=v;return true;}}),strokes};
}

test('the walking agents keep a foot on the ground under the body\'s bob, still while it bears weight, and stop on both feet', () => {
  for (const fps of [30,60,144]) {
    const held=[null,null,null,null];
    for (let i=0;i<=fps*1.2;i++) {
      const age=.45+i/fps, {ctx,strokes}=placedStrokes(); police(ctx,age);
      const feet=strokes.filter(s=>s.width===11).map(s=>s.path.at(-1));
      assert.equal(feet.length,4);
      for (const [agent,ground] of [[0,480-8*.85],[1,475-8*.78]]) {
        const pair=feet.slice(agent*2,agent*2+2), down=pair.map(f=>Math.abs(f.y-ground)<1e-6);
        pair.forEach(f=>assert.ok(f.y<=ground+1e-6,'no boot sinks into the ground'));
        assert.ok(down.some(Boolean),`${fps} fps, ${age.toFixed(3)} s: agent ${agent} has a foot on the ground`);
        if (age>=1.35) assert.ok(down.every(Boolean),'both feet planted once the walk ends');
        pair.forEach((f,j)=>{const k=agent*2+j; if (down[j]) { if (held[k]!==null) near(f.x,held[k],1e-6); held[k]=f.x; } else held[k]=null;});
      }
    }
  }
});
