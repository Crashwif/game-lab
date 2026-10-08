import { portrait } from './portrait';
import { endurance } from './endurance';
import { pageAudio } from './audio';
import { clamp, settleSpring, spring, stepSpring } from './motion';
import { ARENA_X, type Bull, CHUTE_X, type Dust, FLOOR, INK, RAIL, type Rider, createBull, createRider, drawBull, drawDust, drawRider, puff, stepBull, stepDust, stepRider, throwRider, vault } from './bull';

export interface SceneView {
  phase: 'waiting' | 'betting' | 'running' | 'crashed';
  currentX100: number;
  elapsed: number;
  crashAge: number;
  stake: number | null;
  cashoutX100: number | null;
  payout: number | null;
}
export interface SceneOptions { reducedMotion?: boolean }
export interface Scene { draw(c: CanvasRenderingContext2D, view: SceneView, now: number): void }

const MEME_FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
const RUNGS = [1.4, 2, 3, 5, 8, 14];
const CAPTIONS = ['HOLD ON TIGHT', 'YEEHAW', '8 SECONDS IS FOR JEETS', 'DIAMOND SPURS', 'HE IS NOT TIRED', 'THE BEAR IS WATCHING', 'LEGENDARY RIDE'];
const BANNERS = ['$BULL RODEO', 'NO STOP LOSS SADDLERY', 'HODL FEED CO', 'DEGEN ARENA'];
const BARREL_X = 760;
type Outcome = 'rekt' | 'called' | 'bucked';
type Secured = { x100: number; payout: number | null };
function memeText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, fill: string, align: CanvasTextAlign, maxWidth?: number): void {
  c.font = `900 ${size}px ${MEME_FONT}`;
  c.letterSpacing = `${Math.round(size * 0.1)}px`;
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(1, size * (fill === INK ? 0.05 : 0.11));
  c.strokeStyle = fill === INK ? '#f4d1b0' : INK;
  c.strokeText(text, x, y, maxWidth);
  c.fillStyle = fill;
  c.fillText(text, x, y, maxWidth);
  c.letterSpacing = '0px';
}

function captionFor(view: SceneView, rung: number, outcome: Outcome | null, secured: Secured | null): string {
  if (outcome) return outcome === 'rekt' ? 'BUCKED OFF' : outcome === 'called' ? 'CALLED IT FROM THE FENCE' : 'THE BULL ALWAYS WINS';
  if (view.phase === 'betting') return 'GATE OPENS SOON';
  if (view.phase !== 'running') return 'NEXT RIDE SOON';
  if (secured) return 'DISMOUNTED WITH THE BAG';
  const act = endurance(view.elapsed / 1000);
  return act.act ? ['','THE LEFT RAIL IS TOO CLOSE','CATCH YOUR BREATH','HE IS COMING BACK','ONE HAND. STILL HOLDING.'][act.act]! : CAPTIONS[rung]!;
}
function drawArena(c:CanvasRenderingContext2D,time:number,tension:number,gate:number,reduced:boolean,close=false):void{
  c.fillStyle='#5a2a1a';
  c.fillRect(0,0,960,300);
  if(!close)memeText(c,'DEGEN RODEO · TONIGHT: $BULL vs GRAVITY',480,150,22,'#f4d1b0','center',700);
  c.strokeStyle=INK;c.lineWidth=3;
  for(const[row,y,n,s]of[[0,278,22,1],[1,250,25,0.82]]as const){
    for(let i=0;i<n;i+=1){
      const x=20+(i+0.5)*(920/n);
      const cy=y+(reduced?0:Math.sin(time*(3+5*tension)+i*1.3+row)*(1.5+7*tension));
      c.fillStyle=['#f4d1b0','#8d5524','#e0ac69','#c68642'][i%4]!;
      c.beginPath();c.arc(x,cy,11*s,0,Math.PI*2);c.fill();c.stroke();
    }
  }
  c.fillStyle='#c69c6d';
  c.fillRect(0,300,960,240);
  c.fillStyle='#8b5a2b';
  c.strokeStyle=INK;c.lineWidth=2;
  for(let x=43;x<960;x+=96){c.fillRect(x,262,10,84);c.strokeRect(x,262,10,84);}
  for(const y of[292,316]){c.fillRect(0,y,960,8);c.strokeRect(0,y,960,8);}
  for(let i=0;i<4;i+=1){
    c.fillStyle=i%2?'#d5fb6d':'#f4d1b0';
    c.fillRect(154+i*192,302,172,34);
    c.strokeRect(154+i*192,302,172,34);
    memeText(c,BANNERS[i]!,240+i*192,326,15,INK,'center',160);
  }
  c.fillStyle='#9ca3af';
  for(let y=280;y<440;y+=36)c.fillRect(140-170*gate,y,66,6);
  c.fillRect(196-170*gate,262,10,180);
  c.strokeRect(196-170*gate,262,10,180);
}
function drawClown(c:CanvasRenderingContext2D,peek:number,run:number,time:number):void{
  c.save();
  c.strokeStyle=INK;c.lineWidth=3;c.lineCap='round';
  if(run>0){
    c.translate(BARREL_X+run,FLOOR);
    c.lineWidth=6;
    c.beginPath();c.moveTo(-14*Math.sin(time*14),0);c.lineTo(0,-30);c.lineTo(14*Math.sin(time*14),0);c.stroke();
    c.lineWidth=3;
    c.fillStyle='#ff4d6d';
    c.beginPath();c.roundRect(-11,-62,22,36,6);c.fill();c.stroke();
    c.fillStyle='#c9a227';
    c.beginPath();c.ellipse(22,-40,12,15,0,0,Math.PI*2);c.fill();c.stroke();
    c.translate(0,-76);
  }else{
    c.beginPath();c.rect(BARREL_X-30,FLOOR-200,60,136);c.clip();
    c.translate(BARREL_X,FLOOR-49-50*peek);
  }
  c.fillStyle='#ffffff';
  c.beginPath();c.arc(0,0,15,0,Math.PI*2);c.fill();c.stroke();
  c.fillStyle='#22c55e';
  for(const s of[-1,1]){c.beginPath();c.arc(s*15,-6,7,0,Math.PI*2);c.fill();}
  c.fillStyle='#ff4d6d';
  c.beginPath();c.arc(0,2,5,0,Math.PI*2);c.fill();
  c.fillStyle=INK;
  for(const s of[-1,1]){c.beginPath();c.arc(s*6,-5,2,0,Math.PI*2);c.fill();}
  c.beginPath();c.arc(0,4,8,0.4,Math.PI-0.4);c.stroke();
  c.restore();
}

export function createScene(options: SceneOptions = {}): Scene {
  const reduced = options.reducedMotion === true;
  const audio = pageAudio({ style: 'phonk', crash: 'thud' });
  const bull: Bull = createBull();
  let rider: Rider = createRider();
  let dust: Dust[] = [];
  const gate = spring(0);
  const peek = spring(0);
  const pop = spring(0);
  const badge = spring(0);
  let last: number | null = null;
  let time = 0;
  let previous: SceneView['phase'] | null = null;
  let rung = 0;
  let shake = 0;
  let freeze = 0;
  let slow = 0;
  let run = 0;
  let outcome: Outcome | null = null;
  let secured: Secured | null = null;
  let muted = false;

  function reset(): void {
    rider = createRider();
    dust = [];
    rung = 0;
    shake = freeze = slow = run = 0;
    outcome = null;
    secured = null;
    muted = false;
    settleSpring(gate, 0);
    settleSpring(pop, 0);
    settleSpring(badge, 0);
  }
  function crash(view: SceneView, quiet: boolean): void {
    outcome = view.stake === null ? 'bucked' : secured ? 'called' : 'rekt';
    if (rider.mode === 'riding') throwRider(rider, bull, view.currentX100, quiet);
    if (quiet) {
      pop.x = 1;
      run = 400;
      muted = true;
      audio.crash('thud', true);
      return;
    }
    shake = 1;
    pop.v = 14;
    if (!reduced) {
      freeze = 0.07;
      slow = 0.4;
    }
    audio.crash(secured ? 'crowd' : 'thud');
    if (!secured) audio.fx('scream', 0.8);
  }

  function draw(c: CanvasRenderingContext2D, view: SceneView, now: number, close = false): void {
    const real = last === null ? 0 : clamp((now - last) / 1000, 0, 0.1);
    last = now;
    let dt = real;
    if (freeze > 0) {
      freeze -= real;
      dt = 0;
    } else if (slow > 0) {
      slow -= real;
      dt = real * 0.3;
    }
    time += dt;
    const multiplier = Math.max(1, view.currentX100 / 100);
    const tension = clamp(Math.log2(multiplier) / 3.2, 0, 1);
    const running = view.phase === 'running';
    const crashed = view.phase === 'crashed';
    const fresh = previous === null;
    if (view.cashoutX100 !== null && !secured) {
      secured = { x100: view.cashoutX100, payout: view.payout };
      if (fresh || crashed) rider = { ...createRider(), mode: 'fence', x: RAIL.x, y: RAIL.y };
      else if (rider.mode === 'riding') {
        vault(rider, bull);
        audio.cashout();
        audio.fx('whoosh', 0.7);
      }
    }
    if (fresh) {
      previous = view.phase;
      rung = RUNGS.filter((r) => multiplier >= r).length;
      settleSpring(bull.x, running || crashed ? ARENA_X : CHUTE_X);
      settleSpring(gate, running || crashed ? 1 : 0);
      settleSpring(badge, secured ? 1 : 0);
      if (crashed) crash(view, true);
    } else if (view.phase !== previous) {
      if (crashed && !outcome) crash(view, view.crashAge > 1500);
      if (running && previous === 'betting') {
        audio.fx('door', 1);
        audio.fx('clang', 0.6);
      }
      if (view.phase === 'betting') reset();
      previous = view.phase;
    }
    audio.update(view.phase, tension);
    const next = RUNGS.filter((r) => multiplier >= r).length;
    if (running && next > rung) {
      rung = next;
      audio.milestone(rung);
    }
    stepSpring(gate, running || crashed ? 1 : 0, 6, 0.6, dt);
    stepBull(bull, { running, tension, loose: crashed, seconds: reduced ? 0 : view.elapsed / 1000 }, dt);
    const fear = clamp(tension * 1.2, 0, 1);
    if (bull.landed) {
      puff(dust, bull.x.x + 40, FLOOR, 5);
      puff(dust, bull.x.x - 50, FLOOR, 5);
      if (running && !reduced) shake = Math.max(shake, 0.25 * tension);
      if (!muted) audio.fx('stomp', 0.3 + 0.7 * tension);
    }
    if (stepRider(rider, bull, fear, dt, dust) && !muted) audio.fx('thud', rider.mode === 'fence' ? 0.4 : 1);
    dust = stepDust(dust, dt);
    stepSpring(peek, running && tension > 0.35 ? 0.8 + 0.2 * Math.sin(time * 2) : 0, 5, 0.7, dt);
    if (crashed && !muted && view.crashAge > 800) {
      if (run === 0) audio.fx('laugh', 0.7);
      run += 240 * dt;
    }
    stepSpring(pop, outcome ? 1 : 0, 16, 0.45, dt);
    stepSpring(badge, secured ? 1 : 0, 14, 0.5, dt);
    if (shake > 0) shake = Math.max(0, shake - dt / 0.45);

    c.save();
    if (!reduced && shake > 0) c.translate(Math.sin(time * 90) * 8 * shake, Math.cos(time * 70) * 5 * shake);
    drawArena(c, time, running ? tension : 0, gate.x, reduced, close);
    if (run === 0) drawClown(c, peek.x, 0, time);
    c.fillStyle = '#b91c1c';
    c.strokeStyle = INK; c.lineWidth = 3;
    c.beginPath(); c.roundRect(BARREL_X - 26, FLOOR - 64, 52, 66, 10); c.fill(); c.stroke();
    c.fillStyle = '#f4d1b0';
    for (const y of [FLOOR - 50, FLOOR - 16]) c.fillRect(BARREL_X - 26, y, 52, 5);
    memeText(c, 'DEV', BARREL_X, FLOOR - 26, 14, '#ffffff', 'center');
    drawDust(c, dust);
    drawBull(c, bull, time);
    drawRider(c, rider, crashed && rider.mode !== 'fence' ? 1 : fear, secured !== null, bull);
    if (run > 0 && run < 400) drawClown(c, 0, run, time);
    if (outcome && pop.x > 0.02) {
      c.save();
      c.translate(clamp(rider.x, 220, 700), Math.min(rider.y - 90, 380));
      c.rotate(-0.1);
      c.scale(clamp(pop.x, 0, 1.3), clamp(pop.x, 0, 1.3));
      memeText(c, outcome === 'rekt' ? 'REKT' : outcome === 'called' ? 'CALLED IT' : 'BUCKED', 0, 0, 84, outcome === 'called' ? '#ffe27a' : '#ff4d6d', 'center');
      c.restore();
    }
    c.restore();

    memeText(c, captionFor(view, rung, outcome, secured), 400, 64, 40, '#ffffff', 'center', 600);
    if (secured && badge.x > 0.02) {
      c.save();
      c.translate(400, 104);
      c.scale(clamp(badge.x, 0, 1.15), clamp(badge.x, 0, 1.15));
      memeText(c, `${secured.payout !== null ? `+${secured.payout} · ` : ''}${(secured.x100 / 100).toFixed(2)}× SECURED`, 0, 0, 26, '#7cf67c', 'center');
      c.restore();
    }
    memeText(c, `${multiplier.toFixed(2)}×`, 936, 68, 56, outcome === 'rekt' ? '#ff4d6d' : running ? '#ffffff' : '#ffe08a', 'right', 220);
    memeText(c, running || crashed ? `${(view.elapsed / 1000).toFixed(1)} S ON THE BULL` : 'CHUTE 4 · $BULL', 24, 520, 22, '#ffe6c7', 'left');
  }

  return { draw: portrait(draw, 'BULL RUN', () => ({ x: Math.max(20, Math.min(460, rider.x - 250)), y: 125, w: 480, h: 350 }), v => captionFor(v, RUNGS.filter(r => v.currentX100 / 100 >= r).length, outcome, secured)) };
}
