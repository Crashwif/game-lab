import { fileURLToPath } from 'node:url';
import { EmulatorServer } from '../apps/emulator/dist/index.js';
import { GAMES } from './games.mjs';
const server = new EmulatorServer({ port: 4500, serveDir: fileURLToPath(new URL('../dist/', import.meta.url)), scenario: 'edge' });
await server.listen();
for (const game of GAMES) {
  console.log(`${game}: http://127.0.0.1:4500/bundle/${game}/index.html`);
  console.log(`${game} recorded preview: http://127.0.0.1:4500/bundle/${game}/index.html?mode=replay`);
}
// close() waits for every client to leave, so a second signal stops at once and a stuck client gets 2 s.
let closing = false;
const stop = () => {
  if (closing) process.exit(130);
  closing = true;
  setTimeout(() => process.exit(1), 2000).unref();
  server.close().then(() => process.exit(0), () => process.exit(1));
};
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
