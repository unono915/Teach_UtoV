/**
 * 의존성 없는 정적 파일 서버.
 *
 * 유튜브 IFrame Player API 는 file:// 에서 동작하지 않기 때문에,
 * 로컬 개발이든 Electron 안이든 http 로 띄워서 쓴다.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

/** 루트 밖으로 벗어나는 경로를 막는다. */
function resolvePath(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = normalize(decoded)
    .replace(/^(\.\.[/\\])+/, '')
    .replace(/^[/\\]+/, '');
  const full = join(root, relative || 'index.html');
  const fence = root.endsWith(sep) ? root : root + sep;
  if (full !== root && !full.startsWith(fence)) return null;
  return full;
}

/**
 * root 폴더를 host:port 로 서비스한다.
 * port 가 0 이면 비어 있는 포트를 골라 준다.
 * 반환값: { server, port, url }
 */
export function startStaticServer({ root, port = 0, host = '127.0.0.1' }) {
  const server = createServer(async (req, res) => {
    let target = resolvePath(root, req.url || '/');
    if (!target) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const info = await stat(target);
      if (info.isDirectory()) target = join(target, 'index.html');
      const body = await readFile(target);
      res.writeHead(200, {
        'Content-Type': MIME[extname(target).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({ server, port: actual, url: `http://${host}:${actual}/` });
    });
  });
}
