// Vérifie que chaque asset précaché par sw.js existe bien dans dist-pages/
import fs from 'fs';
import path from 'path';

const root = '/opt/data/traqhaccp';
const dist = path.join(root, 'dist-pages');
const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');

const block = sw.match(/const ASSETS_TO_CACHE = \[([\s\S]*?)\];/)[1];
const paths = [...block.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);

let missing = [];
for (const p of paths) {
  if (!fs.existsSync(path.join(dist, p))) missing.push(p);
}
console.log('Assets précachés :', paths.length);
console.log('Manquants dans dist-pages :', missing.length);
missing.forEach(m => console.log('  MANQUANT:', m));

// vérifie aussi que les imports relatifs se résolvent
function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp, acc);
    else if (e.name.endsWith('.js')) acc.push(fp);
  }
  return acc;
}
const jsFiles = walk(path.join(dist, 'js')).concat(walk(path.join(dist, 'src')));
let brokenImports = [];
for (const f of jsFiles) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/(?:import|from)\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const target = path.resolve(path.dirname(f), m[1].split('?')[0]);
    if (!fs.existsSync(target)) brokenImports.push(`${path.relative(dist, f)} -> ${m[1]}`);
  }
}
console.log('Modules JS scannés :', jsFiles.length);
console.log('Imports cassés :', brokenImports.length);
brokenImports.slice(0, 10).forEach(b => console.log('  CASSE:', b));
