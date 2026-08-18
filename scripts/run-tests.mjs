/* 测试总入口：npm test
   联网测试（i18n 里有实网拉取）失败不阻断，用 --offline 可完全跳过。 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const offlineOnly = process.argv.includes('--offline');

const SUITES = [
  { file: 'syntax-check.mjs', name: '语法与命名', net: false },
  { file: 'lunar-test.mjs',   name: '农历引擎',   net: false },
  { file: 'offline-test.mjs', name: '离线核心',   net: false },
  { file: 'calendar-test.mjs',name: '多历法',     net: false },
  { file: 'alert-test.mjs',   name: '预警源',     net: false },
  { file: 'i18n-test.mjs',    name: '多语言',     net: true  },
  /* 放最后：CSP 那部分要读 dist/，得先构建 */
  { file: 'a11y-test.mjs',    name: '无障碍与 CSP', net: false, needsBuild: true },
  { file: 'zh-regression.mjs',name: '界面快照',     net: false }
];

let failed = 0, skipped = 0;
for (const s of SUITES) {
  const p = join(here, s.file);
  if (!existsSync(p)) { console.log(`\n跳过 ${s.name}（${s.file} 不存在）`); skipped++; continue; }
  if (s.net && offlineOnly) { console.log(`\n跳过 ${s.name}（--offline）`); skipped++; continue; }
  if (s.needsBuild) {
    const b = spawnSync(process.execPath, [join(here, '..', 'build.mjs')], { stdio: 'ignore' });
    if (b.status !== 0) { console.log(`\n\x1b[31m✗ 构建失败，无法测 CSP\x1b[0m`); failed++; continue; }
  }
  const r = spawnSync(process.execPath, [p], { stdio: 'inherit' });
  if (r.status !== 0) {
    if (s.net) { console.log(`\n\x1b[33m⚠ ${s.name} 失败，但它依赖网络，不阻断\x1b[0m`); skipped++; }
    else failed++;
  }
}
console.log(`\n${'='.repeat(50)}`);
console.log(failed ? `\x1b[31m✗ ${failed} 个套件失败\x1b[0m`
                   : `\x1b[32m✓ 全部通过\x1b[0m${skipped ? `（${skipped} 个跳过）` : ''}`);
process.exit(failed ? 1 : 0);
