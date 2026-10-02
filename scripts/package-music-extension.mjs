import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const extension = join(root, 'extensions', 'kanban-music');
const output = join(root, 'public', 'downloads');

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function icon(size) {
  const rows = Buffer.alloc(size * (size * 4 + 1));
  const colors = [[194,109,67], [95,158,155], [189,152,71], [138,118,194]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * (size * 4 + 1) + 1 + x * 4;
    const nx = x / size, ny = y / size;
    const cornerX = Math.max(.18 - nx, nx - .82, 0);
    const cornerY = Math.max(.18 - ny, ny - .82, 0);
    let rgb = [26, 26, 30];
    const visible = cornerX * cornerX + cornerY * cornerY <= .18 * .18;
    for (let bar = 0; bar < 4; bar++) {
      const height = [.27, .48, .65, .37][bar];
      if (nx >= .2 + bar * .16 && nx <= .3 + bar * .16 && Math.abs(ny - .5) <= height / 2) rgb = colors[bar];
    }
    rows.set([...rgb, visible ? 255 : 0], i);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows)), pngChunk('IEND', Buffer.alloc(0))]);
}

// Store-only ZIP entries keep the package reproducible and dependency-free.
function zip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const { name, bytes } of files) {
    const filename = Buffer.from(name);
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x21, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22); header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x21, 14); directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(bytes.length, 20); directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes); central.push(directory, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

await mkdir(join(extension, 'icons'), { recursive: true });
for (const size of [16, 48, 128]) await writeFile(join(extension, 'icons', `${size}.png`), icon(size));
const names = ['manifest.json', 'background.js', 'media.js', 'protocol.js', 'relay.js', 'clock.js', 'beat-sync.js', 'beat-detector.js', 'capture-engine.js', 'offscreen.html', 'offscreen.js', 'setup.html', 'setup.css', 'icons/16.png', 'icons/48.png', 'icons/128.png'];
const files = await Promise.all(names.map(async (name) => ({ name, bytes: await readFile(join(extension, name)) })));
JSON.parse(files.find((file) => file.name === 'manifest.json').bytes.toString());
await mkdir(output, { recursive: true });
await writeFile(join(output, 'kanban-music-companion.zip'), zip(files));
console.log(`Music companion packaged: ${files.length} files → public/downloads/kanban-music-companion.zip`);
