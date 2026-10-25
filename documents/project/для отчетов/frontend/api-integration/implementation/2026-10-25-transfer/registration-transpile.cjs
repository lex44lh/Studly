const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = '/Users/alekspih/Projects/studly-integration';
const requireProject = createRequire(path.join(root, 'apps/web/package.json'));
const ts = requireProject('typescript');
const output = '/private/tmp/studly-transfer-20261025-1814/registration-compiled';
for (const relative of ['tests/registration.test.ts', 'src/lib/registration/draft.ts', 'src/lib/telegram/profile-prefill.ts']) {
  const source = path.join(root, 'apps/web', relative);
  const result = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    fileName: source,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  const errors = (result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {getCurrentDirectory:()=>root,getCanonicalFileName:f=>f,getNewLine:()=> '\n'}));
  const destination = path.join(output, relative.replace(/\.ts$/, '.js'));
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, result.outputText);
}
