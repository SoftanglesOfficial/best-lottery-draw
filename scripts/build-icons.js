const fs = require('node:fs');
const path = require('node:path');

async function main() {
  let sharp;
  let toIco;
  try {
    sharp = require('sharp');
    toIco = require('to-ico');
  } catch {
    console.error('Install dependencies first: npm install --save-dev sharp to-ico');
    process.exit(1);
  }

  const assetsDir = path.join(__dirname, '..', 'assets');
  fs.mkdirSync(assetsDir, { recursive: true });

  const pngPath = path.join(assetsDir, 'icon.png');
  const icoPath = path.join(assetsDir, 'icon.ico');
  const size = 512;

  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="80" fill="#1F4E79"/>
      <text x="50%" y="54%" font-family="Arial, sans-serif" font-size="180" font-weight="700"
        fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">B12</text>
    </svg>
  `;

  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  console.log('Created', pngPath);

  const icoSizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    icoSizes.map((dim) => sharp(pngPath).resize(dim, dim).png().toBuffer()),
  );

  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Created', icoPath);

  const icnsPath = path.join(assetsDir, 'icon.icns');
  if (process.platform === 'darwin') {
    const { execSync } = require('node:child_process');
    execSync(`iconutil -c icns -o "${icnsPath}" "${assetsDir}/icon.iconset"`, { stdio: 'inherit' });
    console.log('Created', icnsPath);
  } else {
    console.log('Skipping icon.icns (requires macOS iconutil). PNG/ICO are ready for Windows builds.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
