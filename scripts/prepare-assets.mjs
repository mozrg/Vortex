import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { PNG } from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetsPath = path.join(projectRoot, 'assets');

async function readAsset(name) {
  return readFile(path.join(assetsPath, name), 'utf8');
}

function renderPng(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

function toBmp(pngBuffer) {
  const image = PNG.sync.read(pngBuffer);
  const rowSize = Math.ceil((image.width * 3) / 4) * 4;
  const pixelSize = rowSize * image.height;
  const bitmap = Buffer.alloc(14 + 40 + pixelSize);
  bitmap.write('BM', 0, 2, 'ascii');
  bitmap.writeUInt32LE(bitmap.length, 2);
  bitmap.writeUInt32LE(54, 10);
  bitmap.writeUInt32LE(40, 14);
  bitmap.writeInt32LE(image.width, 18);
  bitmap.writeInt32LE(image.height, 22);
  bitmap.writeUInt16LE(1, 26);
  bitmap.writeUInt16LE(24, 28);
  bitmap.writeUInt32LE(0, 30);
  bitmap.writeUInt32LE(pixelSize, 34);
  bitmap.writeInt32LE(2835, 38);
  bitmap.writeInt32LE(2835, 42);

  for (let y = 0; y < image.height; y += 1) {
    const sourceY = image.height - 1 - y;
    const rowOffset = 54 + y * rowSize;
    for (let x = 0; x < image.width; x += 1) {
      const sourceOffset = (sourceY * image.width + x) * 4;
      const alpha = image.data[sourceOffset + 3] / 255;
      const background = [14, 13, 19];
      const destination = rowOffset + x * 3;
      bitmap[destination] = Math.round(image.data[sourceOffset + 2] * alpha + background[2] * (1 - alpha));
      bitmap[destination + 1] = Math.round(image.data[sourceOffset + 1] * alpha + background[1] * (1 - alpha));
      bitmap[destination + 2] = Math.round(image.data[sourceOffset] * alpha + background[0] * (1 - alpha));
    }
  }
  return bitmap;
}

function toIco(pngFrames) {
  const header = Buffer.alloc(6 + pngFrames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngFrames.length, 4);
  let offset = header.length;
  pngFrames.forEach(({ size, data }, index) => {
    const entryOffset = 6 + index * 16;
    header[entryOffset] = size === 256 ? 0 : size;
    header[entryOffset + 1] = size === 256 ? 0 : size;
    header[entryOffset + 2] = 0;
    header[entryOffset + 3] = 0;
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(data.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngFrames.map((frame) => frame.data)]);
}

const appLogo = await readAsset('vortex-logo.svg');
const sidebarTemplate = await readAsset('installer-sidebar.svg');
const headerTemplate = await readAsset('installer-header.svg');
const logoMarkup = appLogo.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1];
if (!logoMarkup) throw new Error('Could not read the Vortex SVG logo markup.');

for (const [template, width, output] of [
  [sidebarTemplate, 164, 'installer-sidebar.bmp'],
  [headerTemplate, 150, 'installer-header.bmp']
]) {
  const svg = template.replace('{{APP_LOGO}}', logoMarkup);
  if (svg.includes('{{APP_LOGO}}')) throw new Error(`The app logo placeholder in ${output} was not replaced.`);
  await writeFile(path.join(assetsPath, output), toBmp(renderPng(svg, width)));
}

for (const output of ['assets/vortex-app-icon.svg', 'src/assets/vortex-logo.svg', 'src/assets/vortex-app-icon.svg', 'site/assets/vortex-logo.svg', 'src-tauri/icons/icon.svg']) {
  await copyFile(path.join(assetsPath, 'vortex-logo.svg'), path.join(projectRoot, output));
}
const icoFrames = [16, 24, 32, 48, 64, 128, 256].map(size => ({ size, data: renderPng(appLogo, size) }));
const ico = toIco(icoFrames);
await writeFile(path.join(assetsPath, 'vortex-app-icon.ico'), ico);
const tauriIcons = path.join(projectRoot, 'src-tauri', 'icons');
await writeFile(path.join(tauriIcons, 'icon.ico'), ico);
for (const [name, size] of [['32x32.png', 32], ['128x128.png', 128], ['128x128@2x.png', 256], ['256x256.png', 256]]) {
  await writeFile(path.join(tauriIcons, name), icoFrames.find(frame => frame.size === size).data);
}
console.log('Generated the Vortex app icon and installer artwork.');
