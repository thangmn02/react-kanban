import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, resolve, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const slash = value => value.replaceAll('\\', '/');
const unitFile = file => /^(src|extensions|server|supabase\/functions)\/.*\.(test|spec)\.[cm]?[jt]sx?$/.test(file);
const moduleFile = file => /\.[cm]?[jt]sx?$/.test(file);
const docsOnly = file => (/^(docs|plans)\//.test(file) && /\.(md|mdx|txt|rst|adoc)$/i.test(file))
  || /(^|\/)(README|AGENTS|LICENSE|CHANGELOG)(\.(md|txt|rst|adoc))?$/i.test(file);
const critical = file => /^(\.github\/|package(?:-lock)?\.json$|pnpm-lock\.yaml$|(?:vite|vitest|playwright).*config\.|tsconfig|eslint\.config|src\/test\/|scripts\/(?:test-impact|run-affected-tests|measure-test-command))/.test(file);
const contract = file => /^(src-tauri\/|server\/audio-analysis\/|modal_kora.*\.py$)/.test(file)
  || /^(src\/features\/(music\/(event-track(?:-ranges)?|lead-events|mediaBridge|beat-capabilities)|native\/(nativeMusic|nativeAudio))\.[jt]s|extensions\/kanban-music\/(protocol|beat-timing|media-clock|media-asset|native-audio-engine)\.)/.test(file);
const sharedTest = file => /^(src\/features\/(music|native|focus)\/|extensions\/kanban-music\/|server\/)/.test(file);
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function repositoryFiles(root) {
  return [...new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).split('\0').filter(Boolean))].sort();
}

function fallbackFiles(root) {
  const files = [];
  const visit = directory => {
    if (!existsSync(resolve(root, directory))) return;
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const file = posix.join(directory, entry.name);
      if (entry.isDirectory() && !['target', 'generated', 'vendor', 'node_modules', '__pycache__'].includes(entry.name)) visit(file);
      else if (entry.isFile()) files.push(file);
    }
  };
  ['src', 'extensions', 'server', 'supabase', 'e2e', 'scripts'].forEach(visit);
  return files;
}

/** Static and literal-dynamic imports, re-exports, type imports and test mocks. */
export function dependencyGraph(root, files) {
  const reverse = new Map(), uncertain = [];
  const options = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, allowJs: true };
  for (const config of ['tsconfig.app.json', 'tsconfig.node.json']) {
    if (!existsSync(resolve(root, config))) continue;
    const parsed = ts.readConfigFile(resolve(root, config), ts.sys.readFile);
    if (parsed.error) { uncertain.push(config); continue; }
    Object.assign(options, ts.parseJsonConfigFileContent(parsed.config, ts.sys, root).options);
  }
  const add = (dependency, consumer) => {
    if (!reverse.has(dependency)) reverse.set(dependency, new Set());
    reverse.get(dependency).add(consumer);
  };
  for (const file of files.filter(moduleFile)) {
    if (!existsSync(resolve(root, file))) continue;
    const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    if (source.parseDiagnostics.length) uncertain.push(file);
    const imports = new Set();
    const visit = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) imports.add(node.moduleSpecifier.text);
      if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteralLike(node.argument.literal)) imports.add(node.argument.literal.text);
      if (ts.isCallExpression(node)) {
        const text = node.expression.getText(source);
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword || /^(require|vi\.(mock|doMock|importActual|importMock))$/.test(text)) {
          if (node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) imports.add(node.arguments[0].text);
          else if (!(node.arguments[0] && ts.isCallExpression(node.arguments[0]) && node.arguments[0].expression.kind === ts.SyntaxKind.ImportKeyword
            && node.arguments[0].arguments[0] && ts.isStringLiteralLike(node.arguments[0].arguments[0]))) uncertain.push(file);
        }
        if (text === 'import.meta.glob') uncertain.push(file);
      }
      if (ts.isNewExpression(node) && node.expression.getText(source) === 'URL' && node.arguments?.[0] && ts.isStringLiteralLike(node.arguments[0])) imports.add(node.arguments[0].text);
      ts.forEachChild(node, visit);
    };
    visit(source);
    for (const specifier of imports) {
      const name = specifier.split('?')[0];
      const resolved = ts.resolveModuleName(name, resolve(root, file), options, ts.sys).resolvedModule?.resolvedFileName;
      if (resolved && !slash(resolved).includes('/node_modules/')) add(slash(relative(root, resolved)), file);
      // Keep runtime JS/CSS/JSON edges as well as a resolved declaration file.
      if (name.startsWith('.')) {
        const path = posix.normalize(posix.join(posix.dirname(file), name));
        const matches = [path, ...['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs', '.d.ts', '/index.ts', '/index.tsx', '/index.js'].map(ext => path + ext)].filter(value => existsSync(resolve(root, value)));
        matches.forEach(value => add(value, file));
        if (!resolved && !matches.length) {
          if (/^extensions\/kanban-music\/(generated|vendor)\//.test(path)) add(path, file);
          else uncertain.push(file);
        }
      }
    }
  }
  return { reverse, uncertain: [...new Set(uncertain)] };
}

export function selectTests({ root, files, changed, forceFull = false, discoveryFailure }) {
  files = files.filter(file => existsSync(resolve(root, file)));
  const units = files.filter(unitFile), browser = files.filter(file => /^e2e\/.*\.spec\.ts$/.test(file));
  const python = files.filter(file => /^server\/audio-analysis\/test_.*\.py$/.test(file));
  const selected = new Map(), journeys = new Map(), decisions = [], fallback = [];
  const addUnit = (file, reason) => { if (!selected.has(file)) selected.set(file, new Set()); selected.get(file).add(reason); };
  const addJourney = (file, title, reason) => {
    if (!browser.includes(file)) { fallback.push(`Missing journey: ${file}`); return; }
    if (title) {
      const source = ts.createSourceFile(file, readFileSync(resolve(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
      let found = false;
      const visit = node => {
        if (ts.isCallExpression(node) && /^test(?:\.(?:only|skip|fixme))?$/.test(node.expression.getText(source))
          && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]) && node.arguments[0].text === title) found = true;
        ts.forEachChild(node, visit);
      };
      visit(source);
      if (!found) { fallback.push(`Missing named journey: ${file}: ${title}`); return; }
    }
    const key = file + ':' + (title || '*');
    if (!journeys.has(key)) journeys.set(key, { file, title: title || null, reasons: [] });
    journeys.get(key).reasons.push(reason);
  };
  const mediaJourney = reason => addJourney('e2e/beat-grid.spec.ts', null, reason);
  const focusJourney = reason => {
    addJourney('e2e/workflows.spec.ts', 'focus and Pomodoro state survives reload', reason);
    addJourney('e2e/smoke.spec.ts', 'keeps the empty browser Focus Dock and shared timer accessible', reason);
  };
  const changedFiles = [...new Set(changed.map(file => slash(file).replace(/^\.\//, '')))].sort();
  if (changedFiles.some(file => file.startsWith('/') || /^[a-z]:/i.test(file) || file.split('/').includes('..'))) throw new Error('Changed paths must be repository-relative');
  if (forceFull) fallback.push('Explicit full regression');
  if (discoveryFailure) fallback.push(discoveryFailure);
  const graph = dependencyGraph(root, files);
  let native = false, analysis = false;
  for (const file of changedFiles) {
    if (docsOnly(file)) { decisions.push({ file, reason: 'Documentation only; mandatory safety checks remain' }); continue; }
    if (critical(file)) { fallback.push(`Global build/test/CI configuration: ${file}`); continue; }
    if (!existsSync(resolve(root, file))) { fallback.push(`Deleted or unavailable path: ${file}`); continue; }
    const chain = new Map([[file, [file]]]), queue = [file];
    for (let index = 0; index < queue.length; index++) for (const consumer of graph.reverse.get(queue[index]) || []) {
      if (!chain.has(consumer)) { chain.set(consumer, [...chain.get(queue[index]), consumer]); queue.push(consumer); }
    }
    for (const test of units) if (chain.has(test)) addUnit(test, `Dependency: ${chain.get(test).join(' -> ')}`);
    const hasUnitCoverage = units.some(test => chain.has(test));
    let known = hasUnitCoverage;
    const boundary = queue.find(contract);
    if (boundary) {
      native = analysis = known = true;
      units.filter(sharedTest).forEach(test => addUnit(test, `Shared Web/Companion/Desktop/analysis contract: ${chain.get(boundary).join(' -> ')}`));
      mediaJourney(`Shared media contract: ${file}`); focusJourney(`Shared dock contract: ${file}`);
    }
    if (queue.some(value => /^src\/features\/music\//.test(value) || /^extensions\/kanban-music\//.test(value))) { known = true; mediaJourney(`Music dependency: ${file}`); }
    if (queue.some(value => /^src\/(features\/focus|components\/focus)\//.test(value) || /pomodoro|focusSession/i.test(value))) { known = true; focusJourney(`Focus dependency: ${file}`); mediaJourney(`Shared dock: ${file}`); }
    if (/^src\/(app\/|routes\/|shared\/|components\/layout\/)/.test(file)
      || queue.some(value => /^src\/(features\/(auth|workspace)|components\/(auth|workspace)|contexts\/Auth|lib\/supabase|i18n\/)/.test(value))) {
      known = true; browser.forEach(test => addJourney(test, null, `Shared application/auth/navigation: ${file}`));
    }
    if (queue.some(value => /^src\/components\/organisms\/toast\//.test(value))) {
      known = true; addJourney('e2e/toasts.spec.ts', null, `Notification dependency: ${file}`);
    }
    if (/^src\/components\/(home\/|organisms\/HomeDashboard)/.test(file)) {
      known = true; addJourney('e2e/briefing.spec.ts', null, `Home interaction: ${file}`);
      addJourney('e2e/smoke.spec.ts', 'loads Home without uncaught page errors', `Home interaction: ${file}`);
    }
    if (queue.some(value => /^src\/features\/(board|boards|tasks|today)\//.test(value) || /^src\/components\/(task|organisms\/.*(Task|Board))/.test(value))) {
      known = true;
      ['e2e/workflows.spec.ts', 'e2e/briefing.spec.ts', 'e2e/task-breakdown.spec.ts'].forEach(test => addJourney(test, null, `Task/board dependency: ${file}`));
    }
    if (/^e2e\/.*\.spec\.ts$/.test(file)) { known = true; addJourney(file, null, `Changed browser test: ${file}`); }
    if (/^public\/(about|privacy|terms)\//.test(file)) { known = true; addJourney('e2e/public-identity.spec.ts', null, `Public document: ${file}`); addJourney('e2e/public-auth.spec.ts', null, `Public/auth boundary: ${file}`); }
    if (/^supabase\/(migrations|schema|tests)\//.test(file)) fallback.push(`Database/security boundary: ${file}`);
    if (moduleFile(file) && /^(src|extensions|server|supabase)\//.test(file) && !hasUnitCoverage && !boundary) {
      fallback.push(`No reachable unit coverage for source module: ${file}`);
    }
    if (!known) fallback.push(`Unknown impact: ${file}`);
    // A nonliteral runtime dependency cannot be safely mapped to a changed asset.
    if (graph.uncertain.some(value => /^(src|extensions|server|supabase)\//.test(value))) fallback.push(`Unresolved runtime dependency: ${graph.uncertain.filter(value => /^(src|extensions|server|supabase)\//.test(value)).join(', ')}`);
  }
  const full = fallback.length > 0;
  if (full) {
    units.forEach(test => addUnit(test, `Conservative fallback: ${fallback.join('; ')}`));
    browser.forEach(test => addJourney(test, null, `Conservative fallback: ${fallback.join('; ')}`));
    native = analysis = true;
  }
  const e2e = [...journeys.values()].filter(item => item.title === null || !journeys.has(item.file + ':*')).sort((a, b) => a.file.localeCompare(b.file) || String(a.title).localeCompare(String(b.title)));
  return {
    schemaVersion: 1, changed: changedFiles, full, fallback: [...new Set(fallback)], decisions,
    mandatory: ['selector self-tests', 'full ESLint', 'full TypeScript check', 'build', 'bundle budget', 'CI database/RLS checks'],
    unit: [...selected].sort(([a], [b]) => a.localeCompare(b)).map(([file, reasons]) => ({ file, reasons: [...reasons] })),
    e2e, python: analysis ? python : [], native,
    e2eGrep: e2e.map(item => escape(posix.basename(item.file)) + '.*' + (item.title ? escape(item.title) : '')).join('|'),
  };
}

export function createPlan(root, args) {
  let changed = [], discoveryFailure;
  const baseIndex = args.indexOf('--base'), headIndex = args.indexOf('--head'), filesIndex = args.indexOf('--files');
  const git = arguments_ => execFileSync('git', arguments_, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\0').filter(Boolean);
  try {
    if (filesIndex >= 0) {
      for (let index = filesIndex + 1; index < args.length && !args[index].startsWith('--'); index++) changed.push(args[index]);
      if (!changed.length) throw new Error('No explicit changed files');
    }
    else if (baseIndex >= 0) {
      const base = args[baseIndex + 1], head = headIndex >= 0 ? args[headIndex + 1] : 'HEAD';
      if (!base || base.startsWith('-') || !head || head.startsWith('-')) throw new Error('Invalid diff refs');
      changed = git(['diff', '--name-only', '-z', '--no-renames', `${base}...${head}`, '--']);
    } else changed = [...git(['diff', 'HEAD', '--name-only', '-z', '--no-renames']), ...git(['ls-files', '--others', '--exclude-standard', '-z'])];
  } catch { discoveryFailure = 'Change discovery failed; full regression required'; }
  let files;
  try { files = repositoryFiles(root); }
  catch { files = fallbackFiles(root); discoveryFailure = 'File discovery failed; full regression required'; }
  return selectTests({ root, files, changed, forceFull: args.includes('--full'), discoveryFailure });
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), plan = createPlan(process.cwd(), args), output = args.indexOf('--json');
  if (output >= 0) { mkdirSync(dirname(args[output + 1]), { recursive: true }); writeFileSync(args[output + 1], JSON.stringify(plan, null, 2) + '\n'); }
  if (args.includes('--github-output')) {
    if (!process.env.GITHUB_OUTPUT) throw new Error('GITHUB_OUTPUT is required');
    appendFileSync(process.env.GITHUB_OUTPUT, `browser=${plan.e2e.length > 0}\nanalysis=${plan.python.length > 0}\nnative=${plan.native}\nfull=${plan.full}\n`);
  }
  console.log(JSON.stringify(plan, null, 2));
}
