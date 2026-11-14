/* A small ZIP reader and writer on node:zlib, so the build can open the browser app's zip and pack it again without a
   system unzip or zip. Reads stored and deflated entries from the central directory (no zip64, no encryption, which is
   what a browser extension package is); writes deflated entries with fixed timestamps so the same input gives the same
   bytes. Entry names are checked on the way in: nothing absolute and nothing that climbs out of the folder. */
import zlib from 'node:zlib';

const SIG_LOCAL = 0x04034b50, SIG_CENTRAL = 0x02014b50, SIG_END = 0x06054b50;

export function safeName(name) {
  const n = String(name).replace(/\\/g, '/');
  if (!n || n.startsWith('/') || /^[a-zA-Z]:/.test(n) || n.split('/').some(p => p === '..') || n.includes('\0')) throw new Error('zip: unsafe entry name ' + JSON.stringify(name));
  return n;
}

/* readZip(buffer) → [{name, data: Buffer, dir: boolean, mode: number}] in central directory order */
export function readZip(buf) {
  if (!Buffer.isBuffer(buf)) buf = Buffer.from(buf);
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (buf.readUInt32LE(i) === SIG_END) { end = i; break; }
  if (end < 0) throw new Error('zip: no end of central directory record; is this a zip file?');
  const count = buf.readUInt16LE(end + 10), size = buf.readUInt32LE(end + 12), start = buf.readUInt32LE(end + 16);
  if (count === 0xffff || start === 0xffffffff || size === 0xffffffff) throw new Error('zip: zip64 archives are not supported');
  const out = []; let p = start;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== SIG_CENTRAL) throw new Error('zip: bad central directory entry ' + n);
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24);
    const nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), ext = buf.readUInt32LE(p + 38), local = buf.readUInt32LE(p + 42);
    const name = safeName(buf.toString('utf8', p + 46, p + 46 + nlen));
    if (flags & 1) throw new Error('zip: ' + name + ' is encrypted');
    if (buf.readUInt32LE(local) !== SIG_LOCAL) throw new Error('zip: bad local header for ' + name);
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(dataAt, dataAt + csize); const dir = name.endsWith('/');
    let data;
    if (dir) data = Buffer.alloc(0);
    else if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: Math.max(usize, 1) });
    else throw new Error('zip: ' + name + ' uses compression method ' + method + ', which is not supported');
    if (!dir && (data.length !== usize || zlib.crc32(data) !== crc)) throw new Error('zip: ' + name + ' failed its size or checksum test');
    out.push({ name, data, dir, mode: (ext >>> 16) & 0xffff });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/* writeZip([{name, data}]) → Buffer. Folders are implied by the names; one fixed date so the output is reproducible. */
export function writeZip(entries, opts) {
  const date = (opts && opts.date) || new Date(Date.UTC(2026, 10, 14, 12, 0, 0));
  const dosTime = (date.getUTCHours() << 11) | (date.getUTCMinutes() << 5) | (date.getUTCSeconds() >> 1);
  const dosDate = ((date.getUTCFullYear() - 1980) << 9) | ((date.getUTCMonth() + 1) << 5) | date.getUTCDate();
  const seen = new Set(), locals = [], centrals = []; let offset = 0;
  for (const e of entries) {
    const name = safeName(e.name); if (name.endsWith('/')) continue;
    if (seen.has(name)) throw new Error('zip: two entries named ' + name); seen.add(name);
    const data = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data == null ? '' : e.data);
    const packed = zlib.deflateRawSync(data, { level: 9 }); const store = packed.length >= data.length;
    const body = store ? data : packed, nameBuf = Buffer.from(name, 'utf8'), crc = zlib.crc32(data);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(SIG_LOCAL, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(store ? 0 : 8, 8); lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nameBuf.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(SIG_CENTRAL, 0); ch.writeUInt16LE(0x0314, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(store ? 0 : 8, 10); ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nameBuf.length, 28); ch.writeUInt32LE((0o100644 << 16) >>> 0, 38); ch.writeUInt32LE(offset, 42);
    locals.push(lh, nameBuf, body); centrals.push(ch, nameBuf); offset += 30 + nameBuf.length + body.length;
  }
  const cd = Buffer.concat(centrals), endRec = Buffer.alloc(22);
  endRec.writeUInt32LE(SIG_END, 0); endRec.writeUInt16LE(seen.size, 8); endRec.writeUInt16LE(seen.size, 10); endRec.writeUInt32LE(cd.length, 12); endRec.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, endRec]);
}
