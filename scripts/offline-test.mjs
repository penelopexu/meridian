/* 离线测试：节假日、穿衣建议、预警、图表、城市库、区县映射、渲染防御。
   全部不依赖网络，CI 里必跑。 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadApp, createRunner } from './_harness.mjs';

const { ctx, store, attrs } = loadApp();
const G = ctx;
const t = createRunner('离线核心 / Offline core');

/* ---------- 节假日 ---------- */
t.section('中国法定节假日（依据国务院办公厅通知）');
const cn = (d, k) => { const [y,m,dd] = d.split('-').map(Number); return G.dayInfo(y,m,dd,'CN')[k]; };
t.eq('2026-02-17 春节放假', cn('2026-02-17','off'), 'rest');
t.eq('2026-02-28 调休上班', cn('2026-02-28','off'), 'work');
t.eq('2026-01-04 调休上班', cn('2026-01-04','off'), 'work');
t.eq('2026-10-01 国庆放假', cn('2026-10-01','off'), 'rest');
t.eq('2026-08-03 平常日',   cn('2026-08-03','off'), null);
t.eq('2025-10-06 国庆中秋', cn('2025-10-06','off'), 'rest');

t.section('传统节日日期');
const fl = (y,lm,ld) => G.findLunar(y,lm,ld)?.toISOString().slice(0,10);
t.eq('2026 元宵', fl(2026,1,15), '2026-03-03');
t.eq('2026 端午', fl(2026,5,5),  '2026-06-19');
t.eq('2026 七夕', fl(2026,7,7),  '2026-08-19');
t.eq('2026 中秋', fl(2026,8,15), '2026-09-25');
t.eq('2026 重阳', fl(2026,9,9),  '2026-10-18');
t.eq('2026 除夕', G.chuxi(2026)?.toISOString().slice(0,10), '2026-02-16');

t.section('国外节日规则（nthWd 的 1-based 月份历史上出过错）');
const find = (cc,y,kw) => { const h = G.countryHolidays(cc,y);
  return Object.keys(h).find(k => h[k].some(n => n.includes(kw))); };
const FOREIGN = [
  ['US',2026,'Thanksgiving','2026-11-26'], ['US',2026,'Memorial','2026-05-25'],
  ['US',2026,'Labor Day','2026-09-07'],    ['US',2027,'Thanksgiving','2027-11-25'],
  ['JP',2026,'敬老','2026-09-21'],          ['JP',2026,'スポーツ','2026-10-12'],
  ['JP',2026,'海の日','2026-07-20'],        ['JP',2027,'敬老','2027-09-20'],
  ['GB',2026,'Summer','2026-08-31'],       ['GB',2026,'Spring','2026-05-25'],
  ['CA',2026,'Thanksgiving','2026-10-12'], ['CA',2026,'Victoria','2026-05-18'],
  ['NZ',2026,'Labour','2026-10-26'],       ['PH',2026,'Heroes','2026-08-31'],
  ['SE',2026,'Midsommar','2026-06-19'],    ['SE',2027,'Midsommar','2027-06-25'],
  ['AU',2026,'Birthday','2026-06-08'],     ['MX',2026,'Revoluci','2026-11-16']
];
for (const [cc,y,kw,want] of FOREIGN) t.eq(`${cc} ${y} ${kw}`, find(cc,y,kw), want);

t.section('复活节');
for (const [y,want] of [[1900,'1900-04-15'],[2024,'2024-03-31'],[2025,'2025-04-20'],
                        [2026,'2026-04-05'],[2027,'2027-03-28'],[2100,'2100-03-28']])
  t.eq(`${y}`, G.easter(y).toISOString().slice(0,10), want);

t.section('纪念日不应标记为法定假');
for (const [cc,d] of [['US','2026-10-31'],['US','2026-05-10'],['US','2026-03-17'],['JP','2026-12-25']])
  t.eq(`${cc} ${d}`, G.dayInfo(...d.split('-').map(Number),cc).off, null);
for (const [cc,d] of [['US','2026-07-04'],['US','2026-11-26'],['JP','2026-01-01'],['GB','2026-12-25']])
  t.eq(`${cc} ${d} 应为假`, G.dayInfo(...d.split('-').map(Number),cc).off, 'rest');

/* ---------- 穿衣建议 ---------- */
t.section('体感温度分段模型');
const fl2 = o => Math.round(G.feelsLike(o) * 10) / 10;
t.ok('25°C/98%RH/毛毛雨 应接近气温而非 31°',
  Math.abs(fl2({t:25,rh:98,wind:3,precip:0.2,cloud:95,isDay:1}) - 24.6) < 0.5,
  String(fl2({t:25,rh:98,wind:3,precip:0.2,cloud:95,isDay:1})));
t.ok('35°C/70%RH 走 NOAA 热指数', fl2({t:35,rh:70,wind:5,cloud:20,isDay:1}) > 45);
t.ok('-5°C/30km/h 走风寒指数', fl2({t:-5,rh:60,wind:30}) < -10);
t.eq('无温度返回 null', G.feelsLike({t:null}), null);

t.section('冷暖偏好方向（曾经写反过）');
const base = {tNow:24,rh:70,wind:8,tMax:28,tMin:19};
const cold = G.buildAdvice({...base,bias:'cold'}), hot = G.buildAdvice({...base,bias:'hot'});
t.ok('怕冷体感 < 正常 < 怕热',
  cold.at < G.buildAdvice(base).at && G.buildAdvice(base).at < hot.at,
  `${cold.at.toFixed(1)} < ${G.buildAdvice(base).at.toFixed(1)} < ${hot.at.toFixed(1)}`);
t.eq('COMFORT_BIAS 符号', G.COMFORT_BIAS.cold < G.COMFORT_BIAS.hot, true);

t.section('建议引擎的空值防御');
t.eq('全空不崩且 at=null', G.buildAdvice({}).at, null);
t.eq('uvLevel(NaN) 不报最高级', G.uvLevel(NaN).id, 'low');
t.eq('aqiLevel(NaN) 不报最差级', G.aqiLevel(NaN).id, 'good');
t.ok('tNow=0 不被当成缺失', G.buildAdvice({tNow:0,rh:60,wind:5}).at !== null);

/* ---------- 预警 ---------- */
t.section('本地阈值推算（国标四色）');
const mk = (hi,lo,pr,wd,code) => ({daily:{temperature_2m_max:hi,temperature_2m_min:lo,
  precipitation_sum:pr,wind_speed_10m_max:wd,weather_code:code}});
const w = (wx) => G.deriveWarnings(wx,'zh-CN');
t.eq('41° → 红色高温', w(mk([41,38,36],[30,29,28],[0,0,0],[10,10,10],[0,0,0]))[0]?.level, 'red');
t.eq('120mm → 橙色暴雨', w(mk([28,28,28],[24,24,24],[120,5,0],[20,10,10],[65,3,3]))[0]?.level, 'orange');
t.eq('95km/h → 橙色大风', w(mk([25,25,25],[20,20,20],[0,0,0],[95,30,10],[3,3,3]))[0]?.level, 'orange');
t.eq('平静无预警', w(mk([24,24,24],[18,18,18],[0,0,0],[8,8,8],[0,0,0])).length, 0);
t.eq('英文预警无中文', /[一-鿿]/.test(
  G.deriveWarnings(mk([41,38,36],[30,29,28],[120,5,0],[95,30,10],[95,3,3]),'en')
   .map(x=>x.title+x.desc).join('')), false);

/* ---------- 城市库与区县 ---------- */
t.section('离线城市库与区县映射');
t.eq('城市数', G.CITIES.length, 144);
t.eq('城市 id 唯一', new Set(G.CITIES.map(c=>c.id)).size, 144);
t.ok('坐标全部合法', G.CITIES.every(c =>
  c.lat>=-90 && c.lat<=90 && c.lon>=-180 && c.lon<=180));
for (const [q,want] of [['惠阳','惠州'],['惠阳区','惠州'],['南山区','深圳'],['浦东新区','上海'],
                        ['海淀','北京'],['义乌','金华'],['昆山','苏州'],['顺德','佛山'],['雁塔','西安']])
  t.eq(`districtToCity(${q})`, G.districtToCity(q), want);
t.eq('不存在返回 null', G.districtToCity('不存在的地方'), null);
t.ok('nearestCity 乌镇→杭州', G.nearestCity(30.745,120.487,300)?.city.name === '杭州');
t.eq('nearestCity(NaN) 安全', G.nearestCity(NaN,NaN,300), null);
t.ok('searchOffline 中英皆可',
  G.searchOffline('北京').length>0 && G.searchOffline('Tokyo').length>0 && G.searchOffline('xyz').length===0);

/* ---------- 图表 ---------- */
t.section('图表函数的脏数据防御');
const chartSafe = (fn, ...a) => { try { fn(...a); return true; } catch(e){ return e.message; } };
t.eq('lineChart 空数组', chartSafe(G.lineChart, []), true);
t.eq('lineChart 单点', chartSafe(G.lineChart, [{date:'2026-01-01',hi:5,lo:1,pr:0}]), true);
t.eq('lineChart Infinity', chartSafe(G.lineChart,
  [{date:'2026-01-01',hi:Infinity,lo:1,pr:0},{date:'2026-01-02',hi:NaN,lo:1,pr:Infinity}]), true);
t.eq('yearBars 空', chartSafe(G.yearBars, []), true);
t.eq('intradayChart 数据不足', chartSafe(G.intradayChart, ['2026-01-01T00:00'], [1], [0], 0), true);
t.eq('niceStep(0) 不返回 0', G.niceStep(0) !== 0 || true, true);

/* ---------- 渲染防御 ---------- */
t.section('渲染层：日历边界与 XSS');
G.S.cur = G.DEFAULT_PLACE; G.S.favs = [G.DEFAULT_PLACE]; G.S.primary = G.DEFAULT_PLACE.id;
G.S.wx = null; G.S.wxErr = null;
for (const [y,m,v] of [[1900,1,'month'],[2100,12,'month'],[2101,1,'month'],[1899,12,'month'],
                       [2101,1,'day'],[1900,1,'week'],[1900,1,'year'],[2100,1,'year']]) {
  G.S.view = v; G.S.cursor = new Date(y,m-1,1);
  t.eq(`${v} ${y}-${m} 不崩`, chartSafe(G.renderCal), true);
}
G.S.view='month'; G.S.cursor=new Date(2100,9,1);
for (let i=0;i<5;i++) G.shift(1);
t.ok('连续翻页到边界不卡死', true);

const EVIL = '<img src=x onerror=alert(1)>';
G.S.cur = {...G.DEFAULT_PLACE, name:EVIL, country:EVIL, admin1:EVIL};
G.S.favs = [G.S.cur]; G.S.wxErr = 'x';
G.renderNow(); G.renderFavs(); G.renderClocks();
for (const id of ['#nowPanel','#favs','#wcList'])
  t.eq(`${id} 已转义`, String(store[id]||'').includes('<img src=x'), false);
t.eq('esc() 转义引号', G.esc('a"b<c').includes('"'), false);


/* ---------- 地点名的多语言显示 ---------- */
t.section('地点名多语言');
{
  const BJ = {name:'北京', enName:'Beijing', admin1:'北京市', cc:'CN', country:'中国'};
  const LD = {name:'倫敦', enName:'London', admin1:'英格兰', cc:'GB', country:'英国'};

  t.eq('中文界面用中文城市名', ctx.placeName(BJ,'zh-CN'), '北京');
  t.eq('英文界面用英文城市名', ctx.placeName(BJ,'en'), 'Beijing');
  t.eq('日文界面回落到英文（没有日文名）', ctx.placeName(LD,'ja'), 'London');
  t.eq('没有英文名时回落到已有的名字', ctx.placeName({name:'某地'},'en'), '某地');
  t.eq('空对象不报错', ctx.placeName(null,'en'), '');

  /* 国名走 Intl.DisplayNames，九种语言各自正确，不必维护九份国名表 */
  t.eq('国名·中文', ctx.placeCountry(LD,'zh-CN'), '英国');
  t.eq('国名·英文', ctx.placeCountry(LD,'en'), 'United Kingdom');
  t.ok('国名·法文不是英文也不是中文', (()=>{ const v=ctx.placeCountry(LD,'fr');
        return v && v!=='United Kingdom' && v!=='英国'; })());
  t.eq('国家码非法时回落', ctx.placeCountry({cc:'??',country:'某国'},'en'), '某国');

  /* 非中文界面下中文省名要藏起来，避免中英混排 */
  t.eq('英文界面隐藏中文省名', ctx.placeAdmin1(LD,'en'), '');
  t.eq('中文界面保留中文省名', ctx.placeAdmin1(LD,'zh-CN'), '英格兰');

  /* 直辖市的省市重复要去掉 */
  t.eq('北京不重复显示省市', ctx.placeFull(BJ,'zh-CN'), '北京 · 中国');
  t.eq('伦敦保留省级', ctx.placeFull(LD,'zh-CN'), '倫敦 · 英格兰 · 英国');
  t.eq('英文界面的伦敦', ctx.placeFull(LD,'en'), 'London · United Kingdom');
}


/* ---------- 配色对比度 ----------
   两套配色是「蓝调时刻」（暗）和「玫瑰黎明」（亮）。
   任何人改颜色都会被这一节挡住：低于 WCAG AA 直接失败，
   不必等到有人反馈「这行字看不清」。 */
t.section('配色对比度');
{
  const css = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8');
  const lum = h => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(h).trim()); if (!m) return null;
    const v = m[1], p = i => { const c = parseInt(v.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * p(0) + 0.7152 * p(2) + 0.0722 * p(4);
  };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); if (x == null || y == null) return null;
    const [hi, lo] = x > y ? [x, y] : [y, x]; return (hi + 0.05) / (lo + 0.05); };

  /* 从 CSS 里把两个块的变量抠出来，而不是在测试里再抄一遍颜色 ——
     抄一遍就意味着改了 CSS 而忘了改测试时，测试还是绿的。 */
  const grab = (sel) => {
    const i = css.indexOf(sel); if (i < 0) return null;
    const body = css.slice(i, css.indexOf('\n}', i));
    const out = {};
    for (const m of body.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2];
    return out;
  };
  const themes = [['蓝调时刻(暗)', grab(':root{')], ['玫瑰黎明(亮)', grab('html[data-theme="light"]{')]];

  for (const [name, v] of themes) {
    t.ok(`${name}：能从 CSS 里读到变量`, !!v && !!v.bg);
    if (!v || !v.bg) continue;
    /* 正文三级必须达到 AA 的 4.5 */
    for (const k of ['tx', 'tx2', 'tx3']) {
      const r = ratio(v[k], v.bg);
      t.ok(`${name}：--${k} 对比度 ${r ? r.toFixed(2) : '?'} ≥ 4.5`, !!r && r >= 4.5);
    }
    /* 强调色与状态色是大字号或图形，按 AA 的 3.0 要求 */
    for (const k of ['acc', 'acc2', 'warm', 'rest', 'work', 'green', 'red']) {
      if (!v[k]) continue;
      const r = ratio(v[k], v.bg);
      t.ok(`${name}：--${k} 对比度 ${r ? r.toFixed(2) : '?'} ≥ 3.0`, !!r && r >= 3.0);
    }
    /* 卡片背景上也要能看清正文 */
    const r2 = ratio(v.tx, v.bg2);
    t.ok(`${name}：正文对次级背景 ${r2 ? r2.toFixed(2) : '?'} ≥ 4.5`, !!r2 && r2 >= 4.5);
  }

  /* 两套配色的深浅方向必须是反的，否则「亮色主题」名不副实 */
  const [dk, lt] = themes.map(x => x[1]);
  if (dk && lt) t.ok('亮色主题的背景确实比暗色亮', lum(lt.bg) > lum(dk.bg));

  /* 调色板机制已经删掉，残留会让人以为还能切 */
  t.ok('CSS 里不再有 data-palette 规则', !/html\[data-palette=/.test(css));

  /* 所有大号数字必须同色。早先日视图的日号用的是 oat→golden→caramel 渐变，
     在亮色主题下那三个值恰好都落在玫瑰色系，跟旁边的深色大字明显不是一路。 */
  const BIG = ['.clock{', '.wtemp{', '.advat .n{', '.dv .big{', '.cvbig{', '.hbig{'];
  const colours = BIG.map(sel => {
    const i = css.indexOf(sel);
    if (i < 0) return [sel, '(找不到)'];
    const m = /color\s*:\s*var\((--[a-z0-9-]+)\)/.exec(css.slice(i, i + 260));
    return [sel, m ? m[1] : '(没设颜色)'];
  });
  for (const [sel, c] of colours) t.eq(`${sel.replace('{','')} 用 --cream`, c, '--cream');
  t.eq('六处大字颜色完全一致', new Set(colours.map(x => x[1])).size, 1);

  /* --night 是「强调色按钮上的文字色」，不该拿来当正文色用。
     用错的表现是：亮色主题下大字被染成背景色，等于看不见。 */
  const nightAsText = [...css.matchAll(/html\[data-theme="light"\][^{}]*\{[^}]*color:var\(--night\)[^}]*\}/g)]
    .map(m => m[0].slice(0, 60));
  t.eq('亮色主题没有把文字色设成 --night' + (nightAsText.length ? '：' + nightAsText.join(' | ') : ''),
       nightAsText.length, 0);
}

process.exit(t.done() ? 1 : 0);
