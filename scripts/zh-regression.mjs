/* 界面快照回归：node scripts/zh-regression.mjs [--update] [--dump]

   用冻结的时间 + 冻结的天气数据（_fixture-wx.json）把所有面板渲染一遍，
   对每块产物算 SHA-256，与 _snapshot-ui.json 里的黄金值逐个比对。
   任何一处界面文案、排版、图表路径的变化都会被点名。

   为什么存哈希而不是存整段 HTML：整段是 300 KB 的压缩 HTML，
   放进 git 之后每次 PR 的 diff 都没法看。哈希只有几 KB，
   失败时会明确告诉你「是哪一块变了」，再用 --dump 把两边的完整
   HTML 落到 dist/ 里自己 diff。

     --update   重新生成黄金快照（界面确实改了、且你确认改对了，才跑这个）
     --dump     额外把完整 HTML 写到 dist/ui-dump.json 供人工 diff

   注意：这测的是「有没有变」，不是「对不对」。快照测试只能防止无意的改动，
   它不知道界面本身是好是坏。                                              */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const SRC  = join(ROOT, 'src', 'js');
const SNAP = join(HERE, '_snapshot-ui.json');
const UPDATE = process.argv.includes('--update');
const DUMP   = process.argv.includes('--dump');
const FIXED = Date.UTC(2026, 7, 14, 10, 30, 0);      // 固定"现在"

/* ---- 冻结时间 ---- */
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a){ if(a.length === 0) super(FIXED); else super(...a); }
  static now(){ return FIXED; }
}
globalThis.Date = FakeDate;

/* ---- DOM 桩 ---- */
const store = {};
function El(id){
  return {id,_html:'',_txt:'',value:'',checked:false,dataset:{},style:{},tabIndex:0,
    scrollTop:0,clientHeight:170,title:'',
    set innerHTML(v){this._html=v;store[id]=v;}, get innerHTML(){return this._html;},
    set textContent(v){this._txt=v;store[id+':txt']=v;}, get textContent(){return this._txt;},
    set placeholder(v){store[id+':ph']=v;}, classList:{add(){},remove(){},toggle(){},contains(){return false}},
    querySelector(){return El(id+'>x')}, querySelectorAll(){return[]},
    addEventListener(){}, removeEventListener(){}, appendChild(){}, closest(){return null},
    scrollIntoView(){}, scrollTo(){}, focus(){},
    set onclick(f){}, set onchange(f){}, set oninput(f){}, set onkeydown(f){}};
}
const cache = {};
globalThis.document = {
  querySelector(s){ return cache[s] || (cache[s] = El(s)); },
  querySelectorAll(){ return []; },
  addEventListener(){}, documentElement:{setAttribute(){}, lang:''}, title:''
};
globalThis.localStorage = {_d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=v;}};
globalThis.window = {addEventListener(){}};
globalThis.location = {protocol:'file:'};

/* ---- 加载源码 ---- */
let code = readdirSync(SRC).filter(f=>f.endsWith('.js')).sort()
  .map(f=>readFileSync(join(SRC,f),'utf8')).join('\n');
code = code.slice(0, code.indexOf('/* ===================== 启动 ===================== */'));
const EXPORT = ['S','load','applyStaticText','setLang','buildAdvice','climateNarrative','summarize',
  'renderNow','renderAdvice','renderIntraday','renderWx','renderSrcBar','renderSource','renderCal',
  'renderConv','renderHistCtrl','renderFavs','renderClocks','renderHolidays','fillTZ','renderDetail',
  'lineChart','yearBars','intradayChart','deriveWarnings','wxText','windDir','tempBand','uvLevel','aqiLevel'];
(0,eval)(code + `\n;globalThis.API_ = {${EXPORT.join(',')}};`);
const A = globalThis.API_;

/* ---- 固定天气数据 ---- */
const WX = JSON.parse(readFileSync(new URL('./_fixture-wx.json', import.meta.url),'utf8'));
A.load();
A.S.cur = A.S.favs[0];
A.S.wx = WX.wx; A.S.air = WX.air; A.S.past = WX.past;
A.S.warns = A.deriveWarnings(WX.wx, 'zh-CN');
A.S.lang = 'zh-CN'; A.setLang('zh-CN');
A.S.sel = '2026-08-14';
A.S.cursor = new FakeDate(2026, 7, 14);
A.applyStaticText();

const out = {};
const RENDERS = ['renderNow','renderAdvice','renderIntraday','renderWx','renderSrcBar','renderSource',
  'renderConv','renderHistCtrl','renderFavs','renderClocks','renderHolidays','fillTZ'];
for(const r of RENDERS){ try{ A[r](); }catch(e){ out['ERR:'+r] = e.message; } }
for(const v of ['day','week','month','year']){
  A.S.view = v;
  try{ A.renderCal(); }catch(e){ out['ERR:cal:'+v] = e.message; }
  out['cal:'+v] = document.querySelector('#calBody').innerHTML;
  out['calTtl:'+v] = document.querySelector('#calTtl').innerHTML;
  out['detail:'+v] = document.querySelector('#detail').innerHTML;
}
/* 建议引擎：跑一批温度档，覆盖全部 BANDS / UV / AQI 分支 */
const adv = [];
for(const t of [40,36,32,28,24,20,16,12,7,2,-5,-15,-30]){
  for(const uv of [1,4,7,9,12]){
    for(const aqi of [30,80,120,180,260,400]){
      const a = A.buildAdvice({tNow:t,tMax:t+6,tMin:t-8,wind:30,gust:70,rh:82,uv,pop:60,precip:5,
                               code:t<3?73:63,elev:2500,aqi,isDay:1,cloud:40,bias:'normal'});
      adv.push([a.band, a.layers.join('|'), a.accessories.join('|'), a.notes.join('|')].join('¶'));
    }
  }
}
out['advice'] = adv.join('\n');
/* 气候叙述：覆盖 verdict 全分支 */
const stat = {n:70,yearCount:10,hiMean:31.4,loMean:22.8,hiMax:38.2,loMin:17.1,
  hiMaxYear:'2018-08-14',loMinYear:'2016-08-11',wetRate:41,prMean:3.6,
  perYear:[...Array(10)].map((_,i)=>({year:2016+i,hi:30+i*0.2,lo:22+i*0.15,pr:3}))};
out['climate'] = [null,{hi:31.6,lo:23},{hi:33,lo:24},{hi:35,lo:25},{hi:39,lo:29},{hi:24,lo:16}]
  .map(t=>A.climateNarrative(stat,t,A.S.cur,8,14,10).join(' ')).join('\n');
/* 图表 */
const series = [...Array(40)].map((_,i)=>({date:`2026-07-${String(i%30+1).padStart(2,'0')}`,
  hi:28+Math.sin(i)*5, lo:20+Math.cos(i)*4, pr:i%5}));
out['lineChart'] = A.lineChart(series);
out['yearBars']  = A.yearBars(stat.perYear);
out['intraday']  = A.intradayChart(WX.wx.minutely_15.time, WX.wx.minutely_15.temperature_2m,
                                   WX.wx.minutely_15.precipitation, 0, 24, 15);
/* 面板 */
for(const sel of ['#nowPanel','#adviceBody','#wxBody','#holList','#holYr:txt','#convBody','#histCtrl',
                  '#srcBody','#srcBar','#wcList','#favs','#tzDiff','#foot','#intraNote:txt',
                  '#brandName:txt','#adviceTitle:txt','#calTitle:txt','#convTitle:txt','#wxTitle:txt',
                  '#histTitle:txt','#tzTitle:txt','#wcTitle:txt','#wcHint:txt','#holTitle:txt',
                  '#todayB:txt','#theme:txt','#q:ph','#outA','#outB','#addFav:txt']){
  out[sel] = sel.includes(':') ? (store[sel.split(':')[0]+':'+sel.split(':')[1]] ?? '')
                               : document.querySelector(sel).innerHTML;
}
out['_wxText'] = [0,1,2,3,45,48,51,53,55,56,57,61,63,65,66,67,71,73,75,77,80,81,82,85,86,95,96,99,7]
  .map(c=>A.wxText(c)).join('|');
out['_windDir'] = [...Array(16)].map((_,i)=>A.windDir(i*22.5)).join('|');

/* ---- 哈希并比对 ---- */
const sha = v => createHash('sha256').update(String(v)).digest('hex').slice(0, 16);
const now = {};
for (const k of Object.keys(out).sort()) now[k] = sha(out[k]);

/* 记下生成快照时的运行环境。
   渲染结果里有一部分来自 Intl（国名、非公历历法），而 ICU 数据是随 Node
   一起发布的 —— 换个 Node 大版本，同样的代码可能输出不同的字符串。
   把版本记进快照，比对失败时就能一眼分清是「代码变了」还是「环境变了」。 */
const envNow = { node: process.versions.node.split('.')[0], icu: process.versions.icu || '?' };

if (DUMP) {
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist', 'ui-dump.json'), JSON.stringify(out, null, 1));
  console.log('完整 HTML 已写到 dist/ui-dump.json');
}

if (UPDATE || !existsSync(SNAP)) {
  writeFileSync(SNAP, JSON.stringify({ _env: envNow, ...now }, null, 1) + '\n');
  console.log(`${existsSync(SNAP) && !UPDATE ? '首次生成' : '已更新'}黄金快照：${Object.keys(now).length} 块`);
  console.log(`生成环境：Node ${envNow.node} · ICU ${envNow.icu}`);
  console.log('请自己确认界面确实该这么变，再把快照一起提交。');
  process.exit(0);
}

const raw = JSON.parse(readFileSync(SNAP, 'utf8'));
const envWas = raw._env || null;
const want = { ...raw }; delete want._env;

const changed = [], added = [], removed = [];
for (const k of Object.keys(now)) {
  if (!(k in want)) added.push(k);
  else if (want[k] !== now[k]) changed.push(k);
}
for (const k of Object.keys(want)) if (!(k in now)) removed.push(k);

console.log(`\n\x1b[1m界面快照回归\x1b[0m  (${Object.keys(now).length} 块)`);
if (!changed.length && !added.length && !removed.length) {
  console.log('  \x1b[32m✓ 与黄金快照完全一致\x1b[0m');
  process.exit(0);
}
for (const k of changed) console.log(`  \x1b[31m✗ 变了\x1b[0m   ${k}`);
for (const k of added)   console.log(`  \x1b[33m+ 新增\x1b[0m   ${k}`);
for (const k of removed) console.log(`  \x1b[33m- 消失\x1b[0m   ${k}`);

/* 环境不同就先说这件事 —— 否则贡献者会以为自己改坏了什么 */
if (envWas && envWas.node !== envNow.node) {
  console.log(`\n  \x1b[33m注意：快照是在 Node ${envWas.node}（ICU ${envWas.icu}）上生成的，` +
              `你现在跑的是 Node ${envNow.node}（ICU ${envNow.icu}）。\x1b[0m`);
  console.log('  渲染结果里有一部分来自 Intl（国名、非公历历法），而 ICU 数据随 Node 发布，');
  console.log('  所以换 Node 大版本本身就可能让哈希对不上，未必是你改坏了什么。');
  console.log('  先用 --dump 看看差异是不是只出现在这类字符串上。');
}

console.log('\n  如果这些变化是你有意做的：');
console.log('    node scripts/zh-regression.mjs --dump     # 先看看具体差在哪');
console.log('    node scripts/zh-regression.mjs --update   # 确认无误后更新快照');
process.exit(1);
