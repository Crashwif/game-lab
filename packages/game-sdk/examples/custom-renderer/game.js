/*
 * The smallest custom renderer: no build step, no SDK import (the sandbox
 * allows only the bundle's own files), just the embed protocol over
 * postMessage. With a bundler, `connectEmbedded()` from
 * @crashwif/game-sdk/embed does all of this and folds frames through the
 * shared reducer; this file shows what goes over the wire.
 *
 * The host (the platform page, or the emulator's page) sends:
 *   { proto, type: 'init', manifest, state, allowBets }
 *   { proto, type: 'server', message, now, fresh }   every server frame
 *   { proto, type: 'allow', allowBets, reason }
 *   { proto, type: 'refused', message, reason }
 *   { proto, type: 'ping', at }                     every few seconds once the game is ready
 * and hears:
 *   { proto, type: 'ready', pongs: true }           declares that it answers pings
 *   { proto, type: 'client', message: { type: 'bet', stake, targetX100 } | { type: 'cancel' } | { type: 'cashout' } }
 *   { proto, type: 'resize', height }
 *   { proto, type: 'pong', at }                     the answer to a ping; a game that declared pongs or has
 *                                                   answered a ping is stopped after three unanswered in a row
 */
const PROTO = 'crashwif-game-embed:v1';
const host = window.parent;
const el = (id) => document.getElementById(id);
let allowed = false;
let phase = 'waiting';
let you = null;
let multiplierX100 = 100;

function send(message) {
  host.postMessage({ proto: PROTO, ...message }, '*');
}
function log(line) {
  el('log').textContent = line;
}
function render() {
  el('bet').disabled = !(allowed && phase === 'betting' && you && !you.ended && !you.bet);
  el('cashout').disabled = !(phase === 'running' && you?.bet?.status === 'active' && you.bet.cashoutX100 === null);
  el('you').textContent = you ? `${you.creditsLeft} credits · ${you.roundsLeft} rounds left${you.bet ? ` · bet ${you.bet.stake}${you.bet.targetX100 === null ? ' with manual exit' : `, auto at ${(you.bet.targetX100 / 100).toFixed(2)}x`}` : ''}` : 'spectating';
}

function onServer(message) {
  switch (message.type) {
    case 'state':
      phase = message.round.phase;
      you = message.you;
      multiplierX100 = message.round.multiplierX100;
      el('multiplier').textContent = `${(message.round.multiplierX100 / 100).toFixed(2)}x`;
      el('phase').textContent = phase;
      break;
    case 'round.betting':
      phase = 'betting';
      multiplierX100 = 100;
      el('multiplier').className = '';
      el('multiplier').textContent = '1.00x';
      el('phase').textContent = `round ${message.roundIndex}: place your bets`;
      break;
    case 'round.locked':
      phase = 'running';
      el('phase').textContent = `round ${message.roundIndex}: running (${message.admitted} bettors)`;
      break;
    case 'tick':
      multiplierX100 = message.multiplierX100;
      el('multiplier').textContent = `${(message.multiplierX100 / 100).toFixed(2)}x`;
      break;
    case 'cashout':
      if (message.mine) log(`cashed out at ${(message.targetX100 / 100).toFixed(2)}x for ${message.payout}`);
      break;
    case 'round.crashed':
      phase = 'crashed';
      el('multiplier').className = 'crashed';
      el('multiplier').textContent = `${(message.result.crashX100 / 100).toFixed(2)}x`;
      el('phase').textContent = `crashed · seed ${message.result.serverSeed.slice(0, 12)}…`;
      break;
    case 'you':
      you = message.you;
      break;
    case 'error':
      log(`error: ${message.code}`);
      break;
  }
  render();
}

window.addEventListener('message', (event) => {
  if (event.source !== host) return; // only the window that framed us
  const data = event.data;
  if (!data || data.proto !== PROTO) return;
  if (data.type === 'init') {
    allowed = data.allowBets;
    if (data.state.round) onServer({ type: 'state', room: data.state.room, round: data.state.round, recent: data.state.recent, you: data.state.you });
    log(`playing "${data.manifest && data.manifest.name}"`);
  } else if (data.type === 'server') onServer(data.message);
  else if (data.type === 'allow') {
    allowed = data.allowBets;
    log(allowed ? 'betting allowed' : `betting off: ${data.reason}`);
  } else if (data.type === 'refused') log(`refused: ${data.reason}`);
  else if (data.type === 'ping') send({ type: 'pong', at: data.at });
  render();
});

el('bet').addEventListener('click', () => send({ type: 'client', message: { type: 'bet', stake: 50, targetX100: el('auto').checked ? 200 : null } }));
el('cashout').addEventListener('click', () => send({ type: 'client', message: { type: 'cashout' } }));
send({ type: 'ready', pongs: true });
// The room's frame never scrolls: report the page's height at once and whenever it changes.
new ResizeObserver(() => send({ type: 'resize', height: document.body.scrollHeight })).observe(document.body);
