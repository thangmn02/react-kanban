import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { performance } from 'node:perf_hooks';

const args = process.argv.slice(2), split = args.indexOf('--');
if (args[0] !== '--output' || split !== 2 || !args[split + 1]) {
  throw new Error('Usage: node scripts/measure-test-command.mjs --output ignored/result.json -- command args');
}
const [command, ...commandArgs] = args.slice(split + 1);
const started = performance.now();
const child = spawn(command === 'node' ? process.execPath : command, commandArgs, { stdio: 'inherit' });
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('close', code => {
  const result = { command: [command, ...commandArgs], wallSeconds: (performance.now() - started) / 1000, exitCode: code };
  mkdirSync(dirname(args[1]), { recursive: true });
  writeFileSync(args[1], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
  process.exitCode = code ?? 1;
});
