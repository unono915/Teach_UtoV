/** 소개 페이지 미리보기: docs 전체를 http 로 띄운다. GitHub Pages 와 같은 구조가 된다. */
import { fileURLToPath } from 'node:url';
import { startStaticServer } from './static-server.mjs';

const ROOT = fileURLToPath(new URL('../docs', import.meta.url));
const PORT = Number(process.env.PORT) || 4174;

const { url } = await startStaticServer({ root: ROOT, port: PORT, host: '127.0.0.1' });

console.log(`소개 페이지 → ${url}`);
console.log(`웹앱        → ${url}app/`);
console.log('종료하려면 Ctrl+C 를 누르세요.');
