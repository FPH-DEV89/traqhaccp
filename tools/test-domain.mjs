#!/usr/bin/env node
/**
 * test-domain.mjs — Exécute la suite de tests domaine/application existante
 * (test_clean_arch.js, basée sur console.assert) et ÉCHOUE si une assertion casse.
 * console.assert n'arrête pas le processus : on détecte donc les échecs dans la sortie.
 */
import { execFileSync } from 'node:child_process';

let out = '';
let rc = 0;
try {
  out = execFileSync(process.execPath, ['test_clean_arch.js'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (e) {
  rc = e.status ?? 1;
  out = String(e.stdout || '') + String(e.stderr || '');
}

const fails = out.split('\n').filter((l) => /Assertion failed/i.test(l));
const tail = out.trim().split('\n').slice(-3).join('\n');
console.log(tail || '(aucune sortie)');

if (rc !== 0 || fails.length) {
  console.error(`\ntest-domain: ${fails.length} assertion(s) en échec (rc=${rc})`);
  fails.slice(0, 20).forEach((f) => console.error('  ✗ ' + f.trim()));
  process.exit(1);
}
console.log('test-domain: OK');
