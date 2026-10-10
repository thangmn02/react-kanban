import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { selectTests, createPlan } from './test-impact.mjs';

function fixture(t, additions = {}) {
  const root = mkdtempSync(join(tmpdir(), 'kora-impact-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const contents = {
    'src/math.ts': 'export const value = 1;',
    'src/barrel.ts': "export {value} from './math';",
    'src/view.tsx': "import {value} from './barrel'; export default value;",
    'src/view.test.ts': "import view from './view';",
    'src/other.test.ts': 'export {};',
    'e2e/beat-grid.spec.ts': '', 'e2e/smoke.spec.ts': "test('keeps the empty browser Focus Dock and shared timer accessible', ()=>{});",
    'e2e/workflows.spec.ts': "test('focus and Pomodoro state survives reload', ()=>{});", 'e2e/public-auth.spec.ts': '',
    'e2e/briefing.spec.ts': '', 'e2e/task-breakdown.spec.ts': '',
    'e2e/toasts.spec.ts': '',
    'server/audio-analysis/test_service.py': '',
    ...additions,
  };
  for (const [file, text] of Object.entries(contents)) {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), text);
  }
  return { root, files: Object.keys(contents) };
}

test('selects transitive re-export consumers and shows the exact dependency chain', t => {
  const plan = selectTests({ ...fixture(t), changed: ['src/math.ts'] });
  assert.equal(plan.full, false);
  assert.deepEqual(plan.unit.map(item => item.file), ['src/view.test.ts']);
  assert.equal(plan.unit[0].reasons[0], 'Dependency: src/math.ts -> src/barrel.ts -> src/view.tsx -> src/view.test.ts');
  assert.equal(plan.native, false);
});

test('keeps literal dynamic imports, type imports, raw styles and test mocks in the graph', t => {
  const input = fixture(t, {
    'src/lazy.test.ts': "const lazy=()=>import('./math');",
    'src/mock.test.ts': "vi.mock('./math');",
    'src/types.test.ts': "type Value=import('./math').value;",
    'src/style.css': '.test{}',
    'src/style.test.ts': "import css from './style.css?inline';",
  });
  const plan = selectTests({ ...input, changed: ['src/math.ts', 'src/style.css'] });
  assert.equal(plan.full, false);
  assert.deepEqual(plan.unit.map(item => item.file), ['src/lazy.test.ts', 'src/mock.test.ts', 'src/style.test.ts', 'src/types.test.ts', 'src/view.test.ts']);
});

test('resolves configured aliases and retains dependency direction', t => {
  const input = fixture(t, {
    'tsconfig.app.json': JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@/*': ['src/*'] } } }),
    'src/alias.test.ts': "import {value} from '@/math';",
  });
  const plan = selectTests({ ...input, changed: ['src/math.ts'] });
  assert.equal(plan.full, false);
  assert.deepEqual(plan.unit.map(item => item.file), ['src/alias.test.ts', 'src/view.test.ts']);
  assert.deepEqual(selectTests({ ...input, changed: ['src/view.test.ts'] }).unit.map(item => item.file), ['src/view.test.ts']);
});

test('retains runtime JavaScript and its declaration as separate dependencies', t => {
  const input = fixture(t, {
    'extensions/engine.js': 'export const run=()=>1;',
    'extensions/engine.d.ts': 'export declare const run:()=>number;',
    'src/engine.test.ts': "import {run} from '../extensions/engine.js';",
  });
  for (const changed of ['extensions/engine.js', 'extensions/engine.d.ts']) {
    const plan = selectTests({ ...input, changed: [changed] });
    assert.equal(plan.full, false);
    assert.deepEqual(plan.unit.map(item => item.file), ['src/engine.test.ts']);
  }
});

test('shared contract changes select Web/Companion/native/server tests plus Windows and Python lanes', t => {
  const input = fixture(t, {
    'extensions/kanban-music/protocol.js': 'export const schema=1;',
    'src/features/music/wire.test.ts': 'export {};',
    'src/features/native/wire.test.ts': 'export {};',
    'extensions/kanban-music/wire.test.js': 'export {};',
    'server/wire.test.ts': 'export {};',
  });
  const plan = selectTests({ ...input, changed: ['extensions/kanban-music/protocol.js'] });
  assert.equal(plan.full, false);
  assert.equal(plan.unit.length, 4);
  assert.equal(plan.native, true);
  assert.deepEqual(plan.python, ['server/audio-analysis/test_service.py']);
  assert.equal(plan.e2e.length, 3);
  assert.match(plan.unit[0].reasons[0], /Shared Web\/Companion\/Desktop\/analysis contract/);
});

test('propagates an upstream dependency into a shared contract boundary', t => {
  const input = fixture(t, {
    'extensions/kanban-music/protocol.js': "import '../../src/math';",
    'src/features/native/wire.test.ts': 'export {};',
  });
  const plan = selectTests({ ...input, changed: ['src/math.ts'] });
  assert.equal(plan.full, false);
  assert.equal(plan.native, true);
  assert.match(plan.unit.find(item => item.file === 'src/features/native/wire.test.ts').reasons[0], /src\/math.ts -> extensions\/kanban-music\/protocol.js/);
});

test('focus changes select named journeys without replaying unrelated workflow tests', t => {
  const input = fixture(t, { 'src/features/focus/timer.ts': 'export {};', 'src/features/focus/timer.test.ts': "import './timer';" });
  const plan = selectTests({ ...input, changed: ['src/features/focus/timer.ts'] });
  assert.equal(plan.full, false);
  assert.match(plan.e2eGrep, /focus and Pomodoro/);
  assert.doesNotMatch(plan.e2eGrep, /task CRUD/);
  assert.equal(plan.e2e.find(item => item.file === 'e2e/workflows.spec.ts').title, 'focus and Pomodoro state survives reload');
});

test('documentation and empty diffs retain mandatory safety without inventing test impacts', t => {
  const input = fixture(t, { 'docs/testing.md': 'test docs' });
  for (const changed of [[], ['docs/testing.md']]) {
    const plan = selectTests({ ...input, changed });
    assert.equal(plan.full, false);
    assert.equal(plan.unit.length, 0);
    assert.equal(plan.e2e.length, 0);
    assert(plan.mandatory.includes('full TypeScript check'));
  }
});

test('unknown, deleted, global configuration and unresolved dynamic imports fail conservatively', t => {
  for (const additions of [{ 'unknown.bin': 'data' }, { 'package.json': '{}' }, { 'src/loader.ts': 'import(runtimePath)' }]) {
    const input = fixture(t, additions);
    const plan = selectTests({ ...input, changed: [Object.keys(additions)[0]] });
    assert.equal(plan.full, true);
    assert.equal(plan.unit.length, 2);
    assert.equal(plan.native, true);
    assert(plan.fallback.length > 0);
  }
  assert.equal(selectTests({ ...fixture(t), changed: ['src/deleted.ts'] }).full, true);
});

test('missing diff refs and unavailable browser mappings cannot silently skip regression', t => {
  const input = fixture(t);
  assert.equal(createPlan(input.root, ['--base', 'does-not-exist']).full, true);
  const missing = fixture(t, { 'src/features/music/view.ts': 'export {};'});
  missing.files = missing.files.filter(file => file !== 'e2e/beat-grid.spec.ts');
  assert.equal(selectTests({ ...missing, changed: ['src/features/music/view.ts'] }).full, true);
});

test('invalid outside-repository paths fail rather than being treated as documentation', t => {
  assert.throws(() => selectTests({ ...fixture(t), changed: ['../README.md'] }), /repository-relative/);
});

test('uncovered source modules and renamed journey titles trigger full regression', t => {
  const uncovered = fixture(t, { 'src/features/music/new-worker.ts': 'export {};' });
  assert.equal(selectTests({ ...uncovered, changed: ['src/features/music/new-worker.ts'] }).full, true);
  const renamed = fixture(t, {
    'src/features/focus/timer.ts': 'export {};',
    'src/features/focus/timer.test.ts': "import './timer';",
    'e2e/workflows.spec.ts': "test('a changed title', ()=>{});",
  });
  const plan = selectTests({ ...renamed, changed: ['src/features/focus/timer.ts'] });
  assert.equal(plan.full, true);
  assert(plan.fallback.some(reason => reason.startsWith('Missing named journey:')));
});

test('nonliteral test dependencies cannot be skipped behind a normal importing test', t => {
  const input = fixture(t, { 'src/dynamic.test.ts': "const target='./math'; import(target);" });
  const plan = selectTests({ ...input, changed: ['src/math.ts'] });
  assert.equal(plan.full, true);
  assert(plan.unit.some(item => item.file === 'src/dynamic.test.ts'));
});

test('literal import-promise mocks remain selective and executable README files are source', t => {
  const input = fixture(t, {
    'src/promise.test.ts': "vi.mock(import('./math'),()=>({value:2}));",
    'src/README.ts': 'export const value=1;',
    'src/readme.test.ts': "import './README';",
  });
  const promise = selectTests({ ...input, changed: ['src/math.ts'] });
  assert.equal(promise.full, false);
  assert(promise.unit.some(item => item.file === 'src/promise.test.ts'));
  const source = selectTests({ ...input, changed: ['src/README.ts'] });
  assert.equal(source.full, false);
  assert.deepEqual(source.unit.map(item => item.file), ['src/readme.test.ts']);
});

test('upstream auth dependencies include public-auth journeys and toast changes stay targeted', t => {
  const auth = fixture(t, {
    'src/components/auth/AuthPage.tsx': "import '../../math';",
    'src/auth.test.ts': "import './components/auth/AuthPage';",
  });
  const authPlan = selectTests({ ...auth, changed: ['src/math.ts'] });
  assert.equal(authPlan.full, false);
  assert(authPlan.e2e.some(item => item.file === 'e2e/public-auth.spec.ts'));
  const toast = fixture(t, {
    'src/components/organisms/toast/toast.ts': 'export {};',
    'src/toast.test.ts': "import './components/organisms/toast/toast';",
  });
  const toastPlan = selectTests({ ...toast, changed: ['src/components/organisms/toast/toast.ts'] });
  assert.equal(toastPlan.full, false);
  assert.deepEqual(toastPlan.e2e.map(item => item.file), ['e2e/toasts.spec.ts']);
});
