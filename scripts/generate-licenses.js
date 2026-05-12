// Extract license info from all production dependencies and emit a single
// JSON bundle the app can render in its "Open-source licenses" screen.
// Run: `node scripts/generate-licenses.js` (after `npm install`).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LOCK_PATH = path.join(ROOT, 'package-lock.json');
const OUT_PATH = path.join(ROOT, 'src', 'assets', 'licenses.json');

const LICENSE_FILENAME_CANDIDATES = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'LICENCE',
  'LICENCE.md',
  'LICENCE.txt',
  'license',
  'license.md',
  'License',
  'License.md',
];

function readLicenseText(pkgDir) {
  for (const name of LICENSE_FILENAME_CANDIDATES) {
    const p = path.join(pkgDir, name);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return fs.readFileSync(p, 'utf8').trim();
    }
  }
  return null;
}

function normalizeLicense(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (Array.isArray(field)) return field.map((f) => f.type || f).join(' OR ');
  if (typeof field === 'object' && field.type) return field.type;
  return null;
}

function normalizeAuthor(field) {
  if (!field) return null;
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field.name) return field.name;
  return null;
}

function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
  const seen = new Map(); // key = name@version
  for (const [pkgPath, info] of Object.entries(lock.packages || {})) {
    if (!pkgPath) continue; // skip root
    if (info.dev === true) continue; // skip devDependencies-only entries
    if (info.peer === true && !info.devOptional) continue; // peers aren't shipped
    const relative = pkgPath.startsWith('node_modules/')
      ? pkgPath.slice('node_modules/'.length)
      : pkgPath;
    const name = relative.replace(/.*node_modules\//, '');
    const version = info.version;
    if (!name || !version) continue;
    const key = `${name}@${version}`;
    if (seen.has(key)) continue;

    const dir = path.join(ROOT, pkgPath);
    let manifest = {};
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    } catch {
      // skip packages missing on disk (shouldn't happen after `npm install`)
      continue;
    }

    const license = normalizeLicense(info.license || manifest.license) || 'UNKNOWN';
    const licenseText = readLicenseText(dir);
    const author = normalizeAuthor(manifest.author);
    const homepage =
      manifest.homepage ||
      (manifest.repository &&
        (typeof manifest.repository === 'string'
          ? manifest.repository
          : manifest.repository.url)) ||
      null;

    seen.set(key, {
      name,
      version,
      license,
      author,
      homepage,
      licenseText,
    });
  }

  const entries = Array.from(seen.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + '\n');

  const missingText = entries.filter((e) => !e.licenseText).length;
  const sizeKB = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`  ${entries.length} packages (${sizeKB} KB)`);
  if (missingText > 0) {
    console.log(`  ${missingText} packages have no LICENSE file (will show license type only)`);
  }
}

main();
