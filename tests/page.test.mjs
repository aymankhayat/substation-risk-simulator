// Document-level checks on the built index.html.
//
// engine.test.mjs proves the mathematics. This file proves the four things about the
// page itself that no unit test and no screenshot would catch, because the page still
// renders and still computes correctly when every one of them is wrong:
//
//   1. a doctype, or the browser silently falls back to quirks mode
//   2. a lang attribute, or a screen reader guesses the pronunciation (WCAG 3.1.1)
//   3. a viewport meta, or phones render at the 980 px fallback width and none of the
//      responsive breakpoints below it ever fire
//   4. Subresource Integrity on every third-party script, so a compromised CDN cannot
//      run arbitrary code with full page privileges
//
// Run with:  node tests/page.test.mjs

import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const head = html.slice(0, 4096);

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (err) {
    failures.push({ name, message: err.message });
    console.log('  FAIL ' + name + '\n       ' + err.message);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('\nDocument structure');

check('the page opens with a doctype so browsers use standards mode', () => {
  assert(/^\s*<!doctype html>/i.test(html), 'no <!doctype html> at the start of index.html');
});

check('the root element declares a language', () => {
  const m = head.match(/<html\b[^>]*\blang\s*=\s*"([^"]+)"/i);
  assert(m, '<html> is missing a lang attribute');
  assert(m[1].trim().length > 0, 'lang attribute is empty');
});

check('a viewport meta lets the responsive breakpoints apply on phones', () => {
  const m = head.match(/<meta\s+name="viewport"\s+content="([^"]+)"/i);
  assert(m, 'no <meta name="viewport"> - phones will render at the 980px fallback width');
  assert(/width\s*=\s*device-width/i.test(m[1]), 'viewport meta does not set width=device-width');
});

console.log('\nThird-party script integrity');

// <script src="..."> anywhere in the document, with whatever attribute order.
const externalScripts = [...html.matchAll(/<script\b([^>]*\bsrc\s*=\s*"[^"]+"[^>]*)>/gi)].map((m) => {
  const attrs = m[1];
  return {
    src: attrs.match(/\bsrc\s*=\s*"([^"]+)"/i)[1],
    integrity: (attrs.match(/\bintegrity\s*=\s*"([^"]+)"/i) || [])[1],
    crossorigin: (attrs.match(/\bcrossorigin\s*=\s*"([^"]+)"/i) || [])[1]
  };
});

check('the page still loads its third-party scripts from a CDN', () => {
  assert(externalScripts.length > 0, 'expected at least one external <script src>');
});

for (const s of externalScripts) {
  const name = s.src.split('/').pop();

  check(name + ' is pinned with Subresource Integrity', () => {
    assert(s.integrity, s.src + ' has no integrity attribute');
    assert(
      /^sha(256|384|512)-[A-Za-z0-9+/]+={0,2}$/.test(s.integrity),
      s.src + ' has a malformed integrity value: ' + s.integrity
    );
  });

  // Without crossorigin the response is opaque, the browser cannot verify the hash,
  // and it blocks the script outright - a silently broken page rather than a safe one.
  check(name + ' is fetched with crossorigin so the hash can be verified', () => {
    assert(s.crossorigin === 'anonymous', s.src + ' needs crossorigin="anonymous", got: ' + (s.crossorigin || 'nothing'));
  });
}

console.log('\n' + passed + ' passed, ' + failures.length + ' failed\n');
if (failures.length) {
  for (const f of failures) console.error('FAILED: ' + f.name + ': ' + f.message);
  process.exit(1);
}
