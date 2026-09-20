// Assembles index.html from src/shell.html by inlining the modules it includes.
//
// index.html is a build artifact that is committed so the site can be served
// straight from GitHub Pages with no build step. That only stays honest if the
// committed file still matches src/, which is what --check verifies in CI.
//
//   node tools/assemble.mjs           rebuild index.html
//   node tools/assemble.mjs --check   fail if index.html is out of date
//
// This is the cross-platform equivalent of tools/assemble.ps1.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const INCLUDE = /\/\* @@INCLUDE (\S+) @@ \*\//g;

function assemble() {
  const template = readFileSync(join(root, 'src', 'shell.html'), 'utf8');
  return template.replace(INCLUDE, (_match, rel) => {
    let text;
    try {
      text = readFileSync(join(root, rel), 'utf8');
    } catch {
      throw new Error(`Missing include: ${rel}`);
    }
    // A literal </script> inside an inlined module would close the host block
    // early and silently truncate everything after it.
    if (/<\/script/i.test(text)) {
      throw new Error(`Include ${rel} contains a literal </script, which would break inlining`);
    }
    return text;
  });
}

// Git is configured with core.autocrlf on Windows, so the working copy and the
// committed blob can differ only in line endings. Compare on normalised text.
const normalise = (s) => s.replace(/\r\n/g, '\n');

const output = assemble();
const target = join(root, 'index.html');

if (process.argv.includes('--check')) {
  let current;
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    console.error('index.html is missing. Run: node tools/assemble.mjs');
    process.exit(1);
  }
  if (normalise(current) !== normalise(output)) {
    console.error('index.html is out of date with src/. Run: node tools/assemble.mjs');
    process.exit(1);
  }
  console.log('index.html is up to date with src/.');
} else {
  writeFileSync(target, output, 'utf8');
  console.log(`Assembled index.html (${Math.round(output.length / 1024)} KB)`);
}
