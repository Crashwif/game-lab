/**
 * The emulator's front: the game server's WebSocket protocol on /ws (the
 * session token offered as a subprotocol, as on the real server), its
 * public HTTP surface (room, chains, paged rounds) in the game server's shapes
 * so crash-math's verifyRoomChain and the SDK's verifiers work, and
 * dev-only endpoints no real server has (free sessions, pause, bots, the
 * upcoming crash points). It can also serve a directory, so a creator's bundle
 * is previewed from the same origin. Everything is local: CORS is open.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

import type { ClientMessage, ServerMessage } from '@crashwif/game-sdk/protocol';
import { ROOM_PROTOCOL, roomSocketProtocols, roomSocketUrl, roomTokenFromProtocols } from '@crashwif/game-sdk/state';
import { WebSocketServer, type WebSocket } from 'ws';

import { EmulatorRoom, type EmulatorConfig } from './engine.js';
import { scenarioConfig, type Scenario } from './scenarios.js';

export interface EmulatorServerOptions {
  port?: number;
  host?: string;
  scenario?: Scenario;
  config?: Partial<EmulatorConfig>;
  /** A directory to serve at /bundle/ (a game under development). */
  serveDir?: string | null;
  log?: (line: string) => void;
}

const MAX_INT4 = 2_147_483_647;
/** A chain id or round index as the game server accepts one: digits within a Postgres integer. */
const int4 = (value: string | undefined) => (value !== undefined && /^\d{1,10}$/.test(value) && Number(value) <= MAX_INT4 ? Number(value) : null);

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };

export class EmulatorServer {
  readonly room: EmulatorRoom;
  private readonly http: Server;
  private readonly wss: WebSocketServer;
  private readonly sockets = new Map<WebSocket, string | null>();
  private readonly log: (line: string) => void;
  readonly scenario: Scenario;

  constructor(private readonly options: EmulatorServerOptions = {}) {
    this.scenario = options.scenario ?? 'basic';
    this.log = options.log ?? (() => {});
    this.room = new EmulatorRoom(scenarioConfig(this.scenario, options.config ?? {}), (sessionId, message) => this.send(sessionId, message));
    this.http = createServer((req, res) => void this.handle(req, res));
    // The room protocol is echoed to whoever offers it (a browser drops the socket otherwise); a token entry never is.
    this.wss = new WebSocketServer({ noServer: true, handleProtocols: (protocols) => (protocols.has(ROOM_PROTOCOL) ? ROOM_PROTOCOL : false) });
    this.http.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== '/ws' || url.searchParams.get('game') !== this.room.cfg.gameId) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }
      const token = roomTokenFromProtocols(req.headers['sec-websocket-protocol']);
      const sessionId = token && this.room.sessions.has(token) ? token : null;
      this.wss.handleUpgrade(req, socket, head, (ws) => this.connected(ws, sessionId));
    });
  }

  get port(): number {
    const address = this.http.address();
    return typeof address === 'object' && address ? address.port : 0;
  }

  listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.http.once('error', reject);
      this.http.listen(this.options.port ?? 4500, this.options.host ?? '127.0.0.1', () => {
        this.room.start();
        this.log(`emulator listening on http://${this.options.host ?? '127.0.0.1'}:${this.port} (scenario ${this.scenario}, game ${this.room.cfg.gameId})`);
        resolve(this.port);
      });
    });
  }

  async close(): Promise<void> {
    this.room.stop();
    for (const ws of this.sockets.keys()) ws.close(1001, 'emulator stopping');
    this.wss.close();
    await new Promise<void>((resolve) => this.http.close(() => resolve()));
  }

  private send(sessionId: string | null, message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const [ws, owner] of this.sockets) {
      if (sessionId !== null && owner !== sessionId) continue;
      if (ws.readyState === ws.OPEN) ws.send(data);
    }
  }

  private connected(ws: WebSocket, sessionId: string | null): void {
    this.sockets.set(ws, sessionId);
    ws.send(JSON.stringify(this.room.snapshot(sessionId)));
    ws.on('message', (raw) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        ws.send(JSON.stringify({ type: 'error', code: 'bad_message' } satisfies ServerMessage));
        return;
      }
      if (message.type === 'ping') ws.send(JSON.stringify({ type: 'pong', serverTime: Date.now() } satisfies ServerMessage));
      else if (message.type === 'bet') {
        if (!sessionId) ws.send(JSON.stringify({ type: 'error', code: 'no_session' } satisfies ServerMessage));
        else ws.send(JSON.stringify(this.room.bet(sessionId, message.stake, message.targetX100)));
      } else if (message.type === 'cancel') {
        const reply = sessionId ? this.room.cancel(sessionId) : ({ type: 'error', code: 'no_session' } satisfies ServerMessage);
        if (reply) ws.send(JSON.stringify(reply));
      } else if (message.type === 'cashout') {
        const reply = sessionId ? this.room.cashout(sessionId) : ({ type: 'error', code: 'no_session' } satisfies ServerMessage);
        if (reply) ws.send(JSON.stringify(reply));
      } else ws.send(JSON.stringify({ type: 'error', code: 'bad_message' } satisfies ServerMessage));
    });
    ws.on('close', () => this.sockets.delete(ws));
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' });
    res.end(JSON.stringify(body));
  }

  private async body(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    if (!text) return {};
    try {
      const parsed = JSON.parse(text) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    if (req.method === 'OPTIONS') return this.json(res, 204, {});
    if (url.pathname === '/health') return this.json(res, 200, { ok: true, emulator: true, scenario: this.scenario, rooms: 1, sessions: this.room.sessions.size });
    if (parts[0] === 'rooms' && parts[1] === this.room.cfg.gameId) {
      if (parts.length === 2) return this.json(res, 200, { room: this.room.info(), round: this.room.publicRound(), recent: this.room.recent() });
      if (parts[2] === 'chains' && parts.length === 3) return this.json(res, 200, { chains: this.room.chains() });
      // The game server's paging: up to `limit` settled rounds from `from`, and `next` after a full page.
      if (parts[2] === 'chains' && parts[4] === 'rounds' && parts.length === 5 && int4(parts[3]) !== null) {
        const chain = this.room.chains(int4(parts[3])!)[0];
        if (!chain) return this.json(res, 404, { error: 'chain_not_found' });
        const from = int4(url.searchParams.get('from') ?? '0') ?? 0;
        const limit = Math.min(1_000, Math.max(1, Number(url.searchParams.get('limit') ?? 1_000) || 1_000));
        const rounds = this.room.rounds(chain.chainId, from, limit);
        return this.json(res, 200, { chain, rounds, next: rounds.length === limit ? rounds[rounds.length - 1]!.roundIndex + 1 : null });
      }
    }
    if (parts[0] === 'dev') {
      if (req.method === 'POST' && parts[1] === 'sessions') {
        const b = await this.body(req);
        const session = this.room.createSession(false, typeof b.handle === 'string' ? b.handle : null);
        if (Number.isSafeInteger(b.credits) && (b.credits as number) > 0) session.creditsLeft = b.credits as number;
        return this.json(res, 201, {
          sessionId: session.sessionId,
          handle: session.handle,
          token: session.sessionId,
          credits: session.creditsLeft,
          rounds: session.roundsLeft,
          expiresAt: session.expiresAt,
          socketUrl: roomSocketUrl(`ws://127.0.0.1:${this.port}`, this.room.cfg.gameId),
          protocols: roomSocketProtocols(session.sessionId),
        });
      }
      if (req.method === 'GET' && parts[1] === 'upcoming') return this.json(res, 200, { upcoming: this.room.upcoming(Math.min(100, Number(url.searchParams.get('n') ?? 10) || 10)) });
      if (req.method === 'POST' && parts[1] === 'control') {
        if (parts[2] === 'pause') {
          this.room.pause();
          return this.json(res, 200, { paused: true });
        }
        if (parts[2] === 'resume') {
          this.room.resume();
          return this.json(res, 200, { paused: false });
        }
        if (parts[2] === 'bots') {
          const b = await this.body(req);
          const count = Math.min(1_000, Math.max(0, Number(b.count ?? 5) || 0));
          for (let i = 0; i < count; i++) this.room.createSession(true);
          return this.json(res, 200, { botsAdded: count, sessions: this.room.sessions.size });
        }
      }
    }
    if (parts[0] === 'bundle' && this.options.serveDir) return this.serveFile(parts.slice(1).join('/'), res);
    this.json(res, 404, { error: 'not found' });
  }

  private serveFile(relative: string, res: ServerResponse): void {
    const root = resolve(this.options.serveDir!);
    const target = normalize(join(root, relative || 'index.html'));
    if (!target.startsWith(root) || !existsSync(target) || !statSync(target).isFile()) return this.json(res, 404, { error: 'not found' });
    res.writeHead(200, { 'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    createReadStream(target).pipe(res);
  }
}
