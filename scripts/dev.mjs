import { EmulatorServer } from '../apps/emulator/dist/index.js';
const server = new EmulatorServer({ port: 4500, serveDir: 'dist', scenario: 'edge' });
await server.listen();
console.log('Balloon Pump: http://127.0.0.1:4500/bundle/balloon-pump/index.html');
console.log('Recorded preview: http://127.0.0.1:4500/bundle/balloon-pump/index.html?mode=replay');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await server.close(); process.exit(0); });
