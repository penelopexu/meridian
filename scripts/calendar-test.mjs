/* 多历法测试：Intl 可用性、月首月名、语言默认关联、渲染集成。 */
import { loadApp, createRunner } from './_harness.mjs';
const { ctx, store } = loadApp();
const G = ctx;
const t = createRunner('多历法 / Calendars');

t.section('Intl 历法可用性');
for (const c of G.CALENDARS) {
  if (c.id === null) continue;
  if (c.id === 'chinese') { t.ok('chinese（自研引擎）', true); continue; }
  t.ok(c.id, G.calSupported(c.intl));
}
t.eq('availableCalendars 数量', G.availableCalendars().length, G.CALENDARS.length);

t.section('日期换算正确性（2026-08-18）');
const S = (id) => G.altCalendar(2026, 8, 18, id, 'en')?.sub || '';
t.ok('chinese 含干支生肖', /丙午|马年/.test(S('chinese')), S('chinese'));
t.ok('islamic 含 1448 AH', S('islamic-umalqura').includes('1448'), S('islamic-umalqura'));
t.ok('hebrew 含 5786',     S('hebrew').includes('5786'),          S('hebrew'));
t.ok('indian 含 1948',     S('indian').includes('1948'),          S('indian'));
t.ok('persian 含 1405',    S('persian').includes('1405'),         S('persian'));
t.ok('buddhist 含 2569',   S('buddhist').includes('2569'),        S('buddhist'));
t.ok('roc 含 115',         S('roc').includes('115'),              S('roc'));
t.eq('null 返回 null', G.altCalendar(2026,8,18,null,'en'), null);

t.section('月首显示月名');
for (const [cal, want] of [['islamic-umalqura','Rabi'],['hebrew','Elul']]) {
  const found = [];
  for (let d = 10; d <= 25; d++) {
    const r = G.altCalendar(2026, 8, d, cal, 'en');
    if (r?.isFirst) found.push(r.main);
  }
  t.ok(`${cal} 月首出现月名`, found.some(x => x.includes(want)), found.join(','));
}
const c1 = G.altCalendar(2026, 8, 17, 'chinese', 'zh-CN');   // 七月初一？
let firstFound = false;
for (let d = 1; d <= 31; d++) {
  const r = G.altCalendar(2026, 8, d, 'chinese', 'zh-CN');
  if (r?.isFirst) { firstFound = true; t.ok(`chinese 月首显示月名 (8/${d})`, /月$/.test(r.main), r.main); }
}
t.ok('chinese 当月有月首', firstFound);

t.section('语言默认关联');
for (const [lang, want] of Object.entries(G.LANG_DEFAULT_CALENDAR))
  t.eq(`${lang} 默认`, G.resolveCalendar('auto', lang), want);
t.eq('显式选择优先于默认', G.resolveCalendar('hebrew', 'zh-CN'), 'hebrew');
t.eq('显式选 null 生效', G.resolveCalendar(null, 'zh-CN'), null);

t.section('渲染集成：切历法后日历不崩');
G.S.cur = G.DEFAULT_PLACE; G.S.favs = [G.DEFAULT_PLACE]; G.S.primary = G.DEFAULT_PLACE.id;
G.S.wx = null; G.S.wxErr = null;
let bad = 0;
for (const cal of [...G.CALENDARS.map(c => c.id), 'auto']) {
  G.S.calendar = cal === null ? null : cal;
  for (const v of ['day','week','month','year']) {
    G.S.view = v; G.S.cursor = new Date(2026, 7, 1);
    try { G.renderCal(); } catch (e) { bad++; t.info(`${cal}/${v}: ${e.message}`); }
  }
  try { G.renderConv(); } catch (e) { bad++; t.info(`${cal}/conv: ${e.message}`); }
}
t.eq('13 种历法 × 4 视图 + 互转面板', bad, 0);

t.section('九种语言 × 各自默认历法');
bad = 0;
for (const L of G.LOCALES) {
  G.setLang(L); G.S.lang = L; G.S.calendar = 'auto';
  for (const v of ['month','year']) {
    G.S.view = v;
    try { G.renderCal(); G.renderCalPicker(); G.renderConv(); }
    catch (e) { bad++; t.info(`${L}/${v}: ${e.message}`); }
  }
}
t.eq('无异常', bad, 0);
G.setLang('zh-CN'); G.S.lang = 'zh-CN'; G.S.calendar = 'auto';

t.section('日历格子里没有未替换占位符');
G.S.view = 'month'; G.S.cursor = new Date(2026, 7, 1);
for (const cal of ['chinese','islamic-umalqura','hebrew',null]) {
  G.S.calendar = cal; G.renderCal();
  const m = String(store['#calBody'] || '').match(/\{[a-zA-Z]\w*\}/g);
  t.eq(`${cal || '(无)'} 无残留占位符`, m ? m.length : 0, 0);
}
G.S.calendar = 'auto';


/* ---------- 择历：地点优先、语言兜底 ---------- */
t.section('按地点选历法');
{
  const R = (choice, lang, place) => ctx.resolveCalendar(choice, lang, place);
  const CN={cc:'CN'}, GB={cc:'GB'}, KR={cc:'KR'}, JP={cc:'JP'},
        IR={cc:'IR'}, TH={cc:'TH'}, SA={cc:'SA'}, TW={cc:'TW'}, US={cc:'US'};

  /* 1. 地点有本土历法 —— 界面什么语言都显示它 */
  t.eq('北京 + 英文 → 农历', R('auto','en',CN), 'chinese');
  t.eq('北京 + 中文 → 农历', R('auto','zh-CN',CN), 'chinese');
  t.eq('首尔 + 英文 → 檀纪', R('auto','en',KR), 'dangi');
  t.eq('东京 + 英文 → 和历', R('auto','en',JP), 'japanese');
  t.eq('德黑兰 + 英文 → 波斯历', R('auto','en',IR), 'persian');
  t.eq('曼谷 + 英文 → 佛历', R('auto','en',TH), 'buddhist');
  t.eq('利雅得 + 英文 → 伊斯兰历', R('auto','en',SA), 'islamic-umalqura');
  t.eq('台北 → 民国纪年', R('auto','en',TW), 'roc');

  /* 2. 地点没有本土历法 —— 看界面语言 */
  t.eq('伦敦 + 英文 → 不显示（这正是原先的 bug）', R('auto','en',GB), null);
  t.eq('伦敦 + 中文 → 农历（中文用户在国外仍要看农历）', R('auto','zh-CN',GB), 'chinese');
  t.eq('伦敦 + 阿拉伯语 → 伊斯兰历', R('auto','ar',GB), 'islamic-umalqura');
  t.eq('纽约 + 英文 → 不显示', R('auto','en',US), null);
  t.eq('纽约 + 日语 → 和历', R('auto','ja',US), 'japanese');

  /* 3. 用户显式选过就听他的，地点和语言都不再插手 */
  t.eq('显式选希伯来历，在北京也照用', R('hebrew','zh-CN',CN), 'hebrew');
  t.eq('显式选「不显示」，在北京也不显示', R(null,'zh-CN',CN), null);

  /* 4. 地点缺失时不能崩 */
  t.eq('无地点 + 中文 → 农历', R('auto','zh-CN',undefined), 'chinese');
  t.eq('无地点 + 英文 → 不显示', R('auto','en',null), null);
  t.eq('地点没有国家码 → 退回语言', R('auto','zh-CN',{lat:1,lon:1}), 'chinese');
  t.eq('国家码小写也认', R('auto','en',{cc:'cn'}), 'chinese');

  /* 5. 表里的历法 id 必须都是真实存在的，否则会静默不显示 */
  const known = new Set(ctx.CALENDARS.map(c => String(c.id)));
  const bad = Object.entries(ctx.CC_DEFAULT_CALENDAR)
    .filter(([, v]) => !known.has(String(v))).map(([k, v]) => k + '→' + v);
  t.eq('国家表里的历法 id 都在 CALENDARS 中' + (bad.length ? '：' + bad.join(' ') : ''), bad.length, 0);
}


/* ---------- 节日地区：地点优先、语言兜底、可手选 ---------- */
t.section('节日地区');
{
  const pick = (choice, lang, cc) => {
    ctx.S.holRegion = choice; ctx.S.lang = lang;
    ctx.S.cur = Object.assign({}, ctx.S.cur, {cc});
    return ctx.holidayRegion();
  };
  const before = {r: ctx.S.holRegion, l: ctx.S.lang, c: ctx.S.cur};

  /* 1. 地点的国家有节日规则 → 用地点的 */
  t.eq('在东京 + 中文界面 → 日本节日', pick('auto','zh-CN','JP'), 'JP');
  t.eq('在纽约 + 中文界面 → 美国节日', pick('auto','zh-CN','US'), 'US');
  t.eq('在北京 + 英文界面 → 中国节日', pick('auto','en','CN'), 'CN');

  /* 2. 那个国家没有规则 → 退回界面语言。
        肯尼亚不在 28 国里，这时中文用户看中国节日比看一片空白有用 */
  t.eq('在内罗毕 + 中文 → 退回中国', pick('auto','zh-CN','KE'), 'CN');
  t.eq('在内罗毕 + 日语 → 退回日本', pick('auto','ja','KE'), 'JP');
  t.eq('在内罗毕 + 英文 → 退回美国', pick('auto','en','KE'), 'US');
  t.eq('在内罗毕 + 繁体中文 → 退回台湾', pick('auto','zh-TW','KE'), 'TW');

  /* 3. 用户手选就听他的，地点和语言都不再插手 */
  t.eq('手选法国，人在北京也看法国节日', pick('FR','zh-CN','CN'), 'FR');
  t.eq('手选中国，人在纽约也看中国节日', pick('CN','en','US'), 'CN');

  /* 4. 地点缺国家码时不能崩 */
  t.ok('没有国家码也能给出一个地区', !!pick('auto','zh-CN',''));

  /* 5. 下拉框里列出的地区必须都真有规则，否则选了会是空列表 */
  const regions = ctx.holidayRegions();
  t.ok(`列出 ${regions.length} 个地区`, regions.length >= 28);
  t.eq('中国排在第一（它有独有的放假调休数据）', regions[0], 'CN');
  const noRule = regions.filter(c => c !== 'CN' && !ctx.COUNTRY_RULES[c]);
  t.eq('列出的地区都有节日规则' + (noRule.length ? '：' + noRule.join(' ') : ''), noRule.length, 0);
  t.eq('没有重复项', regions.length, new Set(regions).size);

  /* 6. 语言兜底表里的国家也必须真有规则 */
  const badLang = Object.entries(ctx.LANG_HOLIDAY_CC)
    .filter(([, cc]) => cc !== 'CN' && !ctx.COUNTRY_RULES[cc]).map(([l, cc]) => l + '→' + cc);
  t.eq('语言兜底表指向的地区都有规则' + (badLang.length ? '：' + badLang.join(' ') : ''), badLang.length, 0);
  const missing = (ctx.LOCALES || []).filter(l => !ctx.LANG_HOLIDAY_CC[l]);
  t.eq('每种语言都有兜底地区' + (missing.length ? '：缺 ' + missing.join(' ') : ''), missing.length, 0);

  ctx.S.holRegion = before.r; ctx.S.lang = before.l; ctx.S.cur = before.c;
}

process.exit(t.done() ? 1 : 0);
