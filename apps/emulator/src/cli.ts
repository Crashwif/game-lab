#!/usr/bin/env node
/**
 * crashwif-emulator: a local game server for building and testing games.
 *
 *   crashwif-emulator [--port 4500] [--scenario basic|fixed|edge|stress] [--seed <hex>] [--salt <text>]
 *                     [--betting-ms 5000] [--round-delay-ms 2000] [--time-scale 1] [--bots 0]
 *                     [--credits 1000] [--game emulator-game] [--serve <dir>] [--quiet]
 *
 * Then point the SDK (or VITE_GAME_SERVER_URL) at ws://127.0.0.1:4500, mint a
 * session with POST /dev/sessions (its token is offered as a subprotocol, as the
 * SDK does), and read the upcoming crash points from GET /dev/upcoming to write
 * assertions.
 */
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { roomSocketProtocols, roomSocketUrl } from '@crashwif/game-sdk/state';

import { GAME_ID } from './engine.js';
import { SCENARIOS, type Scenario } from './scenarios.js';
import { EmulatorServer } from './server.js';

export function parseArgs(argv: string[]): { port: number; scenario: Scenario; serveDir: string | null; quiet: boolean; config: Record<string, unknown> } {
  const out = { port: 4500, scenario: 'basic' as Scenario, serveDir: null as string | null, quiet: false, config: {} as Record<string, unknown> };
  const int = (name: string, value: string | undefined) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} needs a positive number`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]!;
    const value = argv[i + 1];
    switch (flag) {
      case '--port':
        out.port = int(flag, value);
        i++;
        break;
      case '--scenario':
        if (!(SCENARIOS as readonly string[]).includes(value ?? '')) throw new Error(`--scenario is one of ${SCENARIOS.join(', ')}`);
        out.scenario = value as Scenario;
        i++;
        break;
      case '--seed':
        if (!/^[0-9a-f]{64}$/i.test(value ?? '')) throw new Error('--seed is 64 hex characters');
        out.config.topSeed = value!.toLowerCase();
        i++;
        break;
      case '--salt':
        if (!value) throw new Error('--salt needs a value');
        out.config.salt = value;
        i++;
        break;
      case '--betting-ms':
        out.config.bettingMs = int(flag, value);
        i++;
        break;
      case '--round-delay-ms':
        out.config.roundDelayMs = int(flag, value);
        i++;
        break;
      case '--time-scale':
        out.config.timeScale = int(flag, value);
        i++;
        break;
      case '--bots':
        out.config.bots = Number(value ?? 0) || 0;
        i++;
        break;
      case '--credits':
        out.config.startingCredits = int(flag, value);
        i++;
        break;
      case '--game':
        if (!GAME_ID.test(value ?? '')) throw new Error('--game is a short lowercase id (letters, digits and hyphens)');
        out.config.gameId = value;
        i++;
        break;
      case '--serve':
        if (!value) throw new Error('--serve needs a directory');
        out.serveDir = value;
        i++;
        break;
      case '--quiet':
        out.quiet = true;
        break;
      case '--help':
      case '-h':
        throw new Error('usage: crashwif-emulator [--port N] [--scenario basic|fixed|edge|stress] [--seed hex] [--salt text] [--betting-ms N] [--round-delay-ms N] [--time-scale N] [--bots N] [--credits N] [--game id] [--serve dir] [--quiet]');
      default:
        throw new Error(`unknown option ${flag}`);
    }
  }
  return out;
}

export async function main(argv: string[]): Promise<EmulatorServer> {
  const args = parseArgs(argv);
  const server = new EmulatorServer({ port: args.port, scenario: args.scenario, config: args.config, serveDir: args.serveDir, log: args.quiet ? () => {} : (line) => console.log(line) });
  await server.listen();
  if (!args.quiet) {
    console.log(`room ${server.room.cfg.gameId}: chain ${server.room.info().terminalHash.slice(0, 16)}… salt ${(server.room.info().salt ?? '(pending)').slice(0, 16)}…`);
    console.log(`next crash points: ${server.room.upcoming(8).map((u) => (u.crashX100 / 100).toFixed(2)).join(', ')}`);
    console.log(`sessions: POST http://127.0.0.1:${server.port}/dev/sessions   socket: ${roomSocketUrl(`ws://127.0.0.1:${server.port}`, server.room.cfg.gameId)}   subprotocols: ${roomSocketProtocols('<session>').join(', ')}`);
  }
  return server;
}

function isEntryPoint(): boolean {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2)).then(
    (server) => {
      const stop = () => void server.close().then(() => process.exit(0));
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
    },
    (error: unknown) => {
      console.error((error as Error).message);
      process.exit(1);
    },
  );
}
