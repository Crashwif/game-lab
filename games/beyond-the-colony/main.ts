/** Shared page shell. Canonical source: scripts/shell/main.ts; sync with npm run shell -- --write.
 * The SDK owns rounds and intents. This shell displays standalone, embedded, or recorded play.
 */
import { GameClient, ROOM_ERRORS, ReplayPlayer, replayCurve, connectEmbedded, verifyReplay, type EmbeddedGame, type ReplayRound, type RoomState, type ServerMessage, type YouState } from '@crashwif/game-sdk';
import { free } from '@crashwif/crash-math';
import { createScene, type SceneView } from './scene';
import replay from './replay.json';

/** The stake Join round places. Standalone only: embedded, the host's bet panel sets the stake. */
const STAKE = 50;
const EMULATOR = 'http://127.0.0.1:4500';
/** A running round's number runs ahead of the last server frame by at most this long, then waits for the next. */
const MAX_AHEAD_MS = 1_000;
/** No server frame for this long while a round runs: the link counts as lost and Cash out waits for it. */
const STALE_MS = 2_000;
/** How long a notice (a refusal, an error from the room) stays up. */
const NOTICE_MS = 4_000;
/** A Join or Cash out click waits this long for the room's answer before the button is offered again. */
const PENDING_MS = 3_000;
/** How long the recorded round shows its betting phase. */
const REPLAY_BETTING_MS = 1_500;
/** A live page that drew nothing for this long (a hidden tab, a frame scrolled away) gets a fresh scene. */
const FRAME_GAP_MS = 1_500;

const root = document.documentElement;
const shell = document.querySelector('main')!;
const canvas = document.querySelector('canvas')!;
const ctx = canvas.getContext('2d')!;
const statusLine = document.querySelector<HTMLElement>('#status')!;
const readout = document.querySelector<HTMLElement>('#readout');
const notice = document.querySelector<HTMLElement>('#notice');
const bet = document.querySelector<HTMLButtonElement>('#bet')!;
const cashout = document.querySelector<HTMLButtonElement>('#cashout')!;
const restart = document.querySelector<HTMLButtonElement>('#restart')!;

const framed = window.parent !== window;
const mode: 'replay' | 'embedded' | 'standalone' = new URLSearchParams(location.search).get('mode') === 'replay' ? 'replay' : framed ? 'embedded' : 'standalone';
root.dataset.mode = mode;
if (framed) root.dataset.framed = '';
/** Keyboard hints only where a keyboard is likely (a fine pointer that can hover). */
const keyboardHints = matchMedia('(hover: hover) and (pointer: fine)');

const view: SceneView = { phase: 'waiting', currentX100: 100, elapsed: 0, crashAge: 0, stake: null, cashoutX100: null, payout: null };
let scene = createScene();
/** The round in view, and the round the scene last drew. */
let roundKey: string | null = null;
let drawnRound: string | null = null;
let lastDrawnAt = 0;
let crashTime = 0;
let frame = 0;
let sceneFailed = false;
let stepReplay: (() => void) | null = null;
let close = () => {};

const formatX = (x100: number) => `${(x100 / 100).toFixed(2)}×`;
const credits = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'credit' : 'credits'}`;
const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? '' : '.'}`;

/** Writes only when the text changes, so the live region isn't hit on every server frame. */
function write(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

/** Buttons grey out with aria-disabled rather than disabled, so a focused button keeps focus through a round. */
function offer(button: HTMLButtonElement, enabled: boolean): void {
  const value = enabled ? 'false' : 'true';
  if (button.getAttribute('aria-disabled') !== value) button.setAttribute('aria-disabled', value);
}

let noticeUntil = 0;
/** Notices that stay until their cause clears (a caught room, a scene error, no emulator), latest last; brief ones cover them, then give way. */
const lasting: string[] = [];
/** Shows a notice in the alert region; `ms` 0 keeps it up until dropNotice. */
function showNotice(text: string, ms = NOTICE_MS): void {
  if (!notice) return;
  if (ms <= 0) {
    const at = lasting.indexOf(text);
    if (at >= 0) lasting.splice(at, 1);
    lasting.push(text);
  }
  notice.hidden = false;
  write(notice, text);
  noticeUntil = ms > 0 ? performance.now() + ms : Infinity;
}

/** Takes down a lasting notice once its cause has cleared; any other lasting notice shows again. */
function dropNotice(text: string): void {
  const at = lasting.indexOf(text);
  if (at >= 0) lasting.splice(at, 1);
  if (notice?.textContent === text) noticeUntil = 0;
}

function expireNotice(now: number): void {
  if (!notice || notice.hidden || now <= noticeUntil) return;
  const last = lasting[lasting.length - 1];
  if (last) {
    write(notice, last);
    noticeUntil = Infinity;
  } else {
    notice.hidden = true;
    notice.textContent = '';
  }
}

function disposeScene(): void {
  (scene as unknown as { dispose?: () => void }).dispose?.();
}

function drawScene(now: number): void {
  // Late entry or a hidden live frame gets a fresh scene; replay pauses while hidden.
  const newRound = roundKey !== null && roundKey !== drawnRound;
  const lostSight = mode !== 'replay' && lastDrawnAt > 0 && now - lastDrawnAt > FRAME_GAP_MS && (view.phase === 'running' || view.phase === 'crashed');
  lastDrawnAt = now;
  if ((newRound && view.phase !== 'betting') || lostSight) {
    disposeScene();
    scene = createScene();
  }
  if (newRound) drawnRound = roundKey;
  ctx.setTransform(canvas.width / 960, 0, 0, canvas.height / 540, 0, 0);
  try {
    scene.draw(ctx, view, now);
  } catch (error) {
    // Resizing to the same size clears any save()d state or clip the failed frame left behind.
    canvas.width = canvas.width;
    if (!sceneFailed) {
      sceneFailed = true;
      console.error(error);
      showNotice('The picture hit an error and may lag behind the round. The round and the buttons still work.', 0);
    }
  }
}

// ---- Live play: the platform frame or the local emulator --------------------------------------------------

let state: RoomState | null = null;
let direct: GameClient | null = null;
let embedded: EmbeddedGame | null = null;
/** The last authoritative running time and when it arrived: the number extrapolates from it, briefly. */
let anchor: { elapsed: number; at: number } | null = null;
let lastFrameAt = 0;
let rallyBettors = 0;
let joinPendingAt = 0;
let cashPendingAt = 0;
/** The round the room confirmed this player's cash-out in, before its 'you' frame catches up. */
let cashedRound: string | null = null;
let canJoin = false;
let canCash = false;
let stale = false;

/** Space plays the live action (Cash out while running, Join during betting) unless another control has focus. */
const ownsSpace = (target: EventTarget | null) => target === document.body || target === root || target === shell || target === canvas || target === bet || target === cashout;

function onRoom(next: RoomState, message: ServerMessage | null): void {
  const before = state;
  state = next;
  const now = performance.now();
  lastFrameAt = now;
  if (message?.type === 'error') {
    joinPendingAt = cashPendingAt = 0;
    showNotice(ROOM_ERRORS[message.code] ?? 'The room refused that.');
  }
  if (message?.type === 'bet.result') {
    joinPendingAt = 0;
    if (message.status === 'queued') showNotice('This round is full, so your bet waits for the next one.');
  }
  if (message?.type === 'cashout' && message.mine) {
    // The guard holds until the 'you' frame shows the cash-out too, so a second press in between sends nothing.
    view.payout = message.payout;
    cashedRound = `${next.room?.chainId ?? 0}:${message.roundIndex}`;
  }
  if (message?.type === 'you') {
    if (message.you.bet) joinPendingAt = 0;
    if (message.you.bet?.cashoutX100 != null) cashPendingAt = 0;
  }
  if (next.integrity.length > 0 && next.integrity.length !== (before?.integrity.length ?? 0)) {
    showNotice(`Betting is off: this page caught the room misbehaving (${next.integrity[0]}).`, 0);
  }
  const round = next.round;
  if (round) {
    const key = round.roundIndex !== null ? `${next.room?.chainId ?? 0}:${round.roundIndex}` : roundKey;
    const newRound = key !== roundKey;
    roundKey = key;
    // Only a bet in this round is at stake here: a queued one waits for the next round.
    const yours = next.you?.bet?.status === 'active' ? next.you.bet : null;
    // A reconnect can land in a later round without its betting phase: nothing of the last round carries over.
    if (newRound && !yours) view.stake = view.cashoutX100 = view.payout = null;
    // The guard lasts one round, and a connection's snapshot (a reconnect, even into the same round after the local
    // emulator restarts its chain) says afresh whether the bet has cashed out.
    if (newRound || message?.type === 'state') cashedRound = null;
    if (round.phase !== view.phase) joinPendingAt = cashPendingAt = 0;
    if (round.phase === 'crashed' && (view.phase !== 'crashed' || newRound)) crashTime = crashMoment(next, message);
    view.phase = round.phase;
    view.currentX100 = round.crashX100 ?? round.multiplierX100;
    if (round.phase === 'crashed' && round.crashX100 !== null && Number.isInteger(round.crashX100) && round.crashX100 >= 100 && free.validCurve(next.room?.curve)) {
      view.elapsed = free.msToReach(round.crashX100, next.room!.curve);
    }
    // The running time only moves forward within a round, and starts each round from zero (Blanket Champ shows it).
    if ((newRound && round.phase !== 'crashed') || round.phase === 'betting' || round.phase === 'waiting') view.elapsed = 0;
    if (round.phase === 'running' && round.runningSince !== null) {
      rallyBettors = round.rally.active ? round.rally.bettors : 0;
      if (message?.type === 'tick' && message.roundIndex === round.roundIndex) anchor = { elapsed: message.elapsedMs, at: now };
      else if (!anchor || message?.type === 'round.locked' || message?.type === 'state') anchor = { elapsed: Math.max(0, Date.now() + next.clockOffsetMs - round.runningSince), at: now };
    } else anchor = null;
    // The server settles and clears a bet before it announces the crash, so a round keeps the last bet it saw.
    if (yours) {
      view.stake = yours.stake;
      view.cashoutX100 = yours.cashoutX100;
    } else if (round.phase === 'betting' || round.phase === 'waiting' || next.you?.bet?.status === 'queued') {
      view.stake = view.cashoutX100 = view.payout = null;
    }
  }
  refresh(now);
}

/** When the round crashed: now for a live crash frame; for a snapshot that opens on a crashed round, when it happened. */
function crashMoment(next: RoomState, message: ServerMessage | null): number {
  const round = next.round!;
  const x = round.crashX100;
  if (message?.type === 'round.crashed' || round.runningSince === null || x === null || !Number.isInteger(x) || x < 100 || !free.validCurve(next.room?.curve)) return Date.now();
  return Math.min(Date.now(), round.runningSince + free.msToReach(x, next.room!.curve) - next.clockOffsetMs);
}

function endedText(you: YouState): string {
  if (you.endReason === 'credits_used') return 'Out of credits · reload for a fresh session';
  if (you.endReason === 'rounds_used') return 'No rounds left in this session · reload for a fresh one';
  if (you.endReason === 'expired') return 'This session expired · reload for a fresh one';
  return 'This session is over · reload for a fresh one';
}

function liveStatus(): string {
  const round = state?.round ?? null;
  const you = state?.you ?? null;
  const yourBet = you?.bet ?? null;
  if (!state || !round) return direct ? 'Connecting to the local emulator…' : 'Connecting…';
  if (direct && !direct.connected) return 'Connection lost · reconnecting…';
  if (stale) return 'Connection lost · the round may already have ended';
  const queued = yourBet?.status === 'queued';
  if (state.integrity.length > 0) return canCash ? 'Betting is off on this page · you can still cash out' : 'Betting is off on this page';
  switch (round.phase) {
    case 'waiting':
      return queued ? 'Waiting for the next round · your bet is queued for it' : 'Waiting for the next round';
    case 'betting':
      if (yourBet?.status === 'active') return `You’re in · ${credits(yourBet.stake)}`;
      if (queued) return 'This round is full · your bet waits for the next one';
      if (embedded?.betsBlockedBecause) return `Betting is paused · ${embedded.betsBlockedBecause}`;
      if (direct && !you) return 'Watching · the emulator gave this page no session';
      if (direct && you?.ended) return endedText(you);
      if (direct && you && you.creditsLeft < STAKE) return `Not enough credits to join · ${credits(you.creditsLeft)} left`;
      return 'Place your bets';
    case 'running':
      if (view.cashoutX100 !== null) return `Cashed out at ${formatX(view.cashoutX100)}${view.payout !== null ? ` · ${credits(view.payout)}` : ''}`;
      if (view.stake !== null) return 'Round running · cash out before it crashes';
      return queued ? 'Round running · your bet waits for the next one' : 'Round running';
    case 'crashed': {
      const crashed = `Crashed at ${formatX(round.crashX100 ?? view.currentX100)}`;
      if (view.cashoutX100 !== null) return `${crashed} · you cashed out at ${formatX(view.cashoutX100)}${view.payout !== null ? ` for ${credits(view.payout)}` : ''}`;
      if (view.stake !== null) return `${crashed} · you lost ${credits(view.stake)}`;
      return crashed;
    }
  }
}

function liveReadout(): string {
  const round = state?.round ?? null;
  if (!state || !round) return '';
  const parts: string[] = [];
  if (round.phase === 'betting' && round.bettingClosesAt !== null) {
    parts.push(`Closes in ${Math.max(0, Math.ceil((round.bettingClosesAt - (Date.now() + state.clockOffsetMs)) / 1000))} s`);
  }
  if (canCash && view.stake !== null && Number.isSafeInteger(view.stake) && free.validCurve(state.room?.curve)) {
    // Priced on the published (floored) curve: the room pays at least this if the cash-out lands before the crash.
    const x = free.multiplierAtX100(view.elapsed, state.room!.curve);
    parts.push(`Worth ${credits(free.payout(view.stake, x, x, rallyBettors))} now`);
  }
  // Standalone shows the balance; embedded, the host's credit bank does.
  if (direct && state.you) parts.push(`${credits(state.you.creditsLeft)} left`);
  // Only while Space would act: this page has focus (embedded, once the player has clicked into the frame) and no
  // other control, such as a game's own toggle, would take the key.
  if (keyboardHints.matches && document.hasFocus() && ownsSpace(document.activeElement)) {
    if (canCash) parts.push('Space to cash out');
    else if (canJoin) parts.push('Space to join');
  }
  return parts.join(' · ');
}

/** Recomputes the controls and the copy; cheap, and called on every server frame and every drawn frame. */
function refresh(now: number): void {
  if (joinPendingAt && now - joinPendingAt > PENDING_MS) joinPendingAt = 0;
  if (cashPendingAt && now - cashPendingAt > PENDING_MS) cashPendingAt = 0;
  const round = state?.round ?? null;
  const you = state?.you ?? null;
  const linkUp = direct ? direct.connected : state !== null;
  stale = round?.phase === 'running' && (!linkUp || now - lastFrameAt > STALE_MS);
  canJoin = !!direct && direct.canBet && !!you && !you.bet && you.creditsLeft >= STAKE && !joinPendingAt;
  canCash = !stale && round?.phase === 'running' && you?.bet?.status === 'active' && you.bet.cashoutX100 === null && !cashPendingAt && cashedRound !== roundKey;
  offer(bet, canJoin);
  offer(cashout, canCash);
  write(statusLine, liveStatus());
  write(readout, liveReadout());
  // Keep keyboard play on the button that is live now, but never pull focus into the frame from the host page.
  if (document.hasFocus()) {
    const focused = document.activeElement;
    if (canCash && focused === bet) cashout.focus({ preventScroll: true });
    else if (canJoin && focused === cashout) bet.focus({ preventScroll: true });
  }
}

bet.onclick = () => {
  if (!canJoin || !direct) return;
  joinPendingAt = performance.now();
  direct.bet(STAKE, null);
  refresh(joinPendingAt);
};

cashout.onclick = () => {
  const client = direct ?? embedded;
  if (!canCash || !client) return;
  cashPendingAt = performance.now();
  client.cashout();
  refresh(cashPendingAt);
};

document.addEventListener('keydown', (event) => {
  if (mode === 'replay' || event.code !== 'Space' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !ownsSpace(event.target)) return;
  event.preventDefault();
  if (!event.repeat) (canCash ? cashout : canJoin ? bet : null)?.click();
});
// A focused button would click again on keyup; the keydown above already acted.
document.addEventListener('keyup', (event) => {
  if (mode !== 'replay' && event.code === 'Space' && (event.target === bet || event.target === cashout)) event.preventDefault();
});

function connectFrame(): void {
  const game = connectEmbedded();
  embedded = game;
  bet.hidden = true;
  game.on('change', onRoom);
  game.on('allow', () => refresh(performance.now()));
  game.on('refused', (_intent, reason) => {
    joinPendingAt = cashPendingAt = 0;
    showNotice(sentence(reason));
    refresh(performance.now());
  });
  // The host sizes the frame from this: the picture plus the controls, at whatever width the frame has.
  new ResizeObserver(() => game.resize(Math.ceil(shell.getBoundingClientRect().height))).observe(shell);
  close = () => game.close();
}

function connectEmulator(): void {
  const client = new GameClient({ baseUrl: EMULATOR.replace(/^http/, 'ws') });
  direct = client;
  client.on('change', onRoom);
  const unreachable = 'Could not start a session on the local emulator. Run npm run dev; the page retries on its own.';
  client.connect('emulator-game', async () => {
    try {
      const response = await fetch(`${EMULATOR}/dev/sessions`, { method: 'POST' });
      if (!response.ok) throw new Error(`the emulator answered ${response.status}`);
      const session = (await response.json()) as { token?: unknown };
      dropNotice(unreachable);
      return typeof session.token === 'string' ? session.token : null;
    } catch (error) {
      showNotice(unreachable, 0);
      throw error;
    }
  });
  close = () => client.close();
}

// ---- Replay: the recorded round, driven by the frame clock --------------------------------------------------

function playRecording(): void {
  bet.hidden = cashout.hidden = true;
  const recording: ReplayRound = replay;
  const curve = replayCurve(recording);
  const check = verifyReplay(recording);
  if (!check.ok || !curve) {
    console.error('The recorded round failed its check:', check.problems.join('; '));
    write(statusLine, 'The recorded round failed its check, so it is not shown');
    return;
  }
  restart.hidden = false;
  // Both labels sit in the button, one hidden, so it keeps the wider one's width and the row never rewraps.
  const labels = { restart: document.createElement('span'), again: document.createElement('span') };
  labels.restart.textContent = 'Restart replay';
  labels.again.textContent = 'Watch again';
  restart.replaceChildren(labels.restart, labels.again);
  const label = (which: 'restart' | 'again') => {
    labels.restart.setAttribute('aria-hidden', String(which !== 'restart'));
    labels.again.setAttribute('aria-hidden', String(which !== 'again'));
  };
  label('restart');
  const player = new ReplayPlayer(replay, { bettingMs: REPLAY_BETTING_MS });
  let startedAt: number | null = null;
  let lastStepAt = 0;
  let lockedAt = 0;
  let crashedAt: number | null = null;
  let plays = 0;
  player.on((event, at) => {
    if (event.type === 'round.betting') {
      view.phase = 'betting';
      view.currentX100 = 100;
      view.elapsed = 0;
      crashedAt = null;
      roundKey = `replay:${++plays}`;
      write(statusLine, 'Recorded round · betting');
      label('restart');
    } else if (event.type === 'round.locked') {
      view.phase = 'running';
      lockedAt = at;
      write(statusLine, 'Recorded round · running');
    } else if (event.type === 'tick') {
      view.currentX100 = Math.max(view.currentX100, event.multiplierX100);
    } else if (event.type === 'round.crashed') {
      view.phase = 'crashed';
      view.currentX100 = event.result.crashX100;
      view.elapsed = Math.max(0, at - lockedAt);
      crashedAt = at;
      write(statusLine, `Recorded round · crashed at ${formatX(event.result.crashX100)}`);
    }
  });
  player.onEnd(() => label('again'));
  restart.onclick = () => {
    player.reset();
    startedAt = null;
  };
  // Each frame plays every event that is due by the clock, so slow frames never make the recording drift. The
  // clock starts with the first drawn frame and stands still while none are drawn (a hidden tab, a preview
  // scrolled out of view), so a visitor never comes back to a round that ended unseen.
  stepReplay = () => {
    const wall = Date.now();
    if (startedAt === null) startedAt = wall;
    else if (wall - lastStepAt > FRAME_GAP_MS) startedAt += wall - lastStepAt;
    lastStepAt = wall;
    const t = wall - startedAt;
    if (!player.finished) player.seek(t);
    if (view.phase === 'running') {
      view.elapsed = Math.max(0, t - lockedAt);
      view.currentX100 = Math.max(view.currentX100, Math.min(replay.crashX100, free.multiplierAtContinuousX100(view.elapsed, curve)));
    }
    crashTime = crashedAt === null ? wall : startedAt + crashedAt;
  };
}

// ---- The frame loop ----------------------------------------------------------------------------------------

function draw(now: number): void {
  // Re-armed first, so nothing below can stop the loop.
  frame = requestAnimationFrame(draw);
  expireNotice(performance.now());
  const width = canvas.clientWidth;
  if (width < 1) return; // collapsed or not laid out: nothing to draw into
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(width * dpr);
  const h = Math.round(((width * 540) / 960) * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const clock = performance.now();
  if (mode === 'replay') stepReplay?.();
  else {
    if (view.phase === 'running' && anchor && free.validCurve(state?.room?.curve)) {
      // Never backwards: a tick delivered later than the one before would otherwise pull the number back.
      view.elapsed = Math.max(view.elapsed, anchor.elapsed + Math.min(MAX_AHEAD_MS, clock - anchor.at));
      view.currentX100 = Math.max(view.currentX100, free.multiplierAtContinuousX100(view.elapsed, state!.room!.curve));
    }
    refresh(clock);
  }
  view.crashAge = Math.max(0, Date.now() - crashTime);
  drawScene(now);
}

bet.disabled = cashout.disabled = false;
if (mode === 'replay') playRecording();
else {
  if (mode === 'embedded') connectFrame();
  else connectEmulator();
  refresh(performance.now());
}
// Opened on its own or in a fixed-size preview frame, the picture leaves room for the controls as they really
// are (they wrap on narrow screens); embedded, the frame grows to fit instead. At one width the band only ever
// grows, so copy that wraps in one phase and not the next moves neither the picture nor the buttons (the CSS
// holds the band at --bar with its rows at the foot). The height that counts is the rows' own, measured from
// the controls in them, after the mode above has shown or hidden its buttons. The controls' width never
// depends on the picture, so this cannot loop.
const controls = document.querySelector<HTMLElement>('.controls');
if (mode !== 'embedded' && controls) {
  let bar = 0;
  let barWidth = 0;
  let measuring = 0;
  const measure = () => {
    const box = controls.getBoundingClientRect();
    const rows = [...controls.children].filter((el) => el !== notice && el.getClientRects().length > 0).map((el) => el.getBoundingClientRect());
    if (!rows.length) return;
    const pad = parseFloat(getComputedStyle(controls).paddingTop) + parseFloat(getComputedStyle(controls).paddingBottom);
    const height = Math.ceil(Math.max(...rows.map((r) => r.bottom)) - Math.min(...rows.map((r) => r.top)) + pad);
    bar = box.width === barWidth ? Math.max(bar, height) : height;
    barWidth = box.width;
    root.style.setProperty('--bar', `${bar}px`);
  };
  // Measured on the next frame: setting --bar resizes the observed band, which must not happen while the observer delivers.
  new ResizeObserver(() => {
    cancelAnimationFrame(measuring);
    measuring = requestAnimationFrame(measure);
  }).observe(controls);
  measure(); // once now, outside any delivery, so the first paint already uses the real height
}
frame = requestAnimationFrame(draw);
window.addEventListener('pagehide', () => {
  cancelAnimationFrame(frame);
  close();
  disposeScene();
});
// A page restored from the back/forward cache comes back with its connection closed and its scene disposed.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) location.reload();
});
