// Reproducible design checks; this does not certify WCAG conformance.
const fs = require('node:fs');
const path = require('node:path');
const doc = fs.readFileSync(path.join(__dirname, 'ui-ux-blueprint-v2.md'), 'utf8');
const themes = { light: {}, dark: {} };
for (const m of doc.matchAll(/^\| `([\w-]+)` \| `(#\w{6})` \| `(#\w{6})` \|/gm)) {
  themes.light[m[1]] = m[2]; themes.dark[m[1]] = m[3];
}
function luminance(hex) {
  return hex.slice(1).match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
let checked = 0;
function check(ratio, threshold, label) {
  checked++;
  if (!Number.isFinite(ratio) || ratio < threshold) throw new Error(`${label}: ${ratio.toFixed(2)} < ${threshold}`);
}
for (const [name, t] of Object.entries(themes)) {
  let min = Infinity;
  for (const fg of ['text', 'muted-text', 'emerald', 'indigo', 'violet', 'warning', 'danger']) {
    for (const bg of ['canvas', 'surface', 'raised']) {
      const ratio = contrast(t[fg], t[bg]);
      check(ratio, 7, `${name} ${fg}/${bg}`); min = Math.min(min, ratio);
    }
  }
  for (const bg of ['canvas', 'surface', 'raised']) {
    check(contrast(t['control-border'], t[bg]), 3, `${name} boundary/${bg}`);
    check(contrast(t.focus, t[bg]), 3, `${name} focus/${bg}`);
  }
  check(contrast(t['action-text'], t['action-bg']), 7, `${name} primary action`);
  console.log(`${name}: minimum neutral-surface text contrast ${min.toFixed(2)}:1`);
}
for (const heading of ['0. System assessment', '1. Design system', '2. Core layout',
  '3. Front-end implementation', '4. UX innovation', '5. Accessibility']) {
  if (!doc.includes(`## ${heading}`)) throw new Error(`Missing ${heading}`);
}
const snippets = [...doc.matchAll(/```tsx\r?\n([\s\S]*?)```/g)];
if (snippets.length !== 2) throw new Error('Expected two React examples');
if ((doc.match(/^```/gm) || []).length % 2) throw new Error('Unclosed code fence');
console.log(`${checked} contrast pairings passed; sections and code fences present.`);
if (process.argv.includes('--syntax')) {
  const ts = require('typescript');
  snippets.forEach((s, i) => {
    const r = ts.transpileModule(s[1], {
      fileName: `example-${i}.tsx`, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
    });
    const errors = (r.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
    if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
      getCanonicalFileName: p => p, getCurrentDirectory: () => __dirname, getNewLine: () => '\n',
    }));
  });
  console.log('Both TSX examples passed syntax transpilation; not integration/type verification.');
}
