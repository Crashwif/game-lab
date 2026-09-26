import { GameClient, connectEmbedded, ReplayPlayer, verifyReplay, type RoomState, type ServerMessage } from '@crashwif/game-sdk';
import { free } from '@crashwif/crash-math';
import { createScene, type SceneView } from './scene';
import replay from './replay.json';

const canvas = document.querySelector<HTMLCanvasElement>('canvas')!;
const ctx = canvas.getContext('2d')!;
const status = document.querySelector<HTMLElement>('#status')!;
const bet = document.querySelector<HTMLButtonElement>('#bet')!;
const cashout = document.querySelector<HTMLButtonElement>('#cashout')!;
const restart = document.querySelector<HTMLButtonElement>('#restart')!;
const view: SceneView = { phase: 'waiting', currentX100: 100, elapsed: 0, crashAge: 0, stake: null, cashoutX100: null, payout: null };
const scene = createScene({ reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches });
let runningSince: number | null = null;
let crashTime = 0;
let clockOffset = 0;
let frame = 0;
let close = () => {};

function change(state: RoomState, message: ServerMessage | null) {
  const round = state.round;
  if (!round) return;
  if (view.phase !== 'crashed' && round.phase === 'crashed') crashTime = Date.now();
  view.phase = round.phase;
  view.currentX100 = round.crashX100 ?? round.multiplierX100;
  runningSince = round.runningSince;
  clockOffset = state.clockOffsetMs;
  // The server settles and clears a bet before it announces the crash, so a live round keeps the last bet it saw.
  const yourBet = state.you?.bet ?? null;
  if (yourBet) {
    view.stake = yourBet.stake;
    view.cashoutX100 = yourBet.cashoutX100;
  } else if (round.phase === 'betting' || round.phase === 'waiting') {
    view.stake = view.cashoutX100 = view.payout = null;
  }
  if (message?.type === 'cashout' && message.mine) view.payout = message.payout;
  status.textContent = state.integrity.length ? `Round verification failed: ${state.integrity.join(', ')}` : `${round.phase} · ${state.you ? `${state.you.creditsLeft} credits` : 'spectating'}`;
}

const mode = new URLSearchParams(location.search).get('mode');
if (mode === 'replay') {
  if (!verifyReplay(replay).ok) throw new Error('Invalid example replay');
  status.textContent = 'Recorded example round · no bets';
  const player = new ReplayPlayer(replay, { bettingMs: 1500 });
  player.on((event) => {
    if (event.type === 'round.betting') { view.phase = 'betting'; view.currentX100 = 100; view.elapsed = 0; runningSince = null; }
    if (event.type === 'round.locked') { view.phase = 'running'; runningSince = Date.now(); }
    if (event.type === 'tick') view.currentX100 = event.multiplierX100;
    if (event.type === 'round.crashed') { view.phase = 'crashed'; view.currentX100 = event.result.crashX100; crashTime = Date.now(); }
  });
  bet.hidden = cashout.hidden = true;
  restart.hidden = false;
  restart.onclick = () => { player.reset(); player.play(); };
  player.play();
  close = () => player.pause();
} else {
  const client = window.parent !== window ? connectEmbedded() : new GameClient({ baseUrl: 'ws://127.0.0.1:4500' });
  const onChange = (state: RoomState, message: ServerMessage | null) => {
    change(state, message);
    bet.disabled = !client.canBet || !state.you || !!state.you.bet || state.integrity.length > 0;
    cashout.disabled = state.round?.phase !== 'running' || state.you?.bet?.status !== 'active' || state.you.bet.cashoutX100 !== null || state.integrity.length > 0;
  };
  if (client instanceof GameClient) client.on('change', onChange);
  else {
    client.on('change', onChange);
    client.on('refused', (_intent, reason) => { status.textContent = `Refused: ${reason}`; });
  }
  bet.onclick = () => client.bet(50, null);
  cashout.onclick = () => client.cashout();
  if (client instanceof GameClient) {
    status.textContent = 'Connecting to the local emulator…';
    client.connect('emulator-game', async () => {
      const response = await fetch('http://127.0.0.1:4500/dev/sessions', { method: 'POST' });
      if (!response.ok) throw new Error('Start the emulator with npm run dev');
      const session = await response.json();
      return session.token;
    });
    close = () => client.close();
  } else close = () => client.close();
}

function draw(now: number) {
  const width = canvas.clientWidth;
  const height = width * 540 / 960;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(width * dpr)) { canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr); }
  ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0);
  if (view.phase === 'running' && runningSince !== null) {
    view.elapsed = Math.max(0, Date.now() + clockOffset - runningSince);
    view.currentX100 = Math.max(view.currentX100, free.multiplierAtContinuousX100(view.elapsed));
  }
  view.crashAge = Math.max(0, Date.now() - crashTime);
  scene.draw(ctx, view, now);
  frame = requestAnimationFrame(draw);
}
frame = requestAnimationFrame(draw);
window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); close(); });
