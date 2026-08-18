/* ===== 气候问答：历年同期统计 + 与今年预报对比（纯本地规则） ===== */

const mean = a => a.length ? a.reduce((x,y)=>x+y,0)/a.length : null;
const round1 = v => v==null ? null : Math.round(v*10)/10;

const isLeapYear = y => (y%4===0 && y%100!==0) || y%400===0;

/**
 * 拉取过去 years 年、目标日期前后 window 天的历史数据
 * 按「跨年事件」分桶：目标日在 Y 年，窗口取 Y-m-d 的真实前后 window 天，
 * 即使跨到 Y-1 年 12 月也归入桶 Y。闰年按 366 天处理。
 */
async function fetchSamePeriod(place, month, day, years=10, window=3){
  const nowY = new Date().getFullYear();
  const y1 = nowY - years, y2 = nowY - 1;
  /* 请求区间要多留 window 天，覆盖 y1 年初往前跨到 y1-1 年末的那几天 */
  const startD = new Date(Date.UTC(y1, month-1, day) - window*864e5);
  const endD   = new Date(Date.UTC(y2, month-1, day) + window*864e5);
  const fmt = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  const j = await getArchive(place, fmt(startD), fmt(endD),
    'weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum');
  const D = j.daily;

  /* 先算出每个回溯年的目标日 UTC 时间戳（2/29 在平年降级到 2/28） */
  const targets = [];
  for(let Y=y1; Y<=y2; Y++){
    let mm=month, dd=day;
    if(month===2 && day===29 && !isLeapYear(Y)) dd=28;
    targets.push({year:Y, t:Date.UTC(Y, mm-1, dd)});
  }
  const buckets={};
  for(let i=0;i<D.time.length;i++){
    if(D.temperature_2m_max[i]==null) continue;
    const [yy,mm,dd]=D.time[i].split('-').map(Number);
    const cur=Date.UTC(yy,mm-1,dd);
    /* 归到距离最近的那个目标日；超出窗口则丢弃 */
    let best=null,bd=Infinity;
    for(const tg of targets){ const diff=Math.abs(Math.round((cur-tg.t)/864e5));
      if(diff<bd){bd=diff;best=tg;} }
    if(!best || bd>window) continue;
    (buckets[best.year]=buckets[best.year]||[]).push({
      date:D.time[i], code:D.weather_code[i],
      hi:D.temperature_2m_max[i], lo:D.temperature_2m_min[i],
      mid:D.temperature_2m_mean?D.temperature_2m_mean[i]:null, pr:D.precipitation_sum[i]
    });
  }
  return {buckets, elevation:j.elevation, leapAdjusted: month===2&&day===29};
}

/** 统计汇总 */
function summarize(buckets){
  const all = Object.values(buckets).flat().filter(x=>x.hi!=null&&isFinite(x.hi));
  if(!all.length) return null;
  const his = all.map(x=>x.hi), los = all.map(x=>x.lo).filter(v=>v!=null&&isFinite(v));
  const prs = all.map(x=>x.pr||0);
  const wetDays = prs.filter(v=>v>=1).length;
  /* 逐年当天（窗口中心）值，用于趋势 */
  const perYear = Object.entries(buckets).map(([y,arr])=>({
    year:+y, hi:round1(mean(arr.map(a=>a.hi).filter(v=>v!=null))),
    lo:round1(mean(arr.map(a=>a.lo).filter(v=>v!=null))),
    pr:round1(mean(arr.map(a=>a.pr||0)))
  })).sort((a,b)=>a.year-b.year);

  return {
    n: all.length,
    yearCount: Object.keys(buckets).length,
    hiMean: round1(mean(his)), loMean: round1(mean(los)),
    hiMax: round1(Math.max(...his)),
    loMin: los.length ? round1(Math.min(...los)) : null,
    hiMaxYear: all.find(x=>x.hi===Math.max(...his))?.date || null,
    loMinYear: los.length ? (all.find(x=>x.lo===Math.min(...los))?.date || null) : null,
    wetRate: Math.round(wetDays/all.length*100),
    prMean: round1(mean(prs)),
    perYear
  };
}

/** 线性趋势（°C / 10年），最小二乘 */
function trendPerDecade(perYear, field='hi'){
  const pts = perYear.filter(p=>p[field]!=null);
  if(pts.length<4) return null;
  const n=pts.length, sx=pts.reduce((s,p)=>s+p.year,0), sy=pts.reduce((s,p)=>s+p[field],0);
  const sxy=pts.reduce((s,p)=>s+p.year*p[field],0), sxx=pts.reduce((s,p)=>s+p.year*p.year,0);
  const denom = n*sxx-sx*sx; if(!denom) return null;
  return round1(((n*sxy-sx*sy)/denom)*10);
}

/**
 * 生成结论文本（数组，每项一段）
 * @param stat  summarize() 结果
 * @param today {hi,lo,code,pop,uv,elev,wind,rh}  今年该日的预报（可为 null）
 */
function climateNarrative(stat, today, place, month, day, years){
  if(!stat) return [T('climNoData')];
  const out = [];
  const dateLabel = T('climDateLabel', {m:month, d:day, mn:MN(month)});

  const nz = v => (v==null||!isFinite(v)) ? '\u2014' : v;
  out.push(T('climAvg', {years:stat.yearCount, place:esc(place.name), date:dateLabel,
                         n:stat.n, hi:nz(stat.hiMean), lo:nz(stat.loMean)}));
  out.push(T('climExtreme', {hiMax:nz(stat.hiMax), hiDate:stat.hiMaxYear||'\u2014',
                             loMin:nz(stat.loMin), loDate:stat.loMinYear||'\u2014',
                             wet:stat.wetRate, pr:nz(stat.prMean)}));

  const tr = trendPerDecade(stat.perYear,'hi');
  if(tr!=null && Math.abs(tr)>=0.3)
    out.push(T('climTrend', {dir: tr>0?T('climTrendUp'):T('climTrendDown'), v:Math.abs(tr)}));

  if(today && today.hi!=null){
    const dHi = round1(today.hi - stat.hiMean);
    const dLo = (today.lo!=null && stat.loMean!=null) ? round1(today.lo - stat.loMean) : null;
    let verdict;
    const a=Math.abs(dHi);
    if(a<1) verdict=T('climSame');
    else if(a<3) verdict = dHi>0?T('climSlightWarm'):T('climSlightCool');
    else if(a<6) verdict = dHi>0?T('climWarm'):T('climCool');
    else verdict = dHi>0?T('climHot'):T('climCold');
    const loPart  = today.lo!=null ? T('climLoPart',{lo:today.lo}) : '';
    const loDiff  = dLo!=null ? T('climLoDiff',{hl: dLo>0?T('climHigher'):T('climLower'), d:Math.abs(dLo)}) : '';
    out.push(T('climToday', {hi:today.hi, loPart, hl: dHi>0?T('climHigher'):T('climLower'),
                             d:Math.abs(dHi), loDiff, verdict}));
  }
  return out;
}
