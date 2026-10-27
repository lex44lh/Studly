// Run the unchanged standalone TS registration suite from freshly compiled sources.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const ts = require('typescript');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../../../../../apps/web');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'studly-registration-corrections-'));
for (const file of ['tests/registration.test.ts', 'src/lib/registration/draft.ts', 'src/lib/telegram/profile-prefill.ts']) {
  const target = path.join(output, file.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText);
}
const result = spawnSync(process.execPath, ['--test', path.join(output, 'tests/registration.test.js')], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
