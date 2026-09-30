// Builds the free static preview into docs/ (serve it with GitHub Pages, Netlify, Cloudflare Pages...).
// It has no server: data.json is a snapshot of the seeded database and js/demo-api.js fakes the API in the browser.
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/db.js';
import { meta } from '../server/meta.js';
import { listPlaces } from '../server/store.js';
import { seedBenefits, seedPlaces } from '../server/seed.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs');
const req = createRequire(import.meta.url);
const pkgDir = (name) => dirname(req.resolve(`${name}/package.json`));

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'public'), out, { recursive: true });
rmSync(join(out, 'img/places/README.txt'), { force: true });
rmSync(join(out, 'css/.gitkeep'), { force: true });
cpSync(join(pkgDir('leaflet'), 'dist'), join(out, 'vendor/leaflet'), { recursive: true });
for (const f of readdirSync(join(out, 'vendor/leaflet'))) if (/\.map$|-src\.|\.esm\./.test(f)) rmSync(join(out, 'vendor/leaflet', f));
for (const pkg of ['@fontsource-variable/bricolage-grotesque', '@fontsource-variable/figtree']) {
  cpSync(join(pkgDir(pkg), 'files'), join(out, 'vendor/fonts'), { recursive: true });
}
// keep only the latin variable fonts we reference
for (const f of readdirSync(join(out, 'vendor/fonts'))) {
  if (!/^(bricolage-grotesque|figtree)-latin-wght-normal\.woff2$/.test(f)) rmSync(join(out, 'vendor/fonts', f));
}

const db = openDb(':memory:');
seedBenefits(db);
seedPlaces(db);
const benefits = db.prepare("SELECT * FROM benefits WHERE status = 'approved'").all().map((b) => ({ ...b }));
writeFileSync(join(out, 'data.json'), JSON.stringify({ meta: meta(), places: listPlaces(db, {}), benefits }));

// relative URLs so it works under https://user.github.io/repo-name/
let html = readFileSync(join(out, 'index.html'), 'utf8');
html = html.replace(/(href|src)="\//g, '$1="').replace('<html lang="en">', '<html lang="en" data-demo>');
html = html.replace('<body>', '<body>\n  <p class="demo-banner"><b>Preview.</b> Sample data only. Anything you add or review stays in your own browser.</p>');
writeFileSync(join(out, 'index.html'), html);
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Static preview written to docs/ (${JSON.parse(readFileSync(join(out, 'data.json'))).places.length} places).`);
