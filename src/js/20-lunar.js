/* ===== 农历核心 1900-2100 ===== */
const LUNAR_INFO = [
0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
0x0d520];

const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const ANIMALS = '鼠牛虎兔龙蛇马羊猴鸡狗猪';
const LM_CN = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const LD_CN1 = ['初','十','廿','卅'];
const LD_CN2 = '一二三四五六七八九十';
const TERMS = ['小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨','立夏','小满','芒种','夏至',
               '小暑','大暑','立秋','处暑','白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'];

/* 该农历年天数 */
function lYearDays(y){
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[y-1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}
/* 闰月月份，0=无闰 */
function leapMonth(y){ return LUNAR_INFO[y-1900] & 0xf; }
/* 闰月天数 */
function leapDays(y){
  if (!leapMonth(y)) return 0;
  return (LUNAR_INFO[y-1900] & 0x10000) ? 30 : 29;
}
/* 农历 y 年 m 月天数 */
function monthDays(y,m){ return (LUNAR_INFO[y-1900] & (0x10000 >> m)) ? 30 : 29; }

function lunarMonthCN(m){ return LM_CN[m-1] + '月'; }
function lunarDayCN(d){
  if (d === 10) return '初十';
  if (d === 20) return '二十';
  if (d === 30) return '三十';
  return LD_CN1[Math.floor(d/10)] + LD_CN2[(d%10)-1];
}

/* ===== 二十四节气：天文算法（太阳视黄经）===== */
function jdFromDate(y,m,d,h,mi,s){
  if (m <= 2){ y -= 1; m += 12; }
  const A = Math.floor(y/100), B = 2 - A + Math.floor(A/4);
  return Math.floor(365.25*(y+4716)) + Math.floor(30.6001*(m+1)) + d + B - 1524.5
       + (h + mi/60 + (s||0)/3600)/24;
}
function sunApparentLongitude(jd){
  const T = (jd - 2451545.0)/36525;
  const L0 = 280.46646 + 36000.76983*T + 0.0003032*T*T;
  const M  = 357.52911 + 35999.05029*T - 0.0001537*T*T;
  const Mr = M*Math.PI/180;
  const C = (1.914602 - 0.004817*T - 0.000014*T*T)*Math.sin(Mr)
          + (0.019993 - 0.000101*T)*Math.sin(2*Mr)
          + 0.000289*Math.sin(3*Mr);
  const omega = (125.04 - 1934.136*T)*Math.PI/180;
  let lam = L0 + C - 0.00569 - 0.00478*Math.sin(omega);
  return ((lam%360)+360)%360;
}
/* ΔT 近似（秒），1900-2150 */
function deltaT(y){
  const t = y - 2000;
  if (y < 1955) { const u=(y-1900)/100; return -2.79+149.4119*u-598.939*u*u+1041.264*u*u*u; }
  if (y < 2005) return 62.92 + 0.32217*t + 0.005589*t*t;
  return 62.92 + 0.32217*t + 0.005589*t*t;
}
/* 第 n 个节气(0=小寒)在 y 年的北京时间 Date */
function solarTermDate(y, n){
  // 目标黄经：小寒=285, 每个 +15
  const target = (285 + n*15) % 360;
  // 粗估：以每年固定日期为起点
  const approxMonth = Math.floor(n/2) + 1;
  const approxDay = (n % 2 === 0) ? 6 : 21;
  let jd = jdFromDate(y, approxMonth, approxDay, 12, 0, 0);
  for (let i = 0; i < 12; i++){
    let diff = sunApparentLongitude(jd) - target;
    while (diff >  180) diff -= 360;
    while (diff < -180) diff += 360;
    jd -= diff * (365.2422/360);
    if (Math.abs(diff) < 1e-7) break;
  }
  // jd 为力学时 → 世界时
  const jdUT = jd - deltaT(y)/86400;
  // 转北京时间
  const ms = (jdUT - 2440587.5) * 86400000 + 8*3600000;
  return new Date(ms); // 用 UTC getter 读出即为北京时间
}
/* 某年全部节气：返回 {'2026-02-04':'立春', ...} */
const _termCache = {};
function yearTerms(y){
  if (_termCache[y]) return _termCache[y];
  const map = {};
  for (let n = 0; n < 24; n++){
    const dt = solarTermDate(y, n);
    const key = dt.getUTCFullYear() + '-' + String(dt.getUTCMonth()+1).padStart(2,'0')
              + '-' + String(dt.getUTCDate()).padStart(2,'0');
    map[key] = TERMS[n];
  }
  return (_termCache[y] = map);
}

/* ===== 公历 → 农历 ===== */
function solarToLunar(y, m, d){
  /* 下界必须是 1900-01-31（农历基准日），不是 1900-01-01：
     否则前 30 天 offset 为负，会读到 LUNAR_INFO[-1] 产生垃圾数据 */
  if (Date.UTC(y,m-1,d) < Date.UTC(1900,0,31) || y > 2100) return null;
  const base = Date.UTC(1900,0,31);
  let offset = Math.round((Date.UTC(y,m-1,d) - base) / 86400000);
  let i, temp = 0, lYear;
  for (i = 1900; i < 2101 && offset > 0; i++){
    temp = lYearDays(i);
    offset -= temp;
  }
  if (offset < 0){ offset += temp; i--; }
  lYear = i;
  const leap = leapMonth(lYear);
  let isLeap = false, lMonth = 1;
  for (i = 1; i < 13 && offset >= 0; i++){
    if (leap > 0 && i === leap+1 && !isLeap){ --i; isLeap = true; temp = leapDays(lYear); }
    else temp = monthDays(lYear, i);
    if (isLeap && i === leap+1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap+1){
    if (isLeap) isLeap = false; else { isLeap = true; --i; }
  }
  if (offset < 0){ offset += temp; --i; }
  lMonth = i;
  const lDay = offset + 1;

  // 年干支：按农历年（正月初一分界），与民间万年历一致
  const terms = yearTerms(y);
  const cur = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  const gzYearNum = lYear - 1864; // 1864 甲子
  const ganZhiYear = GAN[((gzYearNum%10)+10)%10] + ZHI[((gzYearNum%12)+12)%12];
  const animal = ANIMALS[((gzYearNum%12)+12)%12];

  // 日干支：1900-01-31 为 甲辰日(offset基准)
  const dayNum = Math.floor((Date.UTC(y,m-1,d) - Date.UTC(1900,0,31))/86400000) + 40;
  const ganZhiDay = GAN[((dayNum%10)+10)%10] + ZHI[((dayNum%12)+12)%12];

  return {
    lYear, lMonth, lDay, isLeap,
    monthCN: (isLeap?'闰':'') + lunarMonthCN(lMonth),
    dayCN: lunarDayCN(lDay),
    ganZhiYear, animal, ganZhiDay,
    term: terms[cur] || null,
    monthDays: isLeap ? leapDays(lYear) : monthDays(lYear, lMonth)
  };
}


/* ===== 农历 → 公历 反查 =====
   @param ly 农历年  lm 农历月(1-12)  ld 农历日  isLeap 是否闰月
   @return Date(UTC) 或 null（该农历日期不存在） */
function lunarToSolar(ly, lm, ld, isLeap){
  if(ly<1900 || ly>2100) return null;
  if(lm<1 || lm>12 || ld<1 || ld>30) return null;
  const leap = leapMonth(ly);
  if(isLeap && leap !== lm) return null;                 // 该年这个月没有闰
  const dim = isLeap ? leapDays(ly) : monthDays(ly, lm);
  if(ld > dim) return null;                              // 小月没有第 30 天

  let offset = 0;
  for(let y=1900; y<ly; y++) offset += lYearDays(y);
  for(let m=1; m<lm; m++){
    offset += monthDays(ly, m);
    if(leap && m === leap) offset += leapDays(ly);       // 闰月排在本月之后
  }
  if(isLeap) offset += monthDays(ly, lm);                // 闰某月，先过完正常的某月
  offset += ld - 1;
  return new Date(Date.UTC(1900,0,31) + offset*86400000);
}
/* 某农历年是否有闰月，返回闰的月份或 0 */
function lunarLeapOf(ly){ return (ly>=1900&&ly<=2100) ? leapMonth(ly) : 0; }
