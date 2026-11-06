// Fails when user-facing text bypasses t(). Reviewed exceptions live in hardcoded-copy-allowlist.txt.
// Update the allowlist with: node scripts/check-hardcoded-copy.mjs --write
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('.');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const skip = /(\.test\.|\.spec\.|design-lab|music[\\/]diagnostics|i18n[\\/]|[\\/]test[\\/]|experimental-beat-control|audio-delay-compensation-control|hybrid-beta-control|live-pipeline-trace-control|experimental-live-preview-control)/;
const attrs = new Set(['aria-label', 'title', 'placeholder', 'alt', 'label', 'description', 'content', 'helperText', 'emptyText', 'confirmLabel', 'cancelLabel', 'heading', 'subtitle', 'eyebrow']);
const props = new Set(['label', 'title', 'description', 'placeholder', 'message', 'hint', 'subtitle', 'name']);
const prose = s => /[A-Za-z]{2}/.test(s) && !/^[a-z0-9_.:\/#-]+$/.test(s.trim()) || /^[A-Z][a-z]+$/.test(s.trim());
const out = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.tsx?$/.test(e.name) && !skip.test(p)) scan(p); } };
function scan(file) {
  const text = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = (node, kind, value) => { const v = value.replace(/\s+/g, ' ').trim(); if (!v || !prose(v)) return; const { line } = sf.getLineAndCharacterOfPosition(node.getStart()); out.push(`${path.relative(root, file).replace(/\\/g, '/')}:${line + 1}\t${kind}\t${v}`); };
  const visit = n => {
    if (ts.isJsxText(n)) add(n, 'text', n.text);
    if (ts.isJsxAttribute(n) && attrs.has(n.name.getText())) {
      const i = n.initializer; if (i && ts.isStringLiteral(i)) add(i, 'attr:' + n.name.getText(), i.text);
      if (i && ts.isJsxExpression(i) && i.expression && (ts.isStringLiteral(i.expression) || ts.isNoSubstitutionTemplateLiteral(i.expression))) add(i, 'attr:' + n.name.getText(), i.expression.text);
      if (i && ts.isJsxExpression(i) && i.expression && ts.isTemplateExpression(i.expression)) add(i, 'attr:' + n.name.getText(), i.expression.getText());
    }
    if (ts.isJsxExpression(n) && n.expression && ts.isStringLiteral(n.expression) && ts.isJsxElement(n.parent)) add(n, 'text', n.expression.text);
    if (ts.isConditionalExpression(n) && (ts.isJsxExpression(n.parent) || ts.isJsxAttribute(n.parent.parent ?? n))) for (const b of [n.whenTrue, n.whenFalse]) if (ts.isStringLiteral(b) && /\s|^[A-Z]/.test(b.text)) add(b, 'cond', b.text);
    if (ts.isPropertyAssignment(n) && props.has(n.name.getText()) && ts.isStringLiteral(n.initializer)) add(n, 'prop', n.initializer.text);
    if (ts.isCallExpression(n) && /^(notify\.\w+|toast\.\w+|setError|setMessage|setStatus|window\.confirm|confirm|alert)$/.test(n.expression.getText()) && n.arguments[0] && (ts.isStringLiteral(n.arguments[0]) || ts.isTemplateExpression(n.arguments[0]) || ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) add(n, 'call', n.arguments[0].getText());
    if (ts.isNewExpression(n) && n.expression.getText() === 'Error' && n.arguments?.[0] && ts.isStringLiteral(n.arguments[0])) add(n, 'error', n.arguments[0].text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
walk(path.join(root, 'src'));
const entries = [...new Set(out.map(line => { const [where, , text] = line.split('\t'); return where.replace(/:\d+$/, '') + '\t' + text; }))].sort();
const list = path.join(root, 'scripts/hardcoded-copy-allowlist.txt');
if (process.argv.includes('--write')) { fs.writeFileSync(list, entries.join('\n') + '\n'); console.log('allowlist:', entries.length); process.exit(0); }
const allowed = new Set(fs.readFileSync(list, 'utf8').split(/\r?\n/));
const fresh = entries.filter(entry => !allowed.has(entry));
if (fresh.length) { console.error('Text that bypasses t():\n' + fresh.join('\n')); process.exit(1); }
console.log('copy check ok:', entries.length, 'reviewed exceptions');
