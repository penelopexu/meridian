/* ===== 手绘 SVG 图表（零依赖，离线可用） ===== */

/* 从 CSS 变量取色，这样换主题/调色板时图表自动跟随，不必改 JS。
   读不到（比如 Node 里跑测试）就退回一组默认值。 */
function cssVar(name, fallback){
  try{
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }catch(e){ return fallback; }
}
const CH = new Proxy({}, { get(_, k){
  switch(k){
    case 'hi':   return cssVar('--caramel', '#C97B4A');
    case 'lo':   return cssVar('--moss',    '#7FA07A');
    case 'band': return cssVar('--chart-band', 'rgba(224,164,88,.18)');
    case 'rain': return cssVar('--chart-rain', 'rgba(127,160,122,.55)');
    default:     return 'currentColor';
  }
}});

/**
 * 温度折线 + 降水柱
 * @param data [{date,hi,lo,pr}]
 */
function lineChart(data, {w=640,h=260,pad={t:16,r:44,b:34,l:38}}={}){
  const pts = data.filter(d=>d.hi!=null);
  if(pts.length<2) return `<div class="empty">${T('chartNoData')}</div>`;

  const his=pts.map(d=>d.hi), los=pts.map(d=>d.lo).filter(v=>v!=null);
  let vmin=Math.min(...(los.length?los:his)), vmax=Math.max(...his);
  const padV=Math.max((vmax-vmin)*0.12, 1.5); vmin-=padV; vmax+=padV;
  const prMax=Math.max(...pts.map(d=>d.pr||0), 1);

  const iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const X=i=>pad.l + (pts.length===1?iw/2:(i/(pts.length-1))*iw);
  const Y=v=>pad.t + ih - ((v-vmin)/(vmax-vmin))*ih;

  /* Y 轴刻度 */
  const ticks=[]; const step=niceStep((vmax-vmin)/4);
  for(let v=Math.ceil(vmin/step)*step; v<=vmax; v+=step) ticks.push(+v.toFixed(6));

  const path=(key)=>pts.map((d,i)=>(i?'L':'M')+X(i).toFixed(1)+' '+Y(d[key]).toFixed(1)).join(' ');
  const hasLo = los.length===pts.length;
  const areaPath = hasLo
    ? path('hi')+' '+pts.slice().reverse().map((d,i)=>'L'+X(pts.length-1-i).toFixed(1)+' '+Y(d.lo).toFixed(1)).join(' ')+' Z'
    : '';

  /* X 轴标签：最多 8 个 */
  const labStep=Math.max(1,Math.ceil(pts.length/8));
  const xlabs=pts.map((d,i)=>({i,d})).filter(o=>o.i%labStep===0||o.i===pts.length-1);

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="color:var(--tx3);overflow:visible">
    ${ticks.map(v=>`<g><line x1="${pad.l}" y1="${Y(v).toFixed(1)}" x2="${w-pad.r}" y2="${Y(v).toFixed(1)}"
        stroke="${CH.grid}" stroke-opacity=".16" stroke-width="1"/>
      <text x="${pad.l-7}" y="${(Y(v)+3.5).toFixed(1)}" font-size="10" fill="${CH.text}" fill-opacity=".7"
        text-anchor="end">${v}°</text></g>`).join('')}
    ${pts.map((d,i)=>{ const bh=((d.pr||0)/prMax)*(ih*0.28); if(bh<0.6) return '';
      const bw=Math.max(1.5, Math.min(9, iw/pts.length*0.55));
      return `<rect x="${(X(i)-bw/2).toFixed(1)}" y="${(pad.t+ih-bh).toFixed(1)}" width="${bw.toFixed(1)}"
        height="${bh.toFixed(1)}" fill="${CH.rain}" rx="1"><title>${T('chartRainTip',{t:d.date, v:d.pr})}</title></rect>`;}).join('')}
    ${hasLo?`<path d="${areaPath}" fill="${CH.band}"/>`:''}
    ${hasLo?`<path d="${path('lo')}" fill="none" stroke="${CH.lo}" stroke-width="1.8" stroke-linejoin="round"/>`:''}
    <path d="${path('hi')}" fill="none" stroke="${CH.hi}" stroke-width="2.1" stroke-linejoin="round"/>
    ${pts.map((d,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(d.hi).toFixed(1)}" r="${pts.length>60?0:2.2}"
       fill="${CH.hi}"><title>${d.date}　${T('chartTipHigh')} ${d.hi}°${d.lo!=null?`　${T('chartTipLow')} ${d.lo}°`:''}${d.pr?`　${T('chartTipRain')} ${d.pr}mm`:''}</title></circle>`).join('')}
    ${xlabs.map(o=>`<text x="${X(o.i).toFixed(1)}" y="${h-pad.b+16}" font-size="10" fill="${CH.text}"
       fill-opacity=".7" text-anchor="middle">${o.d.date.slice(5)}</text>`).join('')}
    <g font-size="10" fill="${CH.text}" fill-opacity=".8">
      <rect x="${w-pad.r+6}" y="${pad.t}" width="9" height="2.5" fill="${CH.hi}" rx="1"/>
      <text x="${w-pad.r+18}" y="${pad.t+4}">${T('chartHigh')}</text>
      ${hasLo?`<rect x="${w-pad.r+6}" y="${pad.t+16}" width="9" height="2.5" fill="${CH.lo}" rx="1"/>
      <text x="${w-pad.r+18}" y="${pad.t+20}">${T('chartLow')}</text>`:''}
      <rect x="${w-pad.r+6}" y="${pad.t+30}" width="9" height="7" fill="${CH.rain}" rx="1"/>
      <text x="${w-pad.r+18}" y="${pad.t+37}">${T('chartRain')}</text>
    </g>
  </svg>`;
}
function niceStep(raw){
  const p=Math.pow(10,Math.floor(Math.log10(raw)));
  const n=raw/p;
  return (n<=1?1:n<=2?2:n<=5?5:10)*p;
}

/** 逐年同期柱状对比 */
function yearBars(perYear,{w=640,h=180}={}){
  const pts=perYear.filter(p=>p.hi!=null); if(!pts.length) return '';
  const pad={t:14,r:12,b:26,l:34};
  const iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  const vals=pts.map(p=>p.hi);
  let vmin=Math.min(...vals), vmax=Math.max(...vals);
  const sp=Math.max((vmax-vmin)*.15,1); vmin-=sp; vmax+=sp;
  const bw=Math.min(26, iw/pts.length*0.66);
  const X=i=>pad.l+(i+0.5)*(iw/pts.length);
  const Y=v=>pad.t+ih-((v-vmin)/(vmax-vmin))*ih;
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="color:var(--tx3);overflow:visible">
    <line x1="${pad.l}" y1="${Y(avg).toFixed(1)}" x2="${w-pad.r}" y2="${Y(avg).toFixed(1)}"
      stroke="${CH.hi}" stroke-opacity=".5" stroke-dasharray="4 3" stroke-width="1.2"/>
    <text x="${w-pad.r}" y="${(Y(avg)-5).toFixed(1)}" font-size="9.5" fill="${CH.hi}" text-anchor="end">${T('chartMean',{v:avg.toFixed(1)})}</text>
    ${pts.map((p,i)=>{const y=Y(p.hi);
      return `<g><rect x="${(X(i)-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}"
        height="${(pad.t+ih-y).toFixed(1)}" rx="2" fill="${p.hi>=avg?CH.hi:CH.lo}" fill-opacity=".78">
        <title>${T('chartYearTip',{y:p.year, hi:p.hi})}${p.lo!=null?T('chartYearLow',{lo:p.lo}):''}</title></rect>
        <text x="${X(i).toFixed(1)}" y="${(y-4).toFixed(1)}" font-size="9" fill="currentColor" fill-opacity=".85"
          text-anchor="middle">${p.hi.toFixed(0)}</text>
        <text x="${X(i).toFixed(1)}" y="${h-pad.b+15}" font-size="9.5" fill="currentColor" fill-opacity=".65"
          text-anchor="middle">${String(p.year).slice(2)}</text></g>`;}).join('')}
  </svg>`;
}

/**
 * 日内曲线：温度折线 + 降水柱 + 当前时刻竖线
 * @param t     时间数组（ISO，本地时区）
 * @param temp  温度数组
 * @param prec  降水数组（mm）
 * @param nowIdx 当前时刻在数组中的位置，用于画"现在"标记
 * @param hours 只画未来多少小时
 * @param stepMin 采样间隔（分钟），用于判断一格代表多久
 */
function intradayChart(t, temp, prec, nowIdx, hours=24, stepMin=15, {w=640,h=170}={}){
  const per = Math.max(1, Math.round(60/stepMin));
  const n = Math.min(t.length, nowIdx + hours*per);
  const idx = []; for(let i=Math.max(0,nowIdx); i<n; i++) idx.push(i);
  const vals = idx.map(i=>temp[i]).filter(v=>v!=null&&isFinite(v));
  if(vals.length<2) return `<div class="empty">${T('chartIntraNoData')}</div>`;

  const pad={t:16,r:40,b:24,l:34};          /* 右侧留出降水量轴 */
  const iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
  let vmin=Math.min(...vals), vmax=Math.max(...vals);
  const sp=Math.max((vmax-vmin)*0.15,1); vmin-=sp; vmax+=sp;
  /* 降水轴：取一个整齐的量程上限，柱子最高占绘图区 42% */
  const prPeak=Math.max(...idx.map(i=>(prec&&prec[i])||0), 0);
  const prMax=prPeak<=0 ? 1 : niceStep(prPeak/2)*2 || 1;
  const BAR_FRAC=0.42;
  const X=k=>pad.l+(k/(idx.length-1))*iw;
  const Y=v=>pad.t+ih-((v-vmin)/(vmax-vmin))*ih;
  const YP=mm=>pad.t+ih-(Math.min(mm,prMax)/prMax)*(ih*BAR_FRAC);   /* 降水值 → y 坐标 */

  const step=Math.max(1,(vmax-vmin)/4);
  const ticks=[]; const ns=niceStep(step);
  for(let v=Math.ceil(vmin/ns)*ns; v<=vmax; v+=ns) ticks.push(+v.toFixed(6));

  const path=idx.map((i,k)=>(k?'L':'M')+X(k).toFixed(1)+' '+Y(temp[i]).toFixed(1)).join(' ');
  const area=path+` L${X(idx.length-1).toFixed(1)} ${(pad.t+ih).toFixed(1)} L${X(0).toFixed(1)} ${(pad.t+ih).toFixed(1)} Z`;

  /* 每 3 小时一个刻度 */
  const labStep=per*3;
  const labs=idx.map((i,k)=>({i,k})).filter(o=>{
    const hh=+t[o.i].slice(11,13), mm=+t[o.i].slice(14,16);
    return mm===0 && hh%3===0;
  });
  const bw=Math.max(1.2, Math.min(7, iw/idx.length*0.6));
  /* 降水轴刻度：0 不画（就是基线），画 2~3 个 */
  const prStep=niceStep(prMax/2);
  const prTicks=[]; for(let v=prStep; v<=prMax+1e-9; v+=prStep) prTicks.push(+v.toFixed(2));

  return `<svg viewBox="0 0 ${w} ${h}" width="100%" style="color:var(--tx3);overflow:visible">
    ${ticks.map(v=>`<line x1="${pad.l}" y1="${Y(v).toFixed(1)}" x2="${w-pad.r}" y2="${Y(v).toFixed(1)}"
      stroke="currentColor" stroke-opacity=".14"/>
      <text x="${pad.l-6}" y="${(Y(v)+3.5).toFixed(1)}" font-size="9.5" fill="currentColor"
        fill-opacity=".7" text-anchor="end">${v}°</text>`).join('')}
    ${prPeak>0 ? prTicks.map(mm=>`<line x1="${pad.l}" y1="${YP(mm).toFixed(1)}" x2="${w-pad.r}" y2="${YP(mm).toFixed(1)}"
        stroke="${CH.rain}" stroke-opacity=".22" stroke-dasharray="2 3"/>
      <text x="${w-pad.r+6}" y="${(YP(mm)+3.5).toFixed(1)}" font-size="9" fill="${CH.rain}"
        text-anchor="start">${mm}</text>`).join('') : ''}
    ${prPeak>0 ? `<text x="${w-pad.r+6}" y="${(pad.t-4).toFixed(1)}" font-size="9" fill="${CH.rain}">mm</text>` : ''}
    ${idx.map((i,k)=>{ const p=(prec&&prec[i])||0; if(p<=0.02) return '';
      const y=YP(p), bh=pad.t+ih-y;
      return `<rect x="${(X(k)-bw/2).toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}"
        height="${bh.toFixed(1)}" fill="${CH.rain}" rx="1"><title>${T('chartRainTip',{t:t[i].slice(11,16), v:p})}</title></rect>`;}).join('')}
    <defs><linearGradient id="igr" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${CH.hi}" stop-opacity=".28"/>
      <stop offset="100%" stop-color="${CH.hi}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#igr)"/>
    <path d="${path}" fill="none" stroke="${CH.hi}" stroke-width="2" stroke-linejoin="round"/>
    <line x1="${pad.l}" y1="${pad.t}" x2="${pad.l}" y2="${pad.t+ih}" stroke="var(--acc)" stroke-width="1.5" stroke-dasharray="3 2"/>
    <text x="${pad.l+3}" y="${pad.t-5}" font-size="9" fill="var(--acc)">${T('chartNow')}</text>
    ${labs.map(o=>`<text x="${X(o.k).toFixed(1)}" y="${h-pad.b+15}" font-size="9.5" fill="currentColor"
      fill-opacity=".7" text-anchor="middle">${t[o.i].slice(11,16)}</text>`).join('')}
    ${idx.map((i,k)=>`<rect x="${(X(k)-iw/idx.length/2).toFixed(1)}" y="${pad.t}" width="${(iw/idx.length).toFixed(1)}"
      height="${ih}" fill="transparent"><title>${t[i].slice(11,16)}　${temp[i]}°${(prec&&prec[i])?`　${T('chartTipRain')} ${prec[i]}mm`:''}</title></rect>`).join('')}
  </svg>`;
}
