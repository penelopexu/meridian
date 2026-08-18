/* ===== 气象预警 =====

   两个来源，能同时显示：
     1) 官方预警 —— 只有配置了和风 Key 才有。Open-Meteo 没有任何预警接口。
     2) 本地推算 —— 按中国气象局《气象灾害预警信号发布与传播办法》的阈值，
        从预报数据自己判断。界面上明确标注「本地推算」，不冒充官方发布。

   预警级别沿用国标四色：蓝(IV) < 黄(III) < 橙(II) < 红(I)                 */

const WARN_LEVELS = {
  blue:   {rank:1, zh:'蓝色', en:'Blue',   color:'#5B8FD4', bg:'rgba(91,143,212,.16)'},
  yellow: {rank:2, zh:'黄色', en:'Yellow', color:'#D4A574', bg:'rgba(212,165,116,.18)'},
  orange: {rank:3, zh:'橙色', en:'Orange', color:'#D98F5B', bg:'rgba(217,143,91,.20)'},
  red:    {rank:4, zh:'红色', en:'Red',    color:'#C4643C', bg:'rgba(196,100,60,.22)'}
};
/* 和风的预警等级字符串 → 本项目色键 */
function qwLevelKey(s){
  const t = String(s||'').toLowerCase();
  if(t.includes('red')||t.includes('红')) return 'red';
  if(t.includes('orange')||t.includes('橙')) return 'orange';
  if(t.includes('yellow')||t.includes('黄')) return 'yellow';
  if(t.includes('blue')||t.includes('蓝')) return 'blue';
  return 'yellow';
}

/* ---- 本地阈值推算 ----
   注意：这些阈值取自中国气象局的预警信号标准，但我们手上只有逐日
   汇总量（日最高温、日降水总量、日最大风速），而官方标准用的是
   「24 小时内」「3 小时内」这类滑动窗口。所以这是保守的近似，
   宁可少报也不虚报，界面上也标了「本地推算」。                      */
function warnT(lang, key, vars){
  const pack = (STRINGS[lang] && STRINGS[lang].warn) || STRINGS['zh-CN'].warn;
  let v = pack[key];
  if(v === undefined) v = STRINGS['zh-CN'].warn[key];
  if(typeof v === 'string' && vars)
    v = v.replace(/\{(\w+)\}/g, (m,k)=> vars[k] !== undefined ? vars[k] : m);
  return v;
}
function deriveWarnings(wx, lang){
  if(!wx || !wx.daily) return [];
  const d = wx.daily, out = [];
  const hi = d.temperature_2m_max || [], lo = d.temperature_2m_min || [];
  const pr = d.precipitation_sum || [], wd = d.wind_speed_10m_max || [];
  /* 文案统一走语言包 STRINGS[lang].warn，缺项回落 zh-CN（见 10-i18n.js） */
  const push = (level, type, key, descKey, vars) => out.push({
    level, type, title: warnT(lang, key), desc: warnT(lang, descKey, vars), derived:true
  });

  /* 高温：国标 黄=连续3天>35，橙=24h内>37，红=24h内>40 */
  const h0 = hi[0];
  if(h0 != null){
    const next3 = hi.slice(0,3).filter(v=>v!=null);
    if(h0 >= 40)      push('red','heat','heatRed','heatRedDesc',{v:Math.round(h0)});
    else if(h0 >= 37) push('orange','heat','heatOrange','heatOrangeDesc',{v:Math.round(h0)});
    else if(next3.length===3 && next3.every(v=>v>=35))
                      push('yellow','heat','heatYellow','heatYellowDesc');
  }
  /* 暴雨：以日雨量近似 —— 50/100/250 mm 对应 暴雨/大暴雨/特大暴雨 */
  const p0 = pr[0];
  if(p0 != null){
    const pv = {v:Math.round(p0)};
    if(p0 >= 250)      push('red','rain','rainRed','rainDesc',pv);
    else if(p0 >= 100) push('orange','rain','rainOrange','rainDesc',pv);
    else if(p0 >= 50)  push('yellow','rain','rainYellow','rainDesc',pv);
    else if(p0 >= 25)  push('blue','rain','rainBlue','rainDesc',pv);
  }
  /* 大风：风力等级换算 —— 6级39, 8级62, 10级89, 12级118 km/h */
  const w0 = wd[0];
  if(w0 != null){
    const bf = beaufort(w0);
    const wv = {v:Math.round(w0), bf};
    if(w0 >= 118)      push('red','wind','windRed','windDesc',wv);
    else if(w0 >= 89)  push('orange','wind','windOrange','windDesc',wv);
    else if(w0 >= 62)  push('yellow','wind','windYellow','windDesc',wv);
    else if(w0 >= 39)  push('blue','wind','windBlue','windDesc',wv);
  }
  /* 寒潮：48 小时降温幅度 + 最低气温门槛 */
  if(lo.length >= 3 && lo[0]!=null && lo[2]!=null){
    const drop = lo[0] - lo[2];
    const cv = {v:Math.round(drop)};
    if(drop >= 16 && lo[2] <= 4)      push('red','cold','coldRed','coldDesc',cv);
    else if(drop >= 12 && lo[2] <= 4) push('orange','cold','coldOrange','coldDesc',cv);
    else if(drop >= 10 && lo[2] <= 4) push('yellow','cold','coldYellow','coldDesc',cv);
    else if(drop >= 8  && lo[2] <= 4) push('blue','cold','coldBlue','coldDesc',cv);
  }
  /* 冰雪 / 雷暴：用天气现象码补两条 */
  const c0 = (d.weather_code||[])[0];
  if([71,73,75,77,85,86].includes(c0))
    push(c0>=75?'orange':'blue','snow','snow','snowDesc');
  if([95,96,99].includes(c0))
    push(c0===99?'orange':'yellow','thunder','thunder','thunderDesc');

  return out.sort((a,b)=>WARN_LEVELS[b.level].rank - WARN_LEVELS[a.level].rank);
}
/* km/h → 蒲福风级 */
function beaufort(kmh){
  const t=[1,6,12,20,29,39,50,62,75,89,103,118];
  for(let i=0;i<t.length;i++) if(kmh < t[i]) return i;
  return 12;
}

/* ---- 和风官方预警 ---- */
async function qwGetWarnings(p){
  if(!qwReady()) return [];
  const loc = `${(+p.lon).toFixed(4)},${(+p.lat).toFixed(4)}`;
  const j = await qwFetch('/v7/warning/now', {location:loc});
  return (j.warning||[]).map(w=>({
    level: qwLevelKey(w.severityColor || w.level),
    type: w.typeName || '',
    title: w.title || `${w.typeName||''}${w.severityColor||''}预警`,
    desc: w.text || '',
    start: w.startTime, end: w.endTime,
    sender: w.sender || '',
    source: 'qweather',
    derived: false
  })).sort((a,b)=>WARN_LEVELS[b.level].rank - WARN_LEVELS[a.level].rank);
}


/* ==================================================================
   官方预警源登记表

   现实是：没有任何一个免费、不要 key、又允许跨域的接口能覆盖全球。
   本该填补空白的 MeteoAlarm(欧洲) 和 WMO(全球) 恰恰都不发 CORS 头，
   而我们是纯静态站点，没有服务端可以代为转发。所以覆盖只能是打补丁式的：

     第一级  官方免 key 源     —— 只在有对应源的地区可用，见下表
     第二级  和风天气           —— 全球，但要用户自己填 Key
     第三级  本地推算           —— 全球，任何地方都有，但只是近似

   前两级都是官方发布，第三级会明确标注「本地推算」，不冒充官方。
   三级同时存在时全部显示，按级别排序，各自标明出处。

   加新源只需要往这张表里加一项。match 返回 true 表示这个源覆盖该地点。
   load 必须自己吞掉所有异常——一个源挂了不能影响其他源和整个界面。
   ================================================================== */

/* 判断经纬度是否落在一个矩形框里。用框而不是行政边界，是因为
   我们只需要「大致属于哪个气象机构的辖区」，精确边界既拿不到也没必要。 */
function inBox(p, s, n, w, e){
  return p && isFinite(p.lat) && isFinite(p.lon) &&
         p.lat >= s && p.lat <= n && p.lon >= w && p.lon <= e;
}

const ALERT_SOURCES = [
  {
    id: 'hko',
    attribution: '香港天文台 Hong Kong Observatory',
    /* 只认国家码。经纬度框在这里靠不住：深圳市中心(22.54, 114.06)
       落在任何一个能框住香港的矩形里——两地就是紧挨着的，
       矩形分不开。给深圳挂上「香港天文台发布」是错误署名，
       所以国家码缺失时宁可不报，也不猜。 */
    match: p => p.cc === 'HK',
    load: hkoWarnings
  },
  {
    id: 'nws',
    attribution: '美国国家气象局 NOAA/NWS',
    /* 美国本土 + 阿拉斯加 + 夏威夷 + 波多黎各 */
    match: p => p.cc === 'US' || p.cc === 'PR' ||
                inBox(p, 24, 50, -125, -66) || inBox(p, 51, 72, -170, -129) ||
                inBox(p, 18.8, 22.3, -160.3, -154.7),
    load: nwsWarnings
  },
  {
    id: 'nmc',
    attribution: '中央气象台',
    /* 中国大陆。港澳台各有自己的发布机构，不走这个源 */
    match: p => p.cc === 'CN',
    load: nmcWarnings
  },
  {
    id: 'brightsky',
    attribution: 'Bright Sky（转发德国气象局 DWD）',
    match: p => p.cc === 'DE' || inBox(p, 47.2, 55.1, 5.8, 15.1),
    load: brightSkyWarnings
  },
  {
    id: 'typhoon',
    attribution: '中央气象台台风网',
    /* 西北太平洋台风带。范围取得宽，因为台风影响半径可达数百公里 */
    match: p => inBox(p, 0, 50, 100, 180),
    load: typhoonWarnings
  }
];

/* 取某地点适用的全部官方预警。
   并行请求，任何一个源失败都只丢掉它自己的结果。 */
async function getOfficialWarnings(p, lang){
  if(!p) return [];
  const jobs = ALERT_SOURCES
    .filter(s => { try{ return s.match(p); }catch(e){ return false; } })
    .map(s => Promise.resolve()
      .then(() => s.load(p, lang))
      .then(list => (Array.isArray(list) ? list : []).map(w => ({...w, source: w.source || s.id})))
      .catch(e => { console.warn(`预警源 ${s.id} 失败：`, e && e.message); return []; }));

  /* 和风是全球源，只要用户配了 Key 就一起查 */
  if(typeof qwReady === 'function' && qwReady()){
    jobs.push(Promise.resolve().then(()=>qwGetWarnings(p)).catch(()=>[]));
  }

  const all = (await Promise.all(jobs)).flat();
  return dedupeWarnings(all).sort((a,b)=>WARN_LEVELS[b.level].rank - WARN_LEVELS[a.level].rank);
}

/* 同一场天气可能被多个源同时报（比如香港天文台和和风都发暴雨），
   按「类型 + 级别」去重，保留先到的那条（登记表顺序即优先级，官方本地源在前）。 */
function dedupeWarnings(list){
  const seen = new Set(), out = [];
  for(const w of list){
    const k = `${w.type||w.title}|${w.level}`;
    if(seen.has(k)) continue;
    seen.add(k); out.push(w);
  }
  return out;
}

/* 本地推算的那几条，如果官方已经发了同类预警就不再重复显示。
   官方的权威性更高，我们的近似值没必要跟它并列。 */
function mergeWithDerived(official, derived){
  const officialTypes = new Set(official.map(w => w.type).filter(Boolean));
  const keep = derived.filter(w => !officialTypes.has(w.type));
  return official.concat(keep);
}


/* ---- 香港天文台 ----
   两个接口：warnsum 给「现在生效哪些警告」，warningInfo 给正文。
   没有任何警告生效时返回的是空对象 {}，不是空数组，也不是 404。   */

/* 熱帶氣旋警告信號代码 → 国标四色。
   香港用的是自己的信号体系（1/3/8/9/10 號），不是内地的蓝黄橙红，
   这里按「实际危险程度」对应，不是逐字翻译：
     1號戒備   ≈ 蓝（留意）
     3號強風   ≈ 黄（已有强风）
     8號烈風   ≈ 橙（停工停课，内地台风橙色也是这个量级）
     9號/10號  ≈ 红（最高级别） */
const HKO_TC = {
  TC1:'blue', TC3:'yellow',
  TC8NE:'orange', TC8SE:'orange', TC8NW:'orange', TC8SW:'orange',
  TC9:'red', TC10:'red'
};
/* 暴雨：黃 → 黄，紅 → 橙，黑 → 红 */
const HKO_RAIN = { WRAINA:'yellow', WRAINR:'orange', WRAINB:'red' };
/* 其余警告按性质给一个默认级别 */
const HKO_OTHER = {
  WFIRE:'yellow', WFROST:'yellow', WHOT:'yellow', WCOLD:'yellow',
  WMSGNL:'yellow', WTS:'yellow', WFNTSA:'orange', WL:'orange', WTMW:'red'
};
/* 警告代码 → 本项目的 type 值，用来和本地推算去重 */
const HKO_TYPE = {
  WTCSGNL:'typhoon', WRAIN:'rain', WHOT:'heat', WCOLD:'cold',
  WTS:'thunder', WFNTSA:'rain', WL:'rain', WFIRE:'fire',
  WFROST:'frost', WMSGNL:'wind', WTMW:'tsunami'
};

function hkoLang(lang){
  if(lang === 'zh-CN') return 'sc';
  if(lang === 'zh-TW') return 'tc';
  return 'en';
}
async function hkoWarnings(p, lang){
  const L = hkoLang(lang);
  const base = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php';
  /* 两个接口一起要，正文拿不到也不影响主体信息 */
  const [sum, info] = await Promise.all([
    fetchJSON(`${base}?dataType=warnsum&lang=${L}`, {tries:1, ms:9000}),
    fetchJSON(`${base}?dataType=warningInfo&lang=${L}`, {tries:1, ms:9000}).catch(()=>null)
  ]);
  if(!sum || typeof sum !== 'object') return [];

  /* 正文按 warningStatementCode 归位，方便和摘要对上 */
  const texts = {};
  for(const d of (info && info.details) || []){
    const code = d.warningStatementCode;
    if(code) texts[code] = (d.contents || []).join(' ');
  }

  const out = [];
  for(const key of Object.keys(sum)){
    const w = sum[key];
    if(!w || typeof w !== 'object') continue;
    /* actionCode 为 CANCEL 表示这条刚被取消，不该再显示 */
    if(String(w.actionCode || '').toUpperCase() === 'CANCEL') continue;

    const code = String(w.code || '');
    const level = HKO_TC[code] || HKO_RAIN[code] || HKO_OTHER[key] || 'yellow';
    out.push({
      level,
      type: HKO_TYPE[key] || key.toLowerCase(),
      title: esc(w.name || key) + (w.type ? ' · ' + esc(w.type) : ''),
      desc: esc(texts[key] || ''),
      start: w.issueTime || '', end: '',
      sender: '香港天文台',
      source: 'hko', derived: false
    });
  }
  return out;
}


/* ---- 美国国家气象局 ----
   官方 GeoJSON，覆盖全美所有灾害类型（飓风、龙卷、洪水、暴风雪、野火…）。
   接口稳定、文档完善，是这几个源里最省心的一个。                        */

/* NWS 的 severity 用的是 CAP 标准词汇，直接映射到四色 */
const NWS_SEVERITY = { Extreme:'red', Severe:'orange', Moderate:'yellow', Minor:'blue' };
/* event 名称 → 本项目 type，用来和本地推算去重。只挑对得上的几类。 */
function nwsType(event){
  const e = String(event||'').toLowerCase();
  if(/hurricane|tropical storm|typhoon/.test(e)) return 'typhoon';
  /* 「Wind Chill」（风寒）要在「wind」之前判，否则会被归成大风。
     它说的是冷，不是风大。这类含歧义关键词的顺序不能随便调。 */
  if(/wind chill|cold|freeze|frost/.test(e)) return 'cold';
  if(/heat/.test(e)) return 'heat';
  if(/flood|rain/.test(e)) return 'rain';
  if(/snow|blizzard|ice|winter/.test(e)) return 'snow';
  if(/wind|gale|storm surge/.test(e)) return 'wind';
  if(/thunderstorm|tornado/.test(e)) return 'thunder';
  return 'other';
}
async function nwsWarnings(p){
  const url = `https://api.weather.gov/alerts/active?point=${(+p.lat).toFixed(4)},${(+p.lon).toFixed(4)}`;
  const j = await fetchJSON(url, {tries:1, ms:9000});
  return ((j && j.features) || []).map(f => {
    const a = f.properties || {};
    return {
      level: NWS_SEVERITY[a.severity] || 'yellow',
      type: nwsType(a.event),
      title: esc(a.event || 'Alert'),
      desc: esc(a.headline || a.description || '').slice(0, 400),
      start: a.effective || a.onset || '', end: a.expires || '',
      sender: esc(a.senderName || 'NWS'),
      source: 'nws', derived: false
    };
  });
}


/* ---- 中央气象台（中国大陆全类型预警）----

   这是覆盖中国大陆最好的源：全国上千条实时预警，精确到县级，
   免 key，而且 https 可用（http 版从 https 页面调会被按混合内容拦掉）。

   返回结构（已用真实样本核对）：
     data.page.list[]      全国最新预警，分页，每页 10 条，总数上千
     data.provinceAlarms[] 省级预警，十几条，一次全给
     data.stat             各级别数量统计
   每条只有一个标题字符串，信息全埋在里面：
     「湖南省株洲市醴陵市气象台发布暴雨黄色预警信号」
      └─省──┘└─市─┘└─县─┘        └类型┘└级别┘

   所以匹配地点、判断类型和级别，全靠解析这个标题。
   接口没有按地点过滤的参数（至少没找到），只能拉回来自己筛。      */

/* 预警级别：标题里的颜色词。四色是国标，蓝 < 黄 < 橙 < 红。 */
function nmcLevel(title){
  const t = String(title || '');
  if(t.includes('红色')) return 'red';
  if(t.includes('橙色')) return 'orange';
  if(t.includes('黄色')) return 'yellow';
  if(t.includes('蓝色')) return 'blue';
  return 'yellow';
}
/* 灾害类型 → 本项目 type，用来和本地推算去重。
   顺序有讲究：「雷雨大风」「雷暴大风」要在「大风」和「雷电」之前判，
   否则会被拆错归类。 */
const NMC_TYPES = [
  [/台风|颱風/,            'typhoon'],
  [/雷雨大风|雷暴大风|强对流/, 'thunder'],
  [/暴雨|大雨|降雨|山洪|洪水|内涝/, 'rain'],
  [/高温|酷热/,            'heat'],
  [/寒潮|低温|霜冻|冰冻/,   'cold'],
  [/暴雪|大雪|道路结冰|雪/, 'snow'],
  [/雷电|雷暴/,            'thunder'],
  [/冰雹/,                'hail'],
  [/大风|阵风/,            'wind'],
  [/沙尘/,                'dust'],
  [/大雾|霾|能见度/,        'fog'],
  [/地质灾害|滑坡|泥石流/,   'geo'],
  [/干旱/,                'drought']
];
function nmcType(title){
  const t = String(title || '');
  for(const [re, id] of NMC_TYPES) if(re.test(t)) return id;
  return 'other';
}

/* 把地点名切成可用于匹配标题的片段。
   去掉「市/省/自治区/县/区」这类后缀，因为接口标题里的写法不统一
   （有的是「惠州市」，有的是「惠州」）。
   长度小于 2 的一律丢掉 —— 单字太容易误配，
   比如「东区」会命中一大堆无关的县。 */
function cnNameParts(p){
  const out = [];
  const push = s => {
    let v = String(s || '').trim();
    if(!v) return;
    v = v.replace(/(特别行政区|自治区|自治州|自治县|地区|盟|省|市|县|区|旗)$/,'');
    if(v.length >= 2 && out.indexOf(v) < 0) out.push(v);
  };
  push(p && p.name);
  push(p && p.admin2);
  push(p && p.admin1);
  return out;
}

async function nmcWarnings(p, lang){
  /* pageSize 能不能调大没有文档，就按 100 试；接口不认就还是 10 条，
     那时主要靠 provinceAlarms 兜底，不会出错只是覆盖变窄。 */
  const j = await fetchJSON('https://www.nmc.cn/rest/findAlarm?pageNo=1&pageSize=100',
                            {tries:1, ms:9000});
  const d = (j && j.data) || {};
  if(!d.page && !d.provinceAlarms) return [];

  const parts = cnNameParts(p);
  if(!parts.length) return [];

  /* 县级/市级列表和省级列表合起来筛。同一条可能两边都有，用 alertid 去重。 */
  const seen = new Set(), out = [];
  for(const item of [...((d.page && d.page.list) || []), ...(d.provinceAlarms || [])]){
    const title = String((item && item.title) || '');
    if(!title) continue;
    const id = item.alertid || title;
    if(seen.has(id)) continue;
    /* 标题里出现了这个地点的省/市/县任意一级，就算与本地相关 */
    if(!parts.some(n => title.includes(n))) continue;
    seen.add(id);
    out.push({
      level: nmcLevel(title),
      type: nmcType(title),
      title: esc(title.replace(/^.*?气象台发布/, '').replace(/^.*?发布/, '') || title),
      /* 完整标题放进说明里，这样发布单位（哪个县的气象台）不会丢 */
      desc: esc(title),
      start: esc(item.issuetime || ''), end: '',
      sender: '中央气象台',
      source: 'nmc', derived: false
    });
  }
  return out.slice(0, 6);
}


/* ---- Bright Sky（德国）----
   开源项目，转发德国气象局 DWD 的官方预警，明确允许任意来源跨域。
   直接用经纬度查，省去自己做「经纬度 → DWD 网格编号」的映射。

   字段名按其公开文档写，**尚未用有预警的真实样本核对过**
   （抓样本时柏林没有生效预警，返回的是空数组）。
   所以每个字段都做了多写法兼容，取不到就留空，不会因此报错。   */
const DWD_SEVERITY = { minor:'blue', moderate:'yellow', severe:'orange', extreme:'red' };
function dwdType(event){
  const e = String(event || '').toLowerCase();
  if(/gewitter|thunder/.test(e)) return 'thunder';
  if(/regen|rain|starkregen|flood/.test(e)) return 'rain';
  if(/schnee|snow|glätte|glaette|ice|frost/.test(e)) return 'snow';
  if(/wind|sturm|storm|orkan|böen|boeen/.test(e)) return 'wind';
  if(/hitze|heat/.test(e)) return 'heat';
  if(/kälte|kaelte|cold/.test(e)) return 'cold';
  if(/nebel|fog/.test(e)) return 'fog';
  return 'other';
}
async function brightSkyWarnings(p, lang){
  const url = `https://api.brightsky.dev/alerts?lat=${(+p.lat).toFixed(4)}&lon=${(+p.lon).toFixed(4)}`;
  const j = await fetchJSON(url, {tries:1, ms:9000});
  const list = (j && j.alerts) || [];
  const de = String(lang || '').startsWith('de');
  return list.map(a => {
    const event = (de ? a.event_de : a.event_en) || a.event_en || a.event_de || a.event || '';
    const head  = (de ? a.headline_de : a.headline_en) || a.headline_en || a.headline_de || '';
    const body  = (de ? a.description_de : a.description_en) || a.description_en || a.description_de || '';
    return {
      level: DWD_SEVERITY[String(a.severity || '').toLowerCase()] || 'yellow',
      type: dwdType(event),
      title: esc(event || head || 'Warnung'),
      desc: esc(head || body || '').slice(0, 400),
      start: esc(a.onset || ''), end: esc(a.expires || ''),
      sender: 'Deutscher Wetterdienst',
      source: 'brightsky', derived: false
    };
  });
}


/* ---- 中央气象台台风网 ----

   这是覆盖中国大陆台风的唯一免费渠道，但它是**非公开文档接口**，
   随时可能改结构甚至下线。所以这里的原则是：

     解析不出来就当没有台风，绝不抛异常，绝不显示半截数据。

   接口返回的是 JSONP（内容被一个函数调用包着），要先剥壳。
   下面的字段名是按已知结构写的，**尚未用真实样本校验过**——
   校验方法见 scripts/probe-alert-sources.html 的「抓取样本」。
   如果结构对不上，pickTyphoons 会返回空数组，功能静默降级。      */

/* 剥掉 JSONP 外壳：把 foo_bar([...]) 变成 [...]。
   顺带处理接口直接返回纯 JSON 的情况（万一哪天他们改了）。 */
function stripJSONP(text){
  const s = String(text || '').trim();
  if(!s) return null;
  const i = s.indexOf('('), j = s.lastIndexOf(')');
  const body = (i > 0 && j > i) ? s.slice(i + 1, j) : s;
  try { return JSON.parse(body); } catch(e) { return null; }
}

/* 解析当年台风名录。真实返回长这样（已用实际样本核对）：

     typhoon_jsons_list_2026({"typhoonList":[
       [3302529, "NANGKA", "浪卡", "2617", "2617", null, "命名含义…", "stop"],
        ↑内部id  ↑英文名   ↑中文名 ↑编号   ↑编号          ↑说明        ↑状态
     ]})

   注意：**这个接口只有名录，没有经纬度和风速**。位置在详情接口里，
   所以要先从这里挑出还在活动的台风，再逐个去取详情。
   已停编的状态是 "stop"，其余一律当作可能还在活动。            */
function parseTyphoonList(root){
  const arr = root && root.typhoonList;
  if(!Array.isArray(arr)) return [];
  const out = [];
  for(const row of arr){
    if(!Array.isArray(row) || row.length < 3) continue;
    const id = Number(row[0]);
    if(!isFinite(id) || id <= 0) continue;
    const status = String(row[7] || '').toLowerCase();
    out.push({
      id,
      nameEn: String(row[1] || '').trim(),
      nameZh: String(row[2] || '').trim(),
      code:   String(row[3] || '').trim(),
      status,
      active: status !== 'stop'          // 只有明确停编的才排除
    });
  }
  return out;
}

/* 从任意嵌套结构里找出「看起来像台风当前位置」的记录。

   详情接口的字段名尚未用真实样本核对过（写这段时 2026 年 19 个台风
   全部已停编，取不到活跃样本），所以这里保持结构无关的搜索：
   判据是「同时具备合理的经纬度和风速」——这三个数一起出现的概率很低。
   对不上就返回空数组，功能静默降级，不会显示错误数据。            */
function pickTyphoons(root){
  const found = [];
  const seen = new Set();

  const walk = (node, depth) => {
    if(!node || depth > 8 || found.length >= 12) return;
    if(Array.isArray(node)){
      /* 数组形式：[..., lon, lat, ..., pressure, windSpeed, ...]
         先看这一层本身是不是一条记录，再往下钻 */
      takeIfPoint(node);
      for(const x of node) walk(x, depth + 1);
      return;
    }
    if(typeof node === 'object'){
      takeIfPoint(node);
      for(const k of Object.keys(node)) walk(node[k], depth + 1);
    }
  };

  const num = v => { const n = Number(v); return isFinite(n) ? n : null; };
  const validLat = v => v !== null && v >= -60 && v <= 60;
  const validLon = v => v !== null && v >= 90 && v <= 200;
  const validWind = v => v !== null && v > 0 && v < 120;      // m/s

  function takeIfPoint(o){
    if(Array.isArray(o)) return;   // 数组形式没有字段名，无法可靠判断，跳过
    const lat = num(o.lat ?? o.latitude ?? o.LAT);
    const lon = num(o.lng ?? o.lon ?? o.longitude ?? o.LON);
    const wind = num(o.speed ?? o.windSpeed ?? o.wind ?? o.power);
    if(!validLat(lat) || !validLon(lon) || !validWind(wind)) return;
    const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    if(seen.has(key)) return;
    seen.add(key);
    found.push({
      lat, lon, wind,
      pressure: num(o.pressure ?? o.press),
      name: String(o.name || o.tfname || o.cname || '').trim(),
      moveDir: String(o.movedirection || o.moveDir || o.direction || '').trim(),
      moveSpeed: num(o.movespeed ?? o.moveSpeed)
    });
  }

  walk(root, 0);
  return found;
}

/* 中心风速(m/s) → 台风等级中文名。国标 GB/T 19201 */
function typhoonGrade(ms){
  if(ms >= 51.0) return {zh:'超强台风', en:'Super Typhoon',    level:'red'};
  if(ms >= 41.5) return {zh:'强台风',   en:'Severe Typhoon',   level:'red'};
  if(ms >= 32.7) return {zh:'台风',     en:'Typhoon',          level:'orange'};
  if(ms >= 24.5) return {zh:'强热带风暴',en:'Severe Trop. Storm',level:'orange'};
  if(ms >= 17.2) return {zh:'热带风暴', en:'Tropical Storm',   level:'yellow'};
  return              {zh:'热带低压', en:'Tropical Depression', level:'blue'};
}

/* 距离越近级别越高。这不是官方标准——官方台风预警看的是「未来 24 小时
   可能受到影响」，那需要预报路径和风圈半径，这个接口给不了。
   所以这里明确按「当前中心距离」判断，并在文案里说清楚是本地推算。 */
function typhoonLevelByDistance(km, gradeLevel){
  const rank = {blue:1, yellow:2, orange:3, red:4}[gradeLevel] || 2;
  let byDist;
  if(km <= 200)      byDist = 4;
  else if(km <= 500) byDist = 3;
  else if(km <= 900) byDist = 2;
  else               byDist = 1;
  /* 取两者较小值：强度再高，离得远也不该报红色 */
  const r = Math.min(rank, byDist);
  return ['blue','blue','yellow','orange','red'][r];
}

/* 这两个接口返回的是 JSONP 不是 JSON，所以不能用 fetchJSON */
async function fetchJSONP(url, ms = 9000){
  const ctl = new AbortController();
  const timer = setTimeout(()=>ctl.abort(), ms);
  try {
    const res = await fetch(url, {signal: ctl.signal});
    if(!res.ok) return null;
    return stripJSONP(await res.text());
  } finally { clearTimeout(timer); }
}

async function typhoonWarnings(p, lang){
  const year = new Date().getFullYear();
  const base = 'https://typhoon.nmc.cn/weatherservice/typhoon/jsons';

  /* 第一步：取当年名录，挑出还没停编的 */
  const active = parseTyphoonList(await fetchJSONP(`${base}/list_${year}`)).filter(t => t.active);
  if(!active.length) return [];    // 没有活跃台风，常态

  /* 第二步：逐个取详情拿位置。最多看 3 个，避免一次发太多请求。
     详情接口挂了就跳过这一个，不影响其他。 */
  const details = await Promise.all(active.slice(0, 3).map(t =>
    fetchJSONP(`${base}/view_${year}_${t.id}`)
      .then(d => ({ t, points: pickTyphoons(d) }))
      .catch(() => ({ t, points: [] }))
  ));

  /* 每个台风只要最后一个点（最新位置），并把名录里的中文名补回去 */
  const list = [];
  for(const {t, points} of details){
    if(!points.length) continue;
    const last = points[points.length - 1];
    list.push({...last, name: last.name || t.nameZh || t.nameEn});
  }
  if(!list.length) return [];      // 详情接口结构对不上，静默降级

  const zh = String(lang || '').startsWith('zh');
  const out = [];
  for(const t of list){
    const km = Math.round(haversine(p.lat, p.lon, t.lat, t.lon));
    if(km > 1200) continue;        // 太远，与本地无关
    const g = typhoonGrade(t.wind);
    const level = typhoonLevelByDistance(km, g.level);
    const bits = [];
    bits.push(zh ? `距本地约 ${km} 公里` : `about ${km} km away`);
    bits.push(zh ? `中心风力 ${beaufort(t.wind * 3.6)} 级（${Math.round(t.wind)} 米/秒）`
                 : `max wind ${Math.round(t.wind)} m/s (force ${beaufort(t.wind * 3.6)})`);
    if(t.pressure) bits.push(zh ? `中心气压 ${t.pressure} 百帕` : `${t.pressure} hPa`);
    if(t.moveDir)  bits.push(zh ? `向${esc(t.moveDir)}移动` : `moving ${esc(t.moveDir)}`);

    out.push({
      level,
      type: 'typhoon',
      title: (zh ? g.zh : g.en) + (t.name ? ` ${esc(t.name)}` : ''),
      desc: bits.join(zh ? '，' : ', '),
      start: '', end: '',
      sender: zh ? '中央气象台台风网' : 'CMA Typhoon Network',
      source: 'typhoon',
      /* 距离分级是我们自己算的，不是官方发布的预警级别，界面上要标出来 */
      derived: true,
      dist: km
    });
  }
  return out.sort((a,b)=>a.dist - b.dist).slice(0, 3);
}
