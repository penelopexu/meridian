/* 农历引擎测试：不依赖网络，可在 CI 里跑。
   包含三层验证：
     1) 自洽：公历↔农历往返、闰月、边界
     2) 锚点：与公开历书记载的春节、闰月对照
     3) 交叉：与 ICU（Intl 的 chinese 日历）逐日比对，分歧写入报告
   第 3 项**不作为失败条件**——已知 ICU 在闰月标号上与传统规则有出入，
   详见 docs/lunar-vs-icu.md 与对应 issue。 */
import { loadApp, createRunner, ROOT } from './_harness.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const { ctx } = loadApp();
const { solarToLunar, lunarToSolar, lunarLeapOf, leapDays, monthDays, yearTerms } = ctx;
const t = createRunner('农历引擎 / Lunar engine');

/* ---------- 1. 自洽 ---------- */
t.section('往返一致性（1900–2100 全量）');
let n = 0, bad = 0, firstBad = null;
for (let y = 1900; y <= 2100; y++) {
  const leap = lunarLeapOf(y);
  for (let m = 1; m <= 12; m++) {
    for (const isL of (leap === m ? [false, true] : [false])) {
      const dim = isL ? leapDays(y) : monthDays(y, m);
      for (const d of [1, Math.max(1, Math.floor(dim / 2)), dim]) {
        const s = lunarToSolar(y, m, d, isL);
        n++;
        if (!s) { bad++; firstBad ??= `lunarToSolar(${y},${m},${d},${isL}) → null`; continue; }
        if (s.getUTCFullYear() > 2100) continue;
        const b = solarToLunar(s.getUTCFullYear(), s.getUTCMonth() + 1, s.getUTCDate());
        if (!b || b.lYear !== y || b.lMonth !== m || b.lDay !== d || !!b.isLeap !== !!isL) {
          bad++; firstBad ??= `${y}-${m}-${d}(leap=${isL}) → ${s.toISOString().slice(0,10)} → ${b?.lYear}-${b?.lMonth}-${b?.lDay}`;
        }
      }
    }
  }
}
t.eq(`往返 ${n} 组无误差`, bad, 0);
if (bad) t.info(firstBad);

t.section('边界');
t.eq('1900-01-01 越界返回 null', solarToLunar(1900, 1, 1), null);
t.eq('1900-01-30 越界返回 null', solarToLunar(1900, 1, 30), null);
t.ok('1900-01-31 是正月初一',
  solarToLunar(1900,1,31)?.monthCN + solarToLunar(1900,1,31)?.dayCN === '正月初一');
t.ok('2100-12-31 可用', !!solarToLunar(2100, 12, 31));
t.eq('2101-01-01 越界返回 null', solarToLunar(2101, 1, 1), null);
t.eq('不存在的闰月返回 null', lunarToSolar(2026, 5, 1, true), null);
t.eq('小月第 30 天返回 null', lunarToSolar(2026, 2, 30, false), null);

/* ---------- 2. 锚点 ---------- */
t.section('春节日期（对照公开历书）');
const SPRING = {
  1900:'1900-01-31', 1917:'1917-01-23', 1922:'1922-01-28', 1933:'1933-01-26',
  1954:'1954-02-03', 1955:'1955-01-24', 1987:'1987-01-29', 1999:'1999-02-16',
  2000:'2000-02-05', 2012:'2012-01-23', 2018:'2018-02-16', 2020:'2020-01-25',
  2023:'2023-01-22', 2024:'2024-02-10', 2025:'2025-01-29', 2026:'2026-02-17',
  2027:'2027-02-06', 2033:'2033-01-31', 2100:'2100-02-09'  /* 自研引擎与 ICU 一致 */
};
for (const [y, want] of Object.entries(SPRING)) {
  const got = lunarToSolar(+y, 1, 1, false)?.toISOString().slice(0, 10);
  t.eq(`${y} 春节`, got, want);
}

t.section('闰月（对照公开历书）');
const LEAPS = { 2023:2, 2020:4, 2017:6, 2014:9, 2012:4, 2009:5, 2006:7,
                2004:2, 2001:4, 1998:5, 1987:6, 2025:6, 2028:5, 2031:3 };
for (const [y, want] of Object.entries(LEAPS)) t.eq(`${y} 闰月`, lunarLeapOf(+y), want);

t.section('二十四节气');
const TERMS = {
  2026: { '清明':'2026-04-05', '立春':'2026-02-04', '冬至':'2026-12-22', '立秋':'2026-08-07' },
  2025: { '清明':'2025-04-04', '立春':'2025-02-03', '冬至':'2025-12-21' },
  2024: { '春分':'2024-03-20', '夏至':'2024-06-21' }
};
for (const [y, m] of Object.entries(TERMS)) {
  const map = yearTerms(+y);
  for (const [name, want] of Object.entries(m)) {
    t.eq(`${y} ${name}`, Object.keys(map).find(k => map[k] === name), want);
  }
}
let termBad = 0;
for (let y = 1900; y <= 2100; y++) {
  const m = yearTerms(y);
  const days = Object.keys(m);
  if (days.length !== 24) termBad++;
  if (days.some(d => +d.slice(0, 4) !== y)) termBad++;
}
t.eq('每年恰好 24 个节气且都落在当年', termBad, 0);

/* ---------- 3. 与 ICU 交叉比对（仅生成报告，不判失败） ---------- */
t.section('与 ICU chinese 日历交叉比对（参考，不计入失败）');
const icu = d => {
  const p = {};
  new Intl.DateTimeFormat('en-u-ca-chinese',
    { year:'numeric', month:'numeric', day:'numeric', timeZone:'UTC' })
    .formatToParts(d).forEach(x => p[x.type] = x.value);
  const m = String(p.month);
  return { m: parseInt(m, 10), leap: /bis/.test(m), d: +p.day };
};
let dayDiff = 0, labelDiff = 0;
const diffYears = new Set(), rows = [];
for (let ts = Date.UTC(1901, 0, 1); ts <= Date.UTC(2099, 11, 31); ts += 864e5) {
  const dt = new Date(ts);
  const a = solarToLunar(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  if (!a) continue;
  const b = icu(dt);
  if (a.lDay !== b.d) {
    dayDiff++; diffYears.add(dt.getUTCFullYear());
    if (rows.length < 400) rows.push(`${dt.toISOString().slice(0,10)}\t${a.isLeap?'闰':''}${a.lMonth}月${a.lDay}\t${b.leap?'闰':''}${b.m}月${b.d}\t日序不同`);
  } else if (a.lMonth !== b.m || !!a.isLeap !== !!b.leap) {
    labelDiff++; diffYears.add(dt.getUTCFullYear());
    if (rows.length < 400) rows.push(`${dt.toISOString().slice(0,10)}\t${a.isLeap?'闰':''}${a.lMonth}月${a.lDay}\t${b.leap?'闰':''}${b.m}月${b.d}\t仅标号不同`);
  }
}
t.info(`日序不同 ${dayDiff} 天，仅月份标号不同 ${labelDiff} 天`);
t.info(`涉及年份 ${diffYears.size} 个：${[...diffYears].sort((a,b)=>a-b).join(', ')}`);
t.ok('分歧未扩大（日序 ≤ 400 天）', dayDiff <= 400, `${dayDiff}`);

try {
  mkdirSync(join(ROOT, 'docs'), { recursive: true });
  writeFileSync(join(ROOT, 'docs', 'lunar-vs-icu.tsv'),
    '日期\t本项目\tICU\t类型\n' + rows.join('\n') + '\n');
  t.info('明细已写入 docs/lunar-vs-icu.tsv');
} catch (e) { t.info('写报告失败: ' + e.message); }

process.exit(t.done() ? 1 : 0);
