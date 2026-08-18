/* 语法与全局重名检查。项目把 src/js/*.js 顺序拼接后全局执行，
   所以「顶层重名」会静默覆盖，是这种架构最大的风险，必须自动检查。 */
import { bundleSource, topLevelNames, createRunner } from './_harness.mjs';
import vm from 'node:vm';

const t = createRunner('语法与命名 / Syntax & naming');
const { src, files } = bundleSource();

t.section('语法');
try { new vm.Script(src, { filename: 'bundle.js' }); t.ok(`拼接后可解析（${files.length} 个模块）`, true); }
catch (e) { t.ok('拼接后可解析', false, e.message); }

t.section('全局命名冲突');
const seen = new Map(), dup = [];
for (const f of files) {
  const { src: one } = { src: '' };
  void one;
}
import('node:fs').then(() => {});
const { readFileSync } = await import('node:fs');
const { join } = await import('node:path');
const { ROOT } = await import('./_harness.mjs');
for (const f of files) {
  const code = readFileSync(join(ROOT, 'src', 'js', f), 'utf8');
  for (const n of topLevelNames(code)) {
    if (seen.has(n)) dup.push(`${n} (${seen.get(n)} ↔ ${f})`);
    else seen.set(n, f);
  }
}
t.eq('无重名顶层声明', dup.length, 0);
if (dup.length) dup.forEach(d => t.info(d));
t.info(`共 ${seen.size} 个顶层标识符`);

t.section('构建产物');
const { existsSync } = await import('node:fs');
t.ok('build.mjs 存在', existsSync(join(ROOT, 'build.mjs')));
t.ok('LICENSE 存在', existsSync(join(ROOT, 'LICENSE')));
t.ok('NOTICE 存在', existsSync(join(ROOT, 'NOTICE')));
t.ok('licenses/OFL.txt 存在', existsSync(join(ROOT, 'licenses', 'OFL.txt')));

process.exit(t.done() ? 1 : 0);
