/**
 * 앱 아이콘(assets/icon.ico, assets/icon.png)을 만든다.
 *
 * 그림판 파일을 저장소에 넣는 대신 코드로 그린다. 어두운 모서리 둥근 사각형 위에
 * 강조색 재생 삼각형 하나 — 프로그램 화면과 같은 얼굴이다.
 * 바꿀 일이 생기면 값만 고치고 `npm run icon` 을 다시 돌리면 된다.
 */
import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SIZE = 256;
const BG = [0x1b, 0x1e, 0x24];        // 앱 배경과 같은 어두운 남색
const MARK = [0xff, 0xb4, 0x3a];      // 강조색(호박색)
const RADIUS = 52;

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

/** RGBA 픽셀 버퍼를 PNG 로 감싼다. */
function toPng(pixels, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // 필터 없음
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** 경계에서 0~1 로 부드럽게 넘어가는 값 — 계단 현상을 줄인다. */
function smooth(edge, value) {
  return Math.max(0, Math.min(1, 0.5 + (edge - value)));
}

function roundedRectCoverage(x, y, size, radius) {
  const dx = Math.max(radius - x, x - (size - radius), 0);
  const dy = Math.max(radius - y, y - (size - radius), 0);
  if (dx === 0 || dy === 0) return 1;
  return smooth(radius, Math.hypot(dx, dy));
}

/** 오른쪽을 보는 재생 삼각형의 덮임 정도 */
function triangleCoverage(x, y, size) {
  const left = size * 0.34;
  const right = size * 0.72;
  const top = size * 0.26;
  const bottom = size * 0.74;
  if (x < left - 1 || x > right + 1) return 0;

  const progress = (x - left) / (right - left);
  const half = (1 - progress) * ((bottom - top) / 2);
  const mid = (top + bottom) / 2;
  const inside = Math.min(smooth(half, Math.abs(y - mid)), smooth(0, left - x), smooth(0, x - right));
  return Math.max(0, Math.min(1, inside));
}

function draw(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const alpha = roundedRectCoverage(px, py, size, (RADIUS * size) / SIZE);
      const mark = triangleCoverage(px, py, size);

      const r = BG[0] + (MARK[0] - BG[0]) * mark;
      const g = BG[1] + (MARK[1] - BG[1]) * mark;
      const b = BG[2] + (MARK[2] - BG[2]) * mark;

      const at = (y * size + x) * 4;
      pixels[at] = Math.round(r);
      pixels[at + 1] = Math.round(g);
      pixels[at + 2] = Math.round(b);
      pixels[at + 3] = Math.round(alpha * 255);
    }
  }
  return pixels;
}

/** PNG 한 장을 담는 ICO. 256px 은 너비/높이 칸에 0 으로 적는 것이 규격이다. */
function toIco(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry[2] = 0;
  entry[3] = 0;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
}

const assets = fileURLToPath(new URL('../assets/', import.meta.url));
await mkdir(assets, { recursive: true });

const png = toPng(draw(SIZE), SIZE);
await writeFile(assets + 'icon.png', png);
await writeFile(assets + 'icon.ico', toIco(png, SIZE));

console.log(`아이콘을 만들었습니다: assets/icon.png, assets/icon.ico (${SIZE}px)`);
