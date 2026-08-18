/* ===== 可选数据源：和风天气格点预报（3–5 km） =====

   为什么做成可选：
     Open-Meteo 在中国只有约 10 km 网格（欧美有 1–3 km，因为那边气象局开放了
     中尺度模式数据）。和风的格点接口全球 3–5 km，但需要 API Key。
     本项目是纯静态站，密钥藏不住，所以由用户自己填、只存在自己浏览器里。

   免费版额度：1000 次/天，QPM 100，含格点实况 + 24 小时逐小时 + 3–7 天逐日。
   注意：和风公告 2027-01-01 起会限制 API KEY 方式的每日请求量，届时需改用 JWT。

   凭据存 localStorage，不会上传到任何地方，也不会进 Git（dist/ 已被 .gitignore）。 */

const QW_LS = 'tianshi.qweather';
let QW = { host:'', key:'', enabled:false, lastError:null };

function qwLoad(){
  try{
    const o = JSON.parse(localStorage.getItem(QW_LS) || 'null');
    if(o){ QW.host=o.host||''; QW.key=o.key||''; QW.enabled=!!o.enabled; }
  }catch(e){}
  return QW;
}
function qwSave(){
  try{ localStorage.setItem(QW_LS, JSON.stringify({host:QW.host,key:QW.key,enabled:QW.enabled})); }catch(e){}
}
function qwReady(){ return !!(QW.enabled && QW.host && QW.key); }
/* 用户可能粘贴 "abc.qweatherapi.com" 或 "https://abc.qweatherapi.com/" */
function qwNormHost(h){
  h = String(h||'').trim().replace(/\/+$/,'');
  if(!h) return '';
  if(!/^https?:\/\//i.test(h)) h = 'https://' + h;
  return h;
}
async function qwFetch(path, params){
  const url = `${qwNormHost(QW.host)}${path}?${qs({...params, key:QW.key})}`;
  const j = await fetchJSON(url, {tries:1, ms:15000});
  /* 和风用 code 字段表示业务状态，200 才是成功 */
  if(j.code !== '200'){
    const msg = ['204','400','401','402','403','404','429','500'].includes(String(j.code))
      ? T('qwe'+j.code) : T('qweOther',{c:j.code});
    throw new Error(msg);
  }
  return j;
}

/* 和风天气代码 → 本项目使用的 WMO 代码，用同一套图标 */
function qwIconToWmo(icon){
  const n = parseInt(icon,10);
  if(n===100) return 0;                       // 晴
  if(n===101||n===102) return 1;              // 多云/少云
  if(n===103) return 2;                       // 晴间多云
  if(n===104) return 3;                       // 阴
  if(n>=150&&n<=153) return n===150?0:(n===154?3:1);   // 夜间晴/多云
  if(n===154) return 3;
  if(n>=300&&n<=303) return 80;               // 阵雨
  if(n>=304&&n<=304) return 96;               // 强阵雨伴冰雹
  if(n>=305&&n<=305) return 61;               // 小雨
  if(n===306) return 63;                      // 中雨
  if(n===307) return 65;                      // 大雨
  if(n>=308&&n<=312) return 82;               // 极端/暴雨类
  if(n===313) return 66;                      // 冻雨
  if(n>=314&&n<=317) return 63;
  if(n>=318&&n<=318) return 82;
  if(n>=350&&n<=351) return 80;
  if(n===399) return 61;
  if(n>=400&&n<=401) return 71;               // 小雪
  if(n===402) return 73;                      // 中雪
  if(n===403) return 75;                      // 大雪
  if(n>=404&&n<=406) return 85;               // 雨夹雪
  if(n>=407&&n<=410) return 85;
  if(n>=456&&n<=457) return 85;
  if(n===499) return 71;
  if(n>=500&&n<=501) return 45;               // 雾
  if(n>=502&&n<=515) return 45;               // 霾/沙尘也归到雾类图标
  if(n>=900&&n<=901) return 0;
  return 3;
}

/* 拉取格点实况 + 24h 逐小时 + 7d 逐日，转成与 Open-Meteo 相同的结构，
   这样上层渲染代码完全不用改。 */
async function qwGetWeather(p){
  const loc = `${(+p.lon).toFixed(4)},${(+p.lat).toFixed(4)}`;   // 和风是经度在前
  const [now, d7, h24] = await Promise.all([
    qwFetch('/v7/grid-weather/now', {location:loc}),
    qwFetch('/v7/grid-weather/7d',  {location:loc}).catch(()=>qwFetch('/v7/grid-weather/3d',{location:loc})),
    qwFetch('/v7/grid-weather/24h', {location:loc}).catch(()=>null)
  ]);
  const N = now.now, D = d7.daily || [];
  const num = v => (v==null||v==='') ? null : Number(v);

  const daily = {
    time: D.map(x=>x.fxDate),
    weather_code: D.map(x=>qwIconToWmo(x.iconDay)),
    temperature_2m_max: D.map(x=>num(x.tempMax)),
    temperature_2m_min: D.map(x=>num(x.tempMin)),
    apparent_temperature_max: D.map(()=>null),
    apparent_temperature_min: D.map(()=>null),
    sunrise: D.map(x=>x.fxDate+'T'+(x.sunrise||'06:00')),
    sunset:  D.map(x=>x.fxDate+'T'+(x.sunset ||'18:00')),
    precipitation_sum: D.map(x=>num(x.precip)),
    precipitation_probability_max: D.map(()=>null),
    wind_speed_10m_max: D.map(x=>num(x.windSpeedDay)),
    uv_index_max: D.map(x=>num(x.uvIndex))
  };
  const out = {
    latitude:p.lat, longitude:p.lon, timezone:p.tz,
    elevation: p.elev!=null ? p.elev : null,
    current:{
      time: N.obsTime,
      temperature_2m: num(N.temp),
      relative_humidity_2m: num(N.humidity),
      apparent_temperature: num(N.feelsLike),
      is_day: /^(1[0-4]\d|9\d\d)$/.test(N.icon) ? 1 : (parseInt(N.icon,10)<150?1:0),
      precipitation: num(N.precip),
      weather_code: qwIconToWmo(N.icon),
      wind_speed_10m: num(N.windSpeed),
      wind_direction_10m: num(N.wind360),
      wind_gusts_10m: null,
      pressure_msl: num(N.pressure),
      cloud_cover: num(N.cloud)
    },
    daily,
    _source: 'qweather',
    _sourceLabel: T('srcQWLabel'),
    _qwText: N.text
  };
  /* 逐小时映射到 15 分钟结构，复用同一个日内图表 */
  if(h24 && h24.hourly && h24.hourly.length){
    out.minutely_15 = {
      time: h24.hourly.map(x=>x.fxTime.slice(0,16)),
      temperature_2m: h24.hourly.map(x=>num(x.temp)),
      precipitation: h24.hourly.map(x=>num(x.precip)),
      weather_code: h24.hourly.map(x=>qwIconToWmo(x.icon)),
      wind_speed_10m: h24.hourly.map(x=>num(x.windSpeed))
    };
    out._intradayStep = 60;      // 和风是逐小时，不是 15 分钟
  }
  return out;
}
/* 连接自检：返回一句人话结果 */
async function qwTest(p){
  const loc = `${(+p.lon).toFixed(4)},${(+p.lat).toFixed(4)}`;
  const t0 = Date.now();
  const j = await qwFetch('/v7/grid-weather/now', {location:loc});
  return T('qwOk',{ms:Date.now()-t0, t:j.now.temp, text:j.now.text});
}
