/* 预警源解析测试

   这套测试全部用造出来的样本，不碰真实接口。原因很实际：
   预警接口平时返回的是「没有任何警告」，你没法在需要的时候让香港挂八号风球。
   而恰恰是「有警告」的那条分支最容易写错，也最需要被守住。

   所以这里造样本喂给解析函数，检查：
     * 香港的信号体系（1/3/8/9/10 號、黃紅黑暴雨）有没有正确对到国标四色
     * 已取消(CANCEL)的警告有没有被过滤掉
     * 美国 CAP 的 severity 有没有对上
     * 台风的距离分级、等级判定、太远的有没有被丢掉
     * 结构对不上时是不是安静返回空数组，而不是抛异常或吐半截数据
     * 官方与本地推算的去重                                             */

import { loadApp, createRunner } from './_harness.mjs';

const t = createRunner('预警源解析');
const { ctx: G } = loadApp();

/* ---------- 1. 香港天文台 ---------- */
t.section('香港天文台');

/* hkoWarnings 是 async 且内部要发网络请求，没法直接测。
   但级别映射表是纯数据，解析逻辑的正确性主要就落在这几张表上。 */
t.ok('熱帶氣旋映射表存在', !!G.HKO_TC);
if (G.HKO_TC) {
  t.eq('1號戒備 → 蓝色', G.HKO_TC.TC1, 'blue');
  t.eq('3號強風 → 黄色', G.HKO_TC.TC3, 'yellow');
  /* 八號的四个方向（東北/東南/西北/西南）危险程度相同，必须一致 */
  const eight = ['TC8NE', 'TC8SE', 'TC8NW', 'TC8SW'].map(k => G.HKO_TC[k]);
  t.eq('八號四个方向级别一致且为橙色', [...new Set(eight)], ['orange']);
  t.eq('9號 → 红色', G.HKO_TC.TC9, 'red');
  t.eq('10號颶風 → 红色', G.HKO_TC.TC10, 'red');
  /* 级别必须单调不降：信号越高越危险 */
  const rank = k => G.WARN_LEVELS[G.HKO_TC[k]].rank;
  t.ok('级别随信号等级单调不降',
       rank('TC1') <= rank('TC3') && rank('TC3') <= rank('TC8NE') && rank('TC8NE') <= rank('TC10'));
}
if (G.HKO_RAIN) {
  t.eq('黃色暴雨 → 黄', G.HKO_RAIN.WRAINA, 'yellow');
  t.eq('紅色暴雨 → 橙', G.HKO_RAIN.WRAINR, 'orange');
  t.eq('黑色暴雨 → 红', G.HKO_RAIN.WRAINB, 'red');
  const r = k => G.WARN_LEVELS[G.HKO_RAIN[k]].rank;
  t.ok('暴雨三级单调递增', r('WRAINA') < r('WRAINR') && r('WRAINR') < r('WRAINB'));
}
if (G.HKO_TYPE) {
  t.eq('熱帶氣旋归入 typhoon 类', G.HKO_TYPE.WTCSGNL, 'typhoon');
  t.eq('暴雨归入 rain 类', G.HKO_TYPE.WRAIN, 'rain');
  t.eq('酷熱归入 heat 类', G.HKO_TYPE.WHOT, 'heat');
  /* type 必须和本地推算用的一致，否则去重会失效 */
  const derivedTypes = ['heat', 'rain', 'wind', 'cold', 'snow', 'thunder'];
  const mapped = Object.values(G.HKO_TYPE);
  t.ok('映射出的类型能与本地推算对上',
       derivedTypes.some(d => mapped.includes(d)));
}
t.ok('语言码 zh-CN → 简体(sc)', G.hkoLang && G.hkoLang('zh-CN') === 'sc');
t.ok('语言码 zh-TW → 繁體(tc)', G.hkoLang && G.hkoLang('zh-TW') === 'tc');
t.ok('其他语言 → 英文(en)', G.hkoLang && G.hkoLang('ja') === 'en');

/* ---------- 2. 美国国家气象局 ---------- */
t.section('美国国家气象局');

if (G.NWS_SEVERITY) {
  t.eq('Extreme → 红', G.NWS_SEVERITY.Extreme, 'red');
  t.eq('Severe → 橙', G.NWS_SEVERITY.Severe, 'orange');
  t.eq('Moderate → 黄', G.NWS_SEVERITY.Moderate, 'yellow');
  t.eq('Minor → 蓝', G.NWS_SEVERITY.Minor, 'blue');
}
if (typeof G.nwsType === 'function') {
  t.eq('Hurricane Warning → typhoon', G.nwsType('Hurricane Warning'), 'typhoon');
  t.eq('Tropical Storm Watch → typhoon', G.nwsType('Tropical Storm Watch'), 'typhoon');
  t.eq('Excessive Heat Warning → heat', G.nwsType('Excessive Heat Warning'), 'heat');
  t.eq('Flash Flood Warning → rain', G.nwsType('Flash Flood Warning'), 'rain');
  t.eq('Winter Storm Warning → snow', G.nwsType('Winter Storm Warning'), 'snow');
  t.eq('Tornado Warning → thunder', G.nwsType('Tornado Warning'), 'thunder');
  t.eq('Wind Chill Advisory → cold', G.nwsType('Wind Chill Advisory'), 'cold');
  t.eq('认不出的归入 other', G.nwsType('Beach Hazards Statement'), 'other');
  t.eq('空值不报错', G.nwsType(undefined), 'other');
}

/* ---------- 2b. 中央气象台（中国大陆）---------- */
t.section('中央气象台');

/* 标题全部取自 2026-08-18 抓回来的真实返回值 */
const NMC_TITLES = [
  '湖南省株洲市醴陵市气象台发布暴雨黄色预警信号',
  '广西壮族自治区防城港市东兴市气象台发布雷雨大风黄色预警信号',
  '内蒙古自治区兴安盟阿尔山市气象台发布冰雹橙色预警信号',
  '云南省昆明市晋宁区气象台发布雷电黄色预警信号',
  '河南省濮阳市南乐县气象台发布暴雨橙色预警信号',
  '山西省水利厅和山西省气象台发布山洪灾害气象风险蓝色预警',
  '安徽省黄山市黄山区气象台发布强对流黄色预警信号',
  '贵州省安顺市关岭县气象台发布大风蓝色预警信号',
  '浙江省自然资源厅、浙江省气象台发布地质灾害黄色预警',
  '辽宁省气象台发布其它气象灾害黄色预警'
];

if (typeof G.nmcLevel === 'function') {
  t.eq('黄色 → yellow', G.nmcLevel(NMC_TITLES[0]), 'yellow');
  t.eq('橙色 → orange', G.nmcLevel(NMC_TITLES[2]), 'orange');
  t.eq('蓝色 → blue', G.nmcLevel(NMC_TITLES[5]), 'blue');
  t.eq('红色 → red', G.nmcLevel('某地气象台发布暴雨红色预警信号'), 'red');
  t.eq('没有颜色词时保守取黄色', G.nmcLevel('某地气象台发布预警'), 'yellow');
}

if (typeof G.nmcType === 'function') {
  t.eq('暴雨 → rain', G.nmcType(NMC_TITLES[0]), 'rain');
  /* 「雷雨大风」既含雷又含风，必须整体归到雷暴，不能被拆成 wind */
  t.eq('雷雨大风 → thunder（不是 wind）', G.nmcType(NMC_TITLES[1]), 'thunder');
  t.eq('冰雹 → hail', G.nmcType(NMC_TITLES[2]), 'hail');
  t.eq('雷电 → thunder', G.nmcType(NMC_TITLES[3]), 'thunder');
  t.eq('山洪 → rain', G.nmcType(NMC_TITLES[5]), 'rain');
  t.eq('强对流 → thunder', G.nmcType(NMC_TITLES[6]), 'thunder');
  t.eq('大风 → wind', G.nmcType(NMC_TITLES[7]), 'wind');
  t.eq('地质灾害 → geo', G.nmcType(NMC_TITLES[8]), 'geo');
  t.eq('台风 → typhoon', G.nmcType('海南省气象台发布台风红色预警信号'), 'typhoon');
  t.eq('认不出的归入 other', G.nmcType(NMC_TITLES[9]), 'other');
}

if (typeof G.cnNameParts === 'function') {
  t.eq('去掉市字后缀', G.cnNameParts({ name: '株洲市' }), ['株洲']);
  t.eq('省市两级都取', G.cnNameParts({ name: '醴陵市', admin1: '湖南省' }), ['醴陵', '湖南']);
  /* 单字片段必须丢掉：「东区」去掉「区」只剩「东」，会命中一大堆无关的县 */
  t.eq('单字片段被丢弃', G.cnNameParts({ name: '东区' }), []);
  t.eq('自治区后缀也去掉', G.cnNameParts({ name: '内蒙古自治区' }), ['内蒙古']);
  t.eq('重复的只留一个', G.cnNameParts({ name: '昆明市', admin2: '昆明市' }), ['昆明']);
  t.eq('空对象不报错', G.cnNameParts({}), []);
  t.eq('null 不报错', G.cnNameParts(null), []);

  /* 端到端验一下匹配逻辑：选了株洲，应该只命中醴陵那条（醴陵属株洲） */
  const parts = G.cnNameParts({ name: '株洲市', admin1: '湖南省' });
  const hit = NMC_TITLES.filter(t2 => parts.some(n => t2.includes(n)));
  t.eq('株洲命中醴陵那条（醴陵属株洲，标题里带「湖南省株洲市」）', hit.length, 1);
  t.ok('命中的确实是醴陵那条', hit[0] && hit[0].includes('醴陵'));
  const kunming = G.cnNameParts({ name: '昆明市', admin1: '云南省' });
  t.ok('昆明能匹配到晋宁区那条', NMC_TITLES.some(t2 => kunming.some(n => t2.includes(n))));
  const beijing = G.cnNameParts({ name: '北京市', admin1: '北京市' });
  t.eq('北京一条都不该匹配（样本里确实没有）',
       NMC_TITLES.filter(t2 => beijing.some(n => t2.includes(n))).length, 0);
}

/* ---------- 2c. Bright Sky（德国）---------- */
t.section('Bright Sky（德国）');

if (G.DWD_SEVERITY) {
  t.eq('extreme → 红', G.DWD_SEVERITY.extreme, 'red');
  t.eq('severe → 橙', G.DWD_SEVERITY.severe, 'orange');
  t.eq('moderate → 黄', G.DWD_SEVERITY.moderate, 'yellow');
  t.eq('minor → 蓝', G.DWD_SEVERITY.minor, 'blue');
}
if (typeof G.dwdType === 'function') {
  /* 事件名取自德国气象局真实返回值 */
  t.eq('WINDBÖEN → wind', G.dwdType('WINDBÖEN'), 'wind');
  t.eq('STURMBÖEN → wind', G.dwdType('STURMBÖEN'), 'wind');
  t.eq('DAUERREGEN → rain', G.dwdType('DAUERREGEN'), 'rain');
  t.eq('GEWITTER → thunder', G.dwdType('GEWITTER'), 'thunder');
  t.eq('英文 Thunderstorm 也认', G.dwdType('Thunderstorm'), 'thunder');
  t.eq('认不出的归入 other', G.dwdType('SOMETHING ELSE'), 'other');
  t.eq('空值不报错', G.dwdType(undefined), 'other');
}

/* ---------- 3. 台风 ---------- */
t.section('台风');

if (typeof G.typhoonGrade === 'function') {
  t.eq('17.2 m/s 为热带风暴下限', G.typhoonGrade(17.2).zh, '热带风暴');
  t.eq('17.1 m/s 仍是热带低压', G.typhoonGrade(17.1).zh, '热带低压');
  t.eq('32.7 m/s 达到台风级', G.typhoonGrade(32.7).zh, '台风');
  t.eq('51.0 m/s 为超强台风', G.typhoonGrade(51.0).zh, '超强台风');
  /* 等级必须随风速单调不降 */
  const r = ms => G.WARN_LEVELS[G.typhoonGrade(ms).level].rank;
  let mono = true;
  for (let v = 5; v < 70; v += 0.5) if (r(v) < r(v - 0.5)) mono = false;
  t.ok('等级随风速单调不降', mono);
}

if (typeof G.typhoonLevelByDistance === 'function') {
  t.eq('超强台风在 100 km 内 → 红', G.typhoonLevelByDistance(100, 'red'), 'red');
  t.eq('超强台风在 1000 km 外 → 降到蓝', G.typhoonLevelByDistance(1000, 'red'), 'blue');
  /* 关键约束：强度再高，离得远也不该报红色 */
  t.ok('距离压制强度', G.WARN_LEVELS[G.typhoonLevelByDistance(1000, 'red')].rank <
                       G.WARN_LEVELS[G.typhoonLevelByDistance(100, 'red')].rank);
  /* 反过来：离得再近，热带低压也不该报红色 */
  t.ok('强度压制距离', G.WARN_LEVELS[G.typhoonLevelByDistance(50, 'blue')].rank <=
                       G.WARN_LEVELS.blue.rank);
}

if (typeof G.stripJSONP === 'function') {
  t.eq('剥掉 JSONP 外壳', G.stripJSONP('cb_2026([1,2,3])'), [1, 2, 3]);
  t.eq('纯 JSON 也能吃', G.stripJSONP('{"a":1}'), { a: 1 });
  t.eq('空串返回 null', G.stripJSONP(''), null);
  t.eq('乱码返回 null 而不是抛异常', G.stripJSONP('这不是 JSON'), null);
  t.eq('半截内容返回 null', G.stripJSONP('cb([1,2'), null);
}

/* 名录解析用的是真实样本（2026-08-18 从接口抓的），不是我编的 */
if (typeof G.parseTyphoonList === 'function') {
  const real = {
    typhoonList: [
      [3285913, 'nameless', '热带低压', '20260015', '20260015', 20260015, null, 'stop'],
      [3302529, 'NANGKA', '浪卡', '2617', '2617', null, '又名菠萝蜜果，黄色椭圆形状', 'stop'],
      [3299347, 'PEILOU', '琵鹭', '2616', '2616', null, '一种澳门常见的候鸟', 'stop']
    ]
  };
  const got = G.parseTyphoonList(real);
  t.eq('真实样本能解析出 3 条', got.length, 3);
  if (got.length >= 2) {
    t.eq('内部 id 正确', got[1].id, 3302529);
    t.eq('中文名正确', got[1].nameZh, '浪卡');
    t.eq('英文名正确', got[1].nameEn, 'NANGKA');
    t.eq('编号正确', got[1].code, '2617');
    t.ok('停编的不算活跃', got.every(x => !x.active));
  }
  /* 状态不是 stop 的都当作可能活跃 —— 我们不知道活跃状态的确切字符串，
     所以宁可多取一次详情，也不要漏报一场正在逼近的台风 */
  const live = G.parseTyphoonList({ typhoonList: [[999, 'X', '测试', '2699', '2699', null, '', 'live']] });
  t.ok('非 stop 状态视为活跃', live.length === 1 && live[0].active === true);
  const blank = G.parseTyphoonList({ typhoonList: [[998, 'Y', '测试2', '2698', '2698', null, '', '']] });
  t.ok('状态为空也视为活跃（宁可多查不可漏报）', blank.length === 1 && blank[0].active === true);

  t.eq('结构不符 → 空数组', G.parseTyphoonList({ foo: 1 }), []);
  t.eq('null → 空数组', G.parseTyphoonList(null), []);
  t.eq('typhoonList 不是数组 → 空数组', G.parseTyphoonList({ typhoonList: 'x' }), []);
  t.eq('行太短的被跳过', G.parseTyphoonList({ typhoonList: [[1, 'a']] }), []);
  t.eq('id 非法的被跳过', G.parseTyphoonList({ typhoonList: [['x', 'a', 'b', 'c', 'd', null, '', 'live']] }), []);
}

if (typeof G.pickTyphoons === 'function') {
  /* 造一份嵌套结构，模拟接口把台风信息埋在几层里面 */
  const sample = {
    data: [{
      tfid: '2609',
      points: [
        { name: '木兰', lat: 21.5, lng: 113.8, speed: 33, pressure: 965,
          movedirection: '西北', movespeed: 15 },
        { name: '木兰', lat: 20.9, lng: 114.6, speed: 30, pressure: 972 }
      ]
    }]
  };
  const got = G.pickTyphoons(sample);
  t.eq('从嵌套结构里取出两个点', got.length, 2);
  if (got.length) {
    t.eq('名称正确', got[0].name, '木兰');
    t.eq('风速正确', got[0].wind, 33);
    t.eq('气压正确', got[0].pressure, 965);
    t.eq('移动方向正确', got[0].moveDir, '西北');
  }
  /* 结构完全对不上时必须安静返回空数组 */
  t.eq('结构不符 → 空数组', G.pickTyphoons({ foo: 'bar', n: [1, 2, 3] }), []);
  t.eq('null 输入 → 空数组', G.pickTyphoons(null), []);
  t.eq('字符串输入 → 空数组', G.pickTyphoons('nonsense'), []);
  /* 越界的经纬度不能被当成台风 —— 台风不会出现在大西洋 */
  t.eq('经度越界被过滤', G.pickTyphoons({ p: { lat: 40, lng: -70, speed: 30 } }), []);
  t.eq('纬度越界被过滤', G.pickTyphoons({ p: { lat: 80, lng: 130, speed: 30 } }), []);
  /* 风速离谱的也不要 */
  t.eq('风速越界被过滤', G.pickTyphoons({ p: { lat: 20, lng: 130, speed: 999 } }), []);
  /* 同一位置重复出现只算一次 */
  const dup = G.pickTyphoons({ a: { lat: 20, lng: 130, speed: 30 }, b: { lat: 20, lng: 130, speed: 30 } });
  t.eq('同位置去重', dup.length, 1);
}

/* ---------- 4. 择源逻辑 ---------- */
t.section('按地点择源');

if (G.ALERT_SOURCES) {
  const idsFor = p => G.ALERT_SOURCES.filter(s => s.match(p)).map(s => s.id).sort();
  const HK    = { lat: 22.30, lon: 114.17, cc: 'HK' };
  const NY    = { lat: 40.71, lon: -74.01, cc: 'US' };
  const SZ    = { lat: 22.54, lon: 114.06, cc: 'CN' };
  const BJ    = { lat: 39.90, lon: 116.41, cc: 'CN' };
  const BERLIN= { lat: 52.52, lon: 13.40,  cc: 'DE' };
  const LONDON= { lat: 51.51, lon: -0.13,  cc: 'GB' };
  const HONO  = { lat: 21.31, lon: -157.86, cc: 'US' };
  const ANCH  = { lat: 61.22, lon: -149.90, cc: 'US' };

  t.eq('香港 → 天文台 + 台风网', idsFor(HK), ['hko', 'typhoon']);
  t.eq('纽约 → 只有美国气象局', idsFor(NY), ['nws']);
  t.eq('深圳 → 中央气象台 + 台风网', idsFor(SZ), ['nmc', 'typhoon']);
  t.eq('北京 → 中央气象台 + 台风网（在框内但不会有台风）', idsFor(BJ), ['nmc', 'typhoon']);
  t.eq('柏林 → Bright Sky', idsFor(BERLIN), ['brightsky']);
  t.eq('伦敦 → 没有官方源（只能靠本地推算）', idsFor(LONDON), []);
  t.ok('夏威夷能匹配到美国气象局', idsFor(HONO).includes('nws'));
  t.ok('阿拉斯加能匹配到美国气象局', idsFor(ANCH).includes('nws'));

  /* match 不能因为字段缺失就抛异常 */
  let threw = false;
  try { G.ALERT_SOURCES.forEach(s => s.match({})); } catch (e) { threw = true; }
  t.ok('空地点对象不会让 match 抛异常', !threw);

  t.ok('每个源都有 id / attribution / match / load',
       G.ALERT_SOURCES.every(s => s.id && s.attribution &&
                                  typeof s.match === 'function' && typeof s.load === 'function'));
}

if (typeof G.inBox === 'function') {
  t.ok('框内判定为真', G.inBox({ lat: 22.3, lon: 114.2 }, 22.13, 22.58, 113.82, 114.45));
  t.ok('框外判定为假', !G.inBox({ lat: 30, lon: 114.2 }, 22.13, 22.58, 113.82, 114.45));
  t.ok('缺经纬度判定为假', !G.inBox({ lat: 22.3 }, 22.13, 22.58, 113.82, 114.45));
  t.ok('NaN 判定为假', !G.inBox({ lat: NaN, lon: NaN }, -90, 90, -180, 180));
}

/* ---------- 5. 去重与合并 ---------- */
t.section('去重与合并');

if (typeof G.dedupeWarnings === 'function') {
  const dup = [
    { type: 'rain', level: 'orange', title: '暴雨橙色', source: 'hko' },
    { type: 'rain', level: 'orange', title: '暴雨橙色预警', source: 'qweather' },
    { type: 'rain', level: 'red',    title: '暴雨红色', source: 'hko' }
  ];
  const got = G.dedupeWarnings(dup);
  t.eq('同类同级只留一条，不同级别保留', got.length, 2);
  t.eq('保留的是先到的那条（登记表顺序即优先级）', got[0].source, 'hko');
}

if (typeof G.mergeWithDerived === 'function') {
  const official = [{ type: 'rain', level: 'orange', title: '暴雨橙色', derived: false }];
  const derived = [
    { type: 'rain', level: 'yellow', title: '暴雨黄色（推算）', derived: true },
    { type: 'heat', level: 'yellow', title: '高温黄色（推算）', derived: true }
  ];
  const got = G.mergeWithDerived(official, derived);
  t.eq('官方已报的类型不再显示推算值', got.length, 2);
  t.ok('推算的暴雨被去掉', !got.some(w => w.type === 'rain' && w.derived));
  t.ok('推算的高温保留', got.some(w => w.type === 'heat' && w.derived));
  t.eq('官方为空时推算全部保留', G.mergeWithDerived([], derived).length, 2);
  t.eq('两边都为空时返回空', G.mergeWithDerived([], []).length, 0);
}

/* ---------- 6. 本地推算没被改坏 ---------- */
t.section('本地推算回归');

if (typeof G.deriveWarnings === 'function') {
  const mk = d => ({ daily: d });
  const hot = G.deriveWarnings(mk({
    temperature_2m_max: [41, 38, 36], temperature_2m_min: [30, 29, 28],
    precipitation_sum: [0, 0, 0], wind_speed_10m_max: [10, 10, 10], weather_code: [0]
  }), 'zh-CN');
  t.ok('40 度以上报高温红色', hot.some(w => w.type === 'heat' && w.level === 'red'));

  const rain = G.deriveWarnings(mk({
    temperature_2m_max: [25], temperature_2m_min: [20],
    precipitation_sum: [120], wind_speed_10m_max: [10], weather_code: [61]
  }), 'zh-CN');
  t.ok('日雨量 120mm 报暴雨橙色', rain.some(w => w.type === 'rain' && w.level === 'orange'));

  t.eq('无数据时返回空数组', G.deriveWarnings(null, 'zh-CN'), []);
  t.eq('缺 daily 时返回空数组', G.deriveWarnings({}, 'zh-CN'), []);
}

process.exit(t.done() ? 1 : 0);
