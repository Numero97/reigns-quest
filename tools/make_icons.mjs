// Draws simple app icons (blue square, cream circle, gold paw dots). Run: node tools/make_icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(s) {
  const raw = Buffer.alloc(s * (s * 4 + 1));
  const circ = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
  for (let y = 0; y < s; y++) { raw[y * (s * 4 + 1)] = 0;
    for (let x = 0; x < s; x++) {
      let c = [95, 140, 220];
      const u = x / s, v = y / s;
      if (circ(u, v, .5, .5, .42)) c = [255, 244, 220];
      if (circ(u, v, .5, .6, .17) || circ(u, v, .32, .42, .08) || circ(u, v, .44, .33, .08) || circ(u, v, .56, .33, .08) || circ(u, v, .68, .42, .08)) c = [150, 100, 60];
      const o = y * (s * 4 + 1) + 1 + x * 4; raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2]; raw[o + 3] = 255;
    } }
  const h = Buffer.alloc(13); h.writeUInt32BE(s, 0); h.writeUInt32BE(s, 4); h[8] = 8; h[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', h), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', png(192));
writeFileSync('public/icons/icon-512.png', png(512));
console.log('icons written');
