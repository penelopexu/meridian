/* i18n 验收脚本：node scripts/i18n-test.mjs

   项目支持 9 种语言（含阿拉伯语 RTL）。这个脚本逐项检查：
     1  LOCALES 的内容与顺序
     2  每种语言是否补齐了 zh-CN 的每一个叶子 key（含嵌套对象与数组）
     3  插值占位符 {xxx} 是否一一对应
     4  9 种语言跑完全部渲染函数后，输出的 HTML 里有没有没替换掉的 {xxx}
     5  9 种语言下 13 个渲染函数 + 4 个视图的异常数
     6  RTL：isRTL() 与 <html dir>
     7  LANG_DEFAULT_CALENDAR 的 key 集合
     8  抽样打印译文，供人工复核

   加载方式与浏览器一致（拼接后全局执行），见 scripts/_harness.mjs。       */
import { loadApp, createRunner } from './_harness.mjs';

const { ctx: A, store, attrs } = loadApp();
const t = createRunner('多语言验收 / i18n acceptance');

const WANT = ['zh-CN','zh-TW','en','ja','ko','es','fr','de','ar'];
const typeOf = v => Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v);

/* ===================== 1. LOCALES ===================== */
t.section('1. LOCALES / LANG_NAMES');
t.info('LOCALES = ' + JSON.stringify(A.LOCALES));
t.eq('LOCALES 恰好 9 项', A.LOCALES.length, 9);
t.eq('顺序与约定一致', A.LOCALES, WANT);
for (const l of WANT) t.ok(`LANG_NAMES['${l}'] 有显示名`, !!A.LANG_NAMES[l], A.LANG_NAMES[l] || '(缺失)');
t.eq('LANG_NAMES 没有多余 key',
     Object.keys(A.LANG_NAMES).filter(k => !WANT.includes(k)).length, 0);

/* ===================== 2. key 覆盖 ===================== */
t.section('2. 每种语言是否补齐 zh-CN 的所有叶子 key');
const zh = A.STRINGS['zh-CN'];

/* 把语言包摊平成 路径 → 值，数组用 key[i] 表示 */
function flatten(o, prefix = '', out = {}) {
  for (const k of Object.keys(o)) {
    const v = o[k], p = prefix ? prefix + '.' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, p, out);
    else out[p] = v;
  }
  return out;
}
const zhFlat = flatten(zh);
const zhLeafCount = Object.keys(zhFlat).reduce(
  (n, p) => n + (Array.isArray(zhFlat[p]) ? zhFlat[p].length : 1), 0);
t.info(`zh-CN：${Object.keys(zh).length} 个顶层 key，${Object.keys(zhFlat).length} 条路径，${zhLeafCount} 条可翻译叶子`);

let coverBad = 0;
for (const lang of WANT) {
  if (lang === 'zh-CN') continue;
  const pk = A.STRINGS[lang];
  const flat = flatten(pk);
  const missing = [], typeBad = [], lenBad = [];
  for (const p of Object.keys(zhFlat)) {
    if (!(p in flat)) { missing.push(p); continue; }
    const tz = typeOf(zhFlat[p]), tl = typeOf(flat[p]);
    if (tz !== tl) { typeBad.push(`${p}: zh=${tz} ${lang}=${tl}`); continue; }
    if (tz === 'array' && zhFlat[p].length !== flat[p].length)
      lenBad.push(`${p}: zh=${zhFlat[p].length} ${lang}=${flat[p].length}`);
  }
  const extra = Object.keys(flat).filter(p => !(p in zhFlat));
  const bad = missing.length + typeBad.length + lenBad.length;
  coverBad += bad;
  t.ok(`${lang}：缺失 ${missing.length} · 类型不一致 ${typeBad.length} · 数组长度不一致 ${lenBad.length}`, bad === 0);
  if (missing.length) t.info('缺失: ' + missing.join(', '));
  if (typeBad.length) t.info('类型: ' + typeBad.join(', '));
  if (lenBad.length)  t.info('长度: ' + lenBad.join(', '));
  if (extra.length)   t.info(`${lang} 独有（不算错，仅提示）: ` + extra.join(', '));
}
t.eq('9 种语言结构问题总数', coverBad, 0);

/* ===================== 3. 占位符一致性 ===================== */
t.section('3. 插值占位符一致性');
/* 日期格式这几条是有意不同的：中文用数字月 {m}，西文用月名 {mn}。
   所有调用点都同时传 m 和 mn，不会漏插值；第 4 节还会扫渲染结果兜底。 */
const PH_EXEMPT = new Set(['dateLong','dateCompact','dateMD','yearMonth','yearMonthShort','monthN','climDateLabel']);
const phOf = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();
let phBadTotal = 0, phNoteTotal = 0;
for (const lang of WANT) {
  if (lang === 'zh-CN') continue;
  const flat = flatten(A.STRINGS[lang]);
  const bad = [], note = [];
  for (const p of Object.keys(zhFlat)) {
    const a = zhFlat[p], b = flat[p];
    if (typeof a !== 'string' || typeof b !== 'string') continue;
    const pa = phOf(a), pb = phOf(b);
    if (pa.join(',') === pb.join(',')) continue;
    const bucket = PH_EXEMPT.has(p) ? note : bad;
    const miss = pa.filter(x => !pb.includes(x)), more = pb.filter(x => !pa.includes(x));
    bucket.push(`${p}: ${miss.length ? '缺 {' + miss.join('} {') + '}' : ''}${more.length ? ' 多 {' + more.join('} {') + '}' : ''}  →  "${b}"`);
  }
  phBadTotal += bad.length; phNoteTotal += note.length;
  t.ok(`${lang}：占位符不一致 ${bad.length} 项`, bad.length === 0);
  bad.forEach(x => t.info(x));
  if (note.length) t.info(`（豁免：${note.length} 项日期格式差异，{m} 数字月 vs {mn} 月名）`);
}
t.eq('占位符不一致总数（豁免项除外）', phBadTotal, 0);
t.info(`日期格式豁免项共 ${phNoteTotal} 条`);

/* ===================== 准备渲染所需状态 ===================== */
A.load();
A.S.cur = A.S.favs[0];
const place = A.S.cur;
t.info(`测试地点：${place.name} ${place.lat},${place.lon} ${place.tz}`);
try {
  A.S.wx = await A.getWeather(place);
  A.S.wx._source = 'open-meteo';
  A.S.air = await A.getAir(place).catch(() => null);
  t.info(`已拉到实时数据：${A.S.wx.current.temperature_2m}°C，daily ${A.S.wx.daily.time.length} 天`);
} catch (e) {
  t.info('网络不可用，改走离线渲染路径：' + e.message);
}

const RENDERS = ['renderNow','renderAdvice','renderIntraday','renderWx','renderSrcBar','renderSource',
  'renderCal','renderConv','renderHistCtrl','renderFavs','renderClocks','renderHolidays','fillTZ'];
const VIEWS = ['day','week','month','year'];

/* ===================== 4 + 5. 逐语言跑渲染 ===================== */
t.section('4 + 5. 9 种语言 × 13 个渲染函数 × 4 个视图');
const PH_RE = /\{[a-zA-Z]\w*\}/g;
let errTotal = 0, leftoverTotal = 0;
const samples = {};

for (const lang of WANT) {
  for (const k of Object.keys(store)) delete store[k];      /* 清空上一轮的 HTML */
  A.S.lang = lang; A.setLang(lang);
  A.S.warns = A.deriveWarnings(A.S.wx, lang);
  A.applyStaticText();

  let errs = 0;
  for (const r of RENDERS) {
    try { A[r](); } catch (e) { t.info(`[${lang}] ${r} 抛异常：${e.message}`); errs++; }
  }
  for (const v of VIEWS) {
    A.S.view = v;
    try { A.renderCal(); } catch (e) { t.info(`[${lang}] 视图 ${v} 抛异常：${e.message}`); errs++; }
  }
  A.S.view = 'month';

  const leftovers = [];
  for (const sel of Object.keys(store)) {
    for (const m of String(store[sel]).match(PH_RE) || []) leftovers.push(`${sel} → ${m}`);
  }
  errTotal += errs; leftoverTotal += leftovers.length;
  t.ok(`${lang}：渲染异常 ${errs} · 残留占位符 ${leftovers.length}`, errs === 0 && leftovers.length === 0);
  leftovers.slice(0, 12).forEach(x => t.info(x));

  /* 顺手采样，第 8 节统一打印 */
  const adv = A.buildAdvice({ tNow:33, rh:70, wind:10, tMax:35, tMin:26, uv:9, elev:50 });
  const wn = A.deriveWarnings({ daily:{ temperature_2m_max:[38,36,35], temperature_2m_min:[26,25,24],
    precipitation_sum:[60,2,0], wind_speed_10m_max:[70,20,10], weather_code:[95,3,3] } }, lang);
  samples[lang] = { band: adv.band, layer0: adv.layers[0], warn: wn[0] && wn[0].title, warnDesc: wn[0] && wn[0].desc };
}
t.eq('9 种语言渲染异常总数', errTotal, 0);
t.eq('9 种语言未替换占位符总数', leftoverTotal, 0);

/* ===================== 6. RTL ===================== */
t.section('6. RTL（阿拉伯语）');
t.eq("isRTL('ar')", A.isRTL('ar'), true);
for (const l of WANT) if (l !== 'ar') t.ok(`isRTL('${l}') 为 false`, A.isRTL(l) === false);
t.eq('RTL_LANGS', A.RTL_LANGS, ['ar']);
A.S.lang = 'ar'; A.setLang('ar'); A.applyStaticText();
t.eq('切到 ar 后 <html dir>', attrs.dir, 'rtl');
t.eq('切到 ar 后 <html lang>', A.document.documentElement.lang, 'ar');
A.S.lang = 'zh-CN'; A.setLang('zh-CN'); A.applyStaticText();
t.eq('切回 zh-CN 后 <html dir>', attrs.dir, 'ltr');
A.S.lang = 'en'; A.setLang('en'); A.applyStaticText();
t.eq('切到 en 后 <html dir>', attrs.dir, 'ltr');

/* ===================== 7. 历法默认表 ===================== */
t.section('7. LANG_DEFAULT_CALENDAR');
const calKeys = Object.keys(A.LANG_DEFAULT_CALENDAR);
t.eq('key 集合与 LOCALES 完全一致', calKeys.slice().sort(), WANT.slice().sort());
t.eq('没有 LOCALES 之外的 key', calKeys.filter(k => !WANT.includes(k)).length, 0);
t.eq('没有漏掉的 LOCALES', WANT.filter(k => !calKeys.includes(k)).length, 0);
for (const l of WANT) t.info(`${l.padEnd(6)} → ${JSON.stringify(A.LANG_DEFAULT_CALENDAR[l])}`);

/* ===================== 8. 抽样打印，供人工复核 ===================== */
t.section('8. 抽样译文（请人工复核）');
console.log('\n  buildAdvice({tNow:33, rh:70, wind:10, tMax:35, tMin:26, uv:9, elev:50})');
console.log('  ' + '─'.repeat(96));
for (const l of WANT) {
  console.log(`  ${l.padEnd(6)} band = ${String(samples[l].band).padEnd(14)} layers[0] = ${samples[l].layer0}`);
}
console.log('\n  deriveWarnings 首条（38°C + 60mm 降水 + 雷暴）');
console.log('  ' + '─'.repeat(96));
for (const l of WANT) {
  console.log(`  ${l.padEnd(6)} ${String(samples[l].warn).padEnd(24)} ${samples[l].warnDesc}`);
}
console.log('\n  几条常用文案');
console.log('  ' + '─'.repeat(96));
for (const l of WANT) {
  A.setLang(l);
  console.log(`  ${l.padEnd(6)} ${A.T('appName')} | ${A.T('feelsLike')} | ${A.T('lunarPrefix')} | ` +
              `${A.T('dateLong', { y:2026, m:8, d:18, mn:A.MN(8) })} | ${A.T('daysLater', { n:3 })}`);
}
A.setLang('zh-CN');
console.log('');

/* ===================== 回归：zh-CN / en 未被破坏 ===================== */
t.section('回归：zh-CN 与 en');
A.setLang('zh-CN');
t.eq("zh-CN band 仍是「酷热」", A.buildAdvice({ tNow:39, tMax:41, tMin:28, wind:8, rh:62, uv:11, elev:44 }).band, '酷热');
t.eq("zh-CN T('feelsLike')", A.T('feelsLike'), '体感');
A.setLang('en');
t.eq("en band 仍是 Scorching", A.buildAdvice({ tNow:39, tMax:41, tMin:28, wind:8, rh:62, uv:11, elev:44 }).band, 'Scorching');
t.eq("en T('feelsLike')", A.T('feelsLike'), 'Feels like');
t.ok("en 配色文案已本地化（原先漏译回落中文）", A.T('palGolden') === 'Golden hour', A.T('palGolden'));
A.setLang('zh-CN');

process.exit(t.done() ? 1 : 0);
