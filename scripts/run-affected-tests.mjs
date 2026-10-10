import { spawn } from 'node:child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createPlan } from './test-impact.mjs';

const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
const lane = args.includes('--lane') ? value('--lane') : 'all';
if (!['all', 'unit', 'browser', 'python', 'native', 'safety'].includes(lane)) throw new Error('Invalid test lane');
const plan = args.includes('--plan') ? JSON.parse(readFileSync(value('--plan'), 'utf8')) : createPlan(process.cwd(), args);
if (plan.schemaVersion !== 1 || !Array.isArray(plan.unit) || !Array.isArray(plan.e2e)) throw new Error('Invalid selection plan');
console.log(`${plan.full ? 'FULL FALLBACK' : 'AFFECTED'}: ${plan.unit.length} unit files, ${plan.e2e.length} browser selections, ${plan.python.length} Python files, native=${plan.native}`);
plan.fallback.forEach(reason => console.log(`Fallback: ${reason}`));
const timings = [];
async function run(command, commandArgs) {
  console.log(`Run: ${command} ${commandArgs.join(' ')}`);
  const started = performance.now();
  const code = await new Promise((resolve, reject) => {
    const child = spawn(command === 'node' ? process.execPath : command, commandArgs, { stdio: 'inherit' });
    child.once('error', reject); child.once('close', resolve);
  });
  timings.push({ command: [command, ...commandArgs], wallSeconds: (performance.now() - started) / 1000, exitCode: code });
  if (code !== 0) throw new Error(`Test lane failed (${code}): ${command}`);
}
try {
  await run('node', ['--test', 'scripts/test-impact.test.mjs']);
  if (lane === 'all' || lane === 'safety') {
    await run('node', ['node_modules/eslint/bin/eslint.js', '.']);
    await run('node', ['node_modules/typescript/bin/tsc', '-b']);
    await run('node', ['scripts/package-music-extension.mjs']);
    await run('node', ['node_modules/vite/bin/vite.js', 'build']);
    await run('node', ['scripts/check-bundle-size.mjs']);
  }
  if ((lane === 'all' || lane === 'unit') && plan.unit.length) {
    // Keep coverage; a selective result is not a replacement for full coverage.
    await run('node', ['node_modules/vitest/vitest.mjs', 'run', '--coverage', ...(plan.full ? [] : plan.unit.map(item => item.file))]);
  }
  if ((lane === 'all' || lane === 'browser') && plan.e2e.length) {
    for (const auth of [false, true]) {
      const selected = plan.e2e.filter(item => (item.file === 'e2e/public-auth.spec.ts') === auth);
      if (!selected.length) continue;
      const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const grep = selected.map(item => escape(item.file.split('/').at(-1)) + '.*' + (item.title ? escape(item.title) : '')).join('|');
      await run('node', ['node_modules/@playwright/test/cli.js', 'test', ...(auth ? ['--config', 'playwright.public-auth.config.ts'] : []), ...new Set(selected.map(item => item.file)), '--workers', '1', '--grep', grep]);
    }
  }
  if ((lane === 'all' || lane === 'python') && plan.python.length) {
    const python = process.env.KORA_TEST_PYTHON || (existsSync('src-tauri/target/analysis-venv310/Scripts/python.exe') ? 'src-tauri/target/analysis-venv310/Scripts/python.exe' : 'python');
    await run(python, ['-m', 'unittest', 'discover', '-s', 'server/audio-analysis', '-p', 'test_*.py']);
  }
  if ((lane === 'all' || lane === 'native') && plan.native) {
    await run('cargo', ['test', '--locked', '--manifest-path', 'src-tauri/Cargo.toml']);
  }
} catch (error) { console.error(error); process.exitCode = 1; }
finally {
  if (args.includes('--timings')) {
    const output = value('--timings'); mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify({ lane, selected: { unit: plan.unit.map(item => item.file), e2e: plan.e2e }, timings }, null, 2) + '\n');
  }
}
