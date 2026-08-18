/* ===== 网络层：Open-Meteo 全系免 key 接口 ===== */

const API = {
  geo:     'https://geocoding-api.open-meteo.com/v1/search',
  forecast:'https://api.open-meteo.com/v1/forecast',
  air:     'https://air-quality-api.open-meteo.com/v1/air-quality',
  archive: 'https://archive-api.open-meteo.com/v1/archive'
};
/* 存档数据边界：ERA5 起始 1940-01-01；近两天为 ERA5T 预备版，留 2 天安全余量 */
const ARCHIVE_MIN = '1940-01-01';
const ARCHIVE_LAG_DAYS = 2;
const RANGE_MAX_DAYS = 400;      /* 区间图上限，防止一次拉太多 */
const COMPARE_YEARS_MAX = 15;

/* HTML 转义：所有来自网络的字符串在进入 innerHTML 前必须过这一道 */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* 数组里剔除 null/NaN 后再做 Math.min/max/求和，避免 null 被当成 0 */
const nums = a => (a||[]).filter(v => v!=null && isFinite(v));

function showErr(msg){
  const el = document.querySelector('#errbar'); if(!el) return;
  el.style.display='block';
  el.innerHTML = `<b>${T('errPrefix')}</b>${msg}
    <button onclick="location.reload()">${T('reload')}</button>
    <button onclick="document.querySelector('#errbar').style.display='none'">${T('dismiss')}</button>`;
  console.error(msg);
}
if(typeof window!=='undefined'){
  window.addEventListener('error', e=>showErr(T('errLine',{msg:e.message, n:e.lineno||'?'})));
  window.addEventListener('unhandledrejection', e=>showErr(T('errAsync',{msg:(e.reason&&e.reason.message)||e.reason})));
}

async function fetchJSON(url,{tries=2,ms=20000}={}){
  let last;
  for(let i=0;i<tries;i++){
    let ac=null,timer=null;
    try{
      const opt={cache:'no-store'};
      if(typeof AbortController!=='undefined'){ ac=new AbortController(); opt.signal=ac.signal;
        timer=setTimeout(()=>ac.abort(),ms); }
      const r=await fetch(url,opt);
      if(timer) clearTimeout(timer);
      if(!r.ok) throw new Error(T('errHttp',{n:r.status}));
      return await r.json();
    }catch(e){
      if(timer) clearTimeout(timer);
      last = (e.name==='AbortError') ? new Error(T('errTimeout',{n:ms/1000}))
           : /^(Failed to fetch|fetch failed|NetworkError.*|Load failed)$/i.test(e.message||'')
             ? new Error(T('errBlocked',{msg:e.message}))
           : e;
      if(i<tries-1) await new Promise(r=>setTimeout(r,900));
    }
  }
  throw last;
}
const qs = o => Object.entries(o).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('&');

function normGeo(results){
  return (results||[]).map(x=>({
    id:Number(x.id)||0, name:esc(x.name), country:esc(x.country||''), cc:esc(x.country_code||''),
    admin1:esc(x.admin1||''), admin2:esc(x.admin2||''),
    lat:Number(x.latitude), lon:Number(x.longitude),
    tz:esc(x.timezone||'UTC'), pop:Number(x.population)||0, elev:x.elevation
  })).filter(x=>isFinite(x.lat)&&isFinite(x.lon));
}
const hasCJK = s => /[㐀-鿿豈-﫿]/.test(String(s||''));

/* 匹配度打分：名字完全相同 > 前缀 > 包含 > 其他，同分再比人口。
   候选名包括接口返回名、内置库的中英文名，这样「伦敦」也能命中英文结果 London。 */
function scoreMatch(x, q){
  const ql = String(q).trim().toLowerCase();
  if(!ql) return 10;
  const off = CITY_BY_ID[x.id];
  const cands = [x.name, off&&off.name, off&&off.en].filter(Boolean).map(s=>String(s).toLowerCase());
  if(cands.some(c=>c===ql)) return 100;
  if(cands.some(c=>c.startsWith(ql))) return 70;
  if(cands.some(c=>ql.startsWith(c)&&c.length>=2)) return 55;
  if(cands.some(c=>c.includes(ql))) return 40;
  return 10;
}
function rankResults(list, q){
  return list.slice().sort((a,b)=>
    (scoreMatch(b,q)-scoreMatch(a,q)) || ((b.pop||0)-(a.pop||0)));
}
/* 用内置城市库给在线结果补中文名。
   接口中文索引缺很多大城市，命中的往往是英文条目，
   所以城市名和国家名都要补回中文，英文名保留在 enName 供副标题显示。 */
function withZhNames(list){
  return list.map(x=>{
    const off = CITY_BY_ID[x.id];
    if(!off) return x;
    const zhCountry = (typeof countryName==='function') ? countryName(x.cc, x.country) : x.country;
    return {...x,
      name: off.name || x.name,
      enName: (off.name && off.name!==x.name) ? x.name : (x.enName||off.en),
      country: /[㐀-鿿]/.test(zhCountry||'') ? zhCountry : x.country
    };
  });
}
/* 单次在线查询 */
async function geoQuery(name, lang='en'){
  const j = await fetchJSON(`${API.geo}?${qs({name,count:10,language:lang,format:'json'})}`,{tries:2,ms:15000});
  return normGeo(j.results);
}
/* 多语言并行查询后按 id 去重合并。
   必须这么做：Open-Meteo 的 language=zh 索引严重残缺——
   搜 "new york" 拿不到纽约市，搜 "纽约" 零结果，搜 "伦敦" 只给加拿大的伦敦。 */
async function geoMulti(q){
  const jobs = [];
  jobs.push(geoQuery(q,'en'));                       // 英文索引最全，永远查
  if(hasCJK(q)) jobs.push(geoQuery(q,'zh'));         // 中文原名也查，捞国内小地方
  const en = CITY_ZH2EN[q.trim()];                   // 内置库能翻译就再查一次英文名
  if(en) jobs.push(geoQuery(en,'en'));
  const settled = await Promise.allSettled(jobs);
  const seen = new Set(), out = [];
  for(const r of settled){
    if(r.status!=='fulfilled') continue;
    for(const x of r.value){ if(!seen.has(x.id)){ seen.add(x.id); out.push(x); } }
  }
  return out;
}
/* 查地级市：Open-Meteo 的中文名收录不统一，
   "惠州"是裸名，"佛山市"却带市字，搜"佛山"只能搜到几个同名村（人口 0）。
   所以两种写法都试，取人口最大的那份结果。 */
async function geoQueryCity(city){
  const variants = city.endsWith('市') ? [city, city.slice(0,-1)] : [city, city+'市'];
  let best = [];
  for(const v of variants){
    let r = [];
    try{ r = await geoMulti(v); }catch(e){ continue; }
    if(!r.length) continue;
    const pop = Math.max(...r.map(x=>x.pop||0));
    const bestPop = best.length ? Math.max(...best.map(x=>x.pop||0)) : -1;
    if(pop > bestPop) best = r;
    if(pop >= 50000) break;          // 已经拿到像样的城市，不必再试另一种写法
  }
  return best;
}

/* ---- 城市搜索：在线 → 区县翻译重搜 → 内置城市库 ---- */
async function geoSearch(q){
  try{
    /* 转义在 normGeo 里一次性收口：下游 51 处 innerHTML 都不必再各自处理 */
    const list = rankResults(withZhNames(await geoMulti(q)), q).slice(0,10);
    /* 中国区县兜底：Open-Meteo 只收录地级市。
       两种情况都要翻译：
         a) 在线零结果（搜"惠阳"）
         b) 在线只匹配到人口极小的同名村落（搜"昆山"会命中福建三明的昆山村，
            而用户要的是江苏昆山），此时把地级市结果排到前面，同名小地方保留在后 */
    const bestPop = list.length ? Math.max(...list.map(x=>x.pop||0)) : 0;
    const city = (typeof districtToCity==='function') ? districtToCity(q) : null;
    /* 门槛设 30 万：中国地级市普遍在此之上，低于这个数说明在线命中的
       多半是同名村镇（山东有个"雁塔"7.9 万人，西安雁塔区才是用户要的）。
       两份结果会合并，同名小地点仍保留在下方，不会丢。 */
    if(city && city!==q && bestPop < 300000){
      let l2 = [];
      try{ l2 = await geoQueryCity(city); }catch(e){}
      if(l2.length){
        const seen = new Set(l2.map(x=>x.id));
        const merged = rankResults(withZhNames(l2),city).concat(list.filter(x=>!seen.has(x.id)));
        return {list:merged.slice(0,10), offline:false, viaDistrict:{from:q, to:city, hadLocal:list.length>0}};
      }
    }
    if(list.length) return {list, offline:false};
    /* 还是没有 → 内置库模糊匹配，并明确告诉用户这不是真实搜索结果 */
    return {list:searchOffline(q), offline:true, empty:true};
  }catch(e){
    const local = searchOffline(q);
    if(local.length) return {list:local, offline:true, err:e.message};
    throw e;
  }
}

/* ---- 预报（含海拔、体感、UV、15 分钟粒度）----
   cell_selection=land：沿海地点默认可能被分到海上格子，温度偏低。
   实测三亚：nearest 格心 109.4927 给 27.9°，land 移到 109.5805 给 30.2°，差 2.3°。
   青岛栈桥同样差 1.6°。沿海城市这一项是免费的准确度提升。 */
async function getWeather(p){
  return fetchJSON(`${API.forecast}?${qs({
    latitude:p.lat, longitude:p.lon,
    current:'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover',
    daily:'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max',
    minutely_15:'temperature_2m,precipitation,weather_code,wind_speed_10m',
    forecast_minutely_15:192,        /* 只要 48 小时：8 天要 29KB，48 小时只要 9KB */
    timezone:p.tz, forecast_days:8, cell_selection:'land'
  })}`,{tries:2,ms:20000});
}
/* ---- 空气质量 + 实时 UV ---- */
async function getAir(p){
  return fetchJSON(`${API.air}?${qs({
    latitude:p.lat, longitude:p.lon,
    current:'pm2_5,pm10,uv_index,european_aqi,us_aqi,ozone,nitrogen_dioxide',
    timezone:p.tz
  })}`,{tries:1,ms:15000});
}
/* ---- 过去 N 天的实际天气（存档接口），用于拼在预报前面 ---- */
async function getRecentPast(p, days=3){
  const end   = new Date(Date.now() - 864e5);          // 昨天
  const start = new Date(Date.now() - days*864e5);
  const f = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  const j = await getArchive(p, f(start), f(end),
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max');
  const D = j.daily || {};
  return (D.time||[]).map((t,i)=>({
    date:t,
    code: D.weather_code?D.weather_code[i]:null,
    hi:   D.temperature_2m_max?D.temperature_2m_max[i]:null,
    lo:   D.temperature_2m_min?D.temperature_2m_min[i]:null,
    pr:   D.precipitation_sum?D.precipitation_sum[i]:null,
    wind: D.wind_speed_10m_max?D.wind_speed_10m_max[i]:null,
    past: true
  })).filter(x=>x.hi!=null);
}

/* 反推所用网格的大致分辨率（用返回的格心与请求点的偏移量估计，仅供展示） */
function gridNote(j, p){
  if(!j || j.latitude==null) return null;
  const dLat = Math.abs(j.latitude - p.lat), dLon = Math.abs(j.longitude - p.lon);
  const km = Math.max(dLat*111.32, dLon*111.32*Math.cos(p.lat*Math.PI/180));
  return {lat:j.latitude, lon:j.longitude, offsetKm:km};
}
/* ---- 历史存档 ---- */
function archiveMaxDate(){
  const d=new Date(Date.now()-ARCHIVE_LAG_DAYS*864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}
async function getArchive(p, start, end, extra){
  return fetchJSON(`${API.archive}?${qs({
    latitude:p.lat, longitude:p.lon,
    start_date:start, end_date:end,
    daily: extra || 'weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum,wind_speed_10m_max',
    timezone:p.tz
  })}`,{tries:2,ms:35000});
}
