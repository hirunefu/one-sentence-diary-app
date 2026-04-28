// Render assets/icon.svg into multiple PNG sizes for Expo.
// Run: `node scripts/generate-icons.js`
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const SVG_PATH = path.join(ASSETS, 'icon.svg');

const TARGETS = [
  { name: 'icon.png', width: 1024 },
  { name: 'adaptive-icon.png', width: 1024 },
  { name: 'splash-icon.png', width: 1024 },
  { name: 'favicon.png', width: 48 },
];

function renderToPng(svg, width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: {
      // resvg-js scans system fonts by default; this enables loading the Mincho family on macOS/Windows/Linux.
      loadSystemFonts: true,
    },
  });
  return resvg.render().asPng();
}

function main() {
  const svg = fs.readFileSync(SVG_PATH, 'utf8');
  for (const t of TARGETS) {
    const png = renderToPng(svg, t.width);
    const outPath = path.join(ASSETS, t.name);
    fs.writeFileSync(outPath, png);
    console.log(`Wrote ${outPath} (${t.width}px)`);
  }
}

main();
