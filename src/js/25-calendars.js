/* ===== 多历法层 =====

   世界上仍在使用的非公历历法分两类：
     纯阴历   —— 伊斯兰历（希吉来历）。12 个朔望月约 354 天，不置闰，
                 所以斋月会绕着四季漂移，每年比公历早约 11 天。
     阴阳历   —— 中国农历及其近亲（越南历、韩国 음력、日本旧暦）、
                 希伯来历（19 年 7 闰）、印度各地历法、藏历、佛历。
   （常被误认作阴历的波斯历其实是纯太阳历，而且精度极高。）

   实现策略：
     * 中国农历用本项目自研引擎（20-lunar.js）。它带二十四节气、干支、
       生肖、闰月，且经过 1900–2100 全量往返验证——这些 Intl 都给不了。
     * 其余历法一律走浏览器内置的 Intl.DateTimeFormat 的 -u-ca- 扩展。
       ICU 数据由浏览器/系统维护，不必自己实现天文算法。

   已知差异：本项目农历与 ICU 的 chinese 日历在 1901–2099 有约 300 天
   日序不同、177 天仅闰月标号不同。凡能与公开历书核对的锚点（春节、闰月）
   本引擎均正确。详见 docs/lunar-vs-icu.tsv。                          */

/* 可选历法。id 为 null 表示「不显示额外历法」。
   intl 字段是 Intl 的日历标识；chinese 特殊，走自研引擎。 */
const CALENDARS = [
  { id: null,               intl: null,                labelKey: 'calNone'     },
  { id: 'chinese',          intl: null,                labelKey: 'calChinese'  },
  { id: 'dangi',            intl: 'dangi',             labelKey: 'calDangi'    },
  { id: 'japanese',         intl: 'japanese',          labelKey: 'calJapanese' },
  { id: 'islamic-umalqura', intl: 'islamic-umalqura',  labelKey: 'calIslamic'  },
  { id: 'hebrew',           intl: 'hebrew',            labelKey: 'calHebrew'   },
  { id: 'indian',           intl: 'indian',            labelKey: 'calIndian'   },
  { id: 'persian',          intl: 'persian',           labelKey: 'calPersian'  },
  { id: 'buddhist',         intl: 'buddhist',          labelKey: 'calBuddhist' },
  { id: 'coptic',           intl: 'coptic',            labelKey: 'calCoptic'   },
  { id: 'ethiopic',         intl: 'ethiopic',          labelKey: 'calEthiopic' },
  { id: 'roc',              intl: 'roc',               labelKey: 'calROC'      }
];
const CALENDAR_BY_ID = (() => { const m = {}; CALENDARS.forEach(c => m[String(c.id)] = c); return m; })();

/* 缓存 formatter：每次 new Intl.DateTimeFormat 约 40µs，日历视图一屏要调几十次 */
const _calFmtCache = new Map();
function calFormatter(intlId, locale, opts) {
  const key = intlId + '|' + locale + '|' + JSON.stringify(opts);
  let f = _calFmtCache.get(key);
  if (!f) {
    try { f = new Intl.DateTimeFormat(`${locale}-u-ca-${intlId}`, opts); }
    catch (e) { f = null; }
    _calFmtCache.set(key, f);
  }
  return f;
}
/* 某个历法在当前运行环境里是否可用。ICU 数据缺失时 Intl 会静默回落到公历，
   所以要实际比对一下结果，不能只看 try/catch。 */
function calSupported(intlId) {
  if (!intlId) return true;
  try {
    const probe = new Date(Date.UTC(2026, 7, 14));
    const f = new Intl.DateTimeFormat(`en-u-ca-${intlId}`,
      { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
    if (f.resolvedOptions().calendar !== intlId) return false;   // 被回落了
    return !!f.format(probe);
  } catch (e) { return false; }
}

/**
 * 取某个公历日期在指定历法下的表示。
 * @returns {{main:string, sub:string, isFirst:boolean}|null}
 *   main    日历格子里显示的短文本（通常是「日」）
 *   sub     详情里显示的长文本
 *   isFirst 是否为该历法月份的第一天（用于在格子里显示月名而非日号）
 */
function altCalendar(y, m, d, calId, locale) {
  if (!calId) return null;

  /* 中国农历走自研引擎 */
  if (calId === 'chinese') {
    const L = (typeof solarToLunar === 'function') ? solarToLunar(y, m, d) : null;
    if (!L) return null;
    return {
      main: L.lDay === 1 ? L.monthCN : L.dayCN,
      sub: `${L.ganZhiYear}${L.animal}年 ${L.isLeap ? '闰' : ''}${L.monthCN}${L.dayCN}`,
      short: `${L.monthCN}${L.dayCN}`,
      isFirst: L.lDay === 1,
      term: L.term || null
    };
  }

  const cal = CALENDAR_BY_ID[calId];
  if (!cal || !cal.intl) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));

  const fNum = calFormatter(cal.intl, locale,
    { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'UTC' });
  const fLong = calFormatter(cal.intl, locale,
    { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  if (!fNum) return null;

  const p = {};
  fNum.formatToParts(dt).forEach(x => { if (x.type !== 'literal') p[x.type] = x.value; });
  const day = parseInt(p.day, 10);
  if (!isFinite(day)) return null;

  /* 月名：长格式里把 month 那一段抠出来 */
  let monthName = '';
  if (fLong) {
    const lp = fLong.formatToParts(dt).find(x => x.type === 'month');
    if (lp) monthName = lp.value;
  }
  const long = fLong ? fLong.format(dt) : fNum.format(dt);

  return {
    main: day === 1 && monthName ? monthName : String(day),
    sub: long,
    short: monthName ? `${monthName} ${day}` : String(day),
    isFirst: day === 1,
    term: null
  };
}

/* 当前应使用的历法：用户显式选过就用他选的，否则用语言的默认值 */
/* 各国/地区通行的传统历法。
   只列真正日常在用的 —— 比如日本的年号纪年、伊朗的波斯历是官方日历，
   而欧美国家没有并行使用的传统历，所以不在表里。 */
const CC_DEFAULT_CALENDAR = {
  CN:'chinese', HK:'chinese', MO:'chinese', SG:'chinese', MY:'chinese',
  TW:'roc',
  KR:'dangi', KP:'dangi',
  JP:'japanese',
  IL:'hebrew',
  IN:'indian', NP:'indian',
  IR:'persian', AF:'persian',
  TH:'buddhist', KH:'buddhist', LA:'buddhist', MM:'buddhist', LK:'buddhist',
  ET:'ethiopic', ER:'ethiopic',
  EG:'coptic',
  /* 以伊斯兰历为日常历法的国家 */
  SA:'islamic-umalqura', AE:'islamic-umalqura', QA:'islamic-umalqura',
  KW:'islamic-umalqura', BH:'islamic-umalqura', OM:'islamic-umalqura',
  JO:'islamic-umalqura', IQ:'islamic-umalqura', YE:'islamic-umalqura',
  PK:'islamic-umalqura', BD:'islamic-umalqura', ID:'islamic-umalqura',
  MA:'islamic-umalqura', DZ:'islamic-umalqura', TN:'islamic-umalqura', LY:'islamic-umalqura'
};

/**
 * 当前应使用的历法。
 *
 * 用户显式选过就听他的；选「跟随」时按这个顺序推断：
 *
 *   1. 看**地点**。在北京就该看到农历，哪怕界面是英文 ——
 *      农历是那个地方的属性，不是界面语言的属性。
 *   2. 地点所在国没有并行使用的传统历（比如英国）→ 看**界面语言**。
 *      中文用户在伦敦仍然想看农历，这条兜住这种情况。
 *   3. 都没有 → 不显示。英文界面看伦敦就该是干净的公历，
 *      早先这里会莫名其妙冒出一行农历。
 *
 * @param {string} userChoice 用户在下拉框里选的，'auto' 表示跟随
 * @param {string} lang       当前界面语言
 * @param {object} place      当前地点，需要 cc 字段（国家码）
 */
function resolveCalendar(userChoice, lang, place) {
  if (userChoice !== undefined && userChoice !== 'auto') return userChoice;

  const cc = place && place.cc ? String(place.cc).toUpperCase() : '';
  if (cc && CC_DEFAULT_CALENDAR[cc]) return CC_DEFAULT_CALENDAR[cc];

  const def = (typeof LANG_DEFAULT_CALENDAR === 'object' && LANG_DEFAULT_CALENDAR)
    ? LANG_DEFAULT_CALENDAR[lang] : null;
  return def === undefined ? null : def;
}
/* 运行环境实际支持的历法列表，用于渲染下拉框 */
function availableCalendars() {
  return CALENDARS.filter(c => c.id === null || c.id === 'chinese' || calSupported(c.intl));
}
