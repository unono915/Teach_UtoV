/** 개발용 실행: docs/app 을 http 로 띄운다. */
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';

const ROOT = fileURLToPath(new URL('../docs/app', import.meta.url));
const PORT = Number(process.env.PORT) || 4173;

const { url } = await startStaticServer({ root: ROOT, port: PORT, host: '127.0.0.1' });

console.log(`Teach_UtoV → ${url}`);
console.log('종료하려면 Ctrl+C 를 누르세요.');
