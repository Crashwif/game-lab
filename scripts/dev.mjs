import { EmulatorServer } from '../apps/emulator/dist/index.js';
const server = new EmulatorServer({ port: 4500, serveDir: 'dist', scenario: 'edge' });
await server.listen();
for (const game of ['balloon-pump', 'tower-tension', 'boiler-room', 'thin-ice', 'king-of-the-hill', 'exit-liquidity']) {
  console.log(`${game}: http://127.0.0.1:4500/bundle/${game}/index.html`);
  console.log(`${game} recorded preview: http://127.0.0.1:4500/bundle/${game}/index.html?mode=replay`);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
