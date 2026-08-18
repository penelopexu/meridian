/* ===== 应用层 ===== */
const $ = s => document.querySelector(s);
const WD  = () => T('weekdays');
const WDL = () => T('weekdaysLong');
const DEFAULT_PLACE = {id:1816670,name:'北京',country:'中国',cc:'CN',admin1:'北京市',
                       lat:39.9075,lon:116.3972,tz:'Asia/Shanghai'};
const LS='tianshi.v3';

let S = { favs:[], primary:null, cur:null, view:'month', cursor:new Date(), sel:null,
          wx:null, wxErr:null, air:null, theme:'dark', lang:'zh-CN', _token:0,
          convMode:'s2l', histMode:'one', hist:null, histErr:null, histBusy:false, bias:'normal', past:null, warns:[], warnsOfficial:[], calendar:'auto', holRegion:'auto' };
let memStore=null;

function save(){
  const o={favs:S.favs,primary:S.primary,theme:S.theme,view:S.view,lang:S.lang,bias:S.bias,calendar:S.calendar,holRegion:S.holRegion};
  try{ localStorage.setItem(LS,JSON.stringify(o)); }catch(e){ memStore=o; }
}
function load(){
  let o=null;
  try{ o=JSON.parse(localStorage.getItem(LS)||'null'); }catch(e){ o=memStore; }
  if(o){ S.favs=o.favs||[]; S.primary=o.primary||null; S.theme=o.theme||'dark';
         S.view=o.view||'month'; S.lang=o.lang||'zh-CN'; S.bias=o.bias||'normal'; S.calendar=o.calendar||'auto'; S.holRegion=o.holRegion||'auto'; }
  if(!S.favs.length){ S.favs=[DEFAULT_PLACE]; S.primary=DEFAULT_PLACE.id; }
  if(!S.favs.some(f=>f.id===S.primary)) S.primary=S.favs[0].id;
  setLang(S.lang);
}
function toast(t){ const el=$('#toast'); el.textContent=t; el.classList.add('on');
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('on'),1900); }

/* ---- 时区 ---- */
function tzParts(date,tz){
  const f=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',
          hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  const p={}; f.formatToParts(date).forEach(x=>{ if(x.type!=='literal') p[x.type]=x.value; });
  let H=parseInt(p.hour,10); if(H===24) H=0;
  return {y:+p.year,m:+p.month,d:+p.day,H,M:+p.minute,S:+p.second,
          wd:new Date(Date.UTC(+p.year,+p.month-1,+p.day)).getUTCDay()};
}
function tzOffsetMin(date,tz){ const p=tzParts(date,tz);
  return Math.round((Date.UTC(p.y,p.m-1,p.d,p.H,p.M,p.S)-date.getTime()+date.getMilliseconds())/60000); }
function offLabel(m){ const s=m<0?'-':'+',a=Math.abs(m); return `UTC${s}${pad(Math.floor(a/60))}:${pad(a%60)}`; }
function localTZ(){ try{ return Intl.DateTimeFormat().resolvedOptions().timeZone; }catch(e){ return 'UTC'; } }
function isoWeek(y,m,d){ const dt=new Date(Date.UTC(y,m-1,d)); const dn=(dt.getUTCDay()+6)%7;
  dt.setUTCDate(dt.getUTCDate()-dn+3); const f=new Date(Date.UTC(dt.getUTCFullYear(),0,4));
  return 1+Math.round(((dt-f)/864e5-3+((f.getUTCDay()+6)%7))/7); }
function windDir(d){ return T('windDirs')[Math.round(d/22.5)%16]; }

/* ---- 天气代码与图标 ---- */
/* WMO 代码 → 图标键。天气现象的文字说明在语言包 STRINGS.*.wmo 里 */
const WMO={0:'sun',1:'sun-c',2:'cloud-sun',3:'cloud',45:'fog',48:'fog',
 51:'drizzle',53:'drizzle',55:'drizzle',56:'sleet',57:'sleet',
 61:'rain',63:'rain',65:'rain-h',66:'sleet',67:'sleet',
 71:'snow',73:'snow',75:'snow-h',77:'snow',80:'showers',81:'showers',82:'rain-h',
 85:'snow',86:'snow-h',95:'thunder',96:'thunder',99:'thunder'};
function wxText(c){ const m=T('wmo')||{}; return m[c]!==undefined ? m[c] : '—'; }
function wxIcon(code,day=1,size=34){
  const t=WMO[code]||'cloud';
  const S_=size, sun='#E8B87F', moon='#EDDCBF', cl='#C0AE95', cl2='#96826A', rn='#8A9E82', sw='#FBF3E8', th='#D4A574';
  const C=(x,y,r,f)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"/>`;
  const cloud=(dx,dy,sc,f)=>`<g transform="translate(${dx},${dy}) scale(${sc})"><path d="M7 18a5 5 0 0 1 .6-9.96A7 7 0 0 1 21 8.5a4.5 4.5 0 0 1-.5 9.5z" fill="${f}"/></g>`;
  const rays=`<g stroke="${sun}" stroke-width="1.8" stroke-linecap="round">
    <line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/>
    <line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/>
    <line x1="4.6" y1="4.6" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"/>
    <line x1="19.4" y1="4.6" x2="17.6" y2="6.4"/><line x1="6.4" y1="17.6" x2="4.6" y2="19.4"/></g>`;
  let inner='';
  const clear = day ? C(12,12,5,sun)+rays
    : `<path d="M18.5 14.6A7.2 7.2 0 0 1 9.4 5.5 7.5 7.5 0 1 0 18.5 14.6z" fill="${moon}"/>`;
  switch(t){
    case 'sun': inner=clear; break;
    case 'sun-c': inner=clear+cloud(7,8,.62,cl); break;
    case 'cloud-sun': inner=(day?C(9,8,3.6,sun):`<path d="M13 9.6A5 5 0 0 1 6.7 3.3 5.2 5.2 0 1 0 13 9.6z" fill="${moon}"/>`)+cloud(4,8,.72,cl); break;
    case 'cloud': inner=cloud(1,3,.85,cl)+cloud(6,7,.55,cl2); break;
    case 'fog': inner=cloud(1,1,.8,cl)+`<g stroke="${cl2}" stroke-width="1.7" stroke-linecap="round"><line x1="3" y1="17" x2="19" y2="17"/><line x1="5" y1="20" x2="21" y2="20"/></g>`; break;
    case 'drizzle': inner=cloud(1,0,.8,cl)+`<g stroke="${rn}" stroke-width="1.6" stroke-linecap="round" opacity=".85"><line x1="8" y1="17" x2="7" y2="20"/><line x1="12" y1="17" x2="11" y2="20"/><line x1="16" y1="17" x2="15" y2="20"/></g>`; break;
    case 'rain': inner=cloud(1,0,.8,cl)+`<g stroke="${rn}" stroke-width="1.9" stroke-linecap="round"><line x1="8" y1="16.5" x2="6.6" y2="21"/><line x1="12.5" y1="16.5" x2="11.1" y2="21"/><line x1="17" y1="16.5" x2="15.6" y2="21"/></g>`; break;
    case 'rain-h': inner=cloud(1,-1,.82,cl2)+`<g stroke="${rn}" stroke-width="2.1" stroke-linecap="round"><line x1="7" y1="15.5" x2="5.2" y2="21.5"/><line x1="11.5" y1="15.5" x2="9.7" y2="21.5"/><line x1="16" y1="15.5" x2="14.2" y2="21.5"/><line x1="20" y1="15.5" x2="18.2" y2="21.5"/></g>`; break;
    case 'showers': inner=(day?C(8,6,3,sun):'')+cloud(3,4,.72,cl)+`<g stroke="${rn}" stroke-width="1.9" stroke-linecap="round"><line x1="10" y1="18" x2="8.8" y2="21.5"/><line x1="14.5" y1="18" x2="13.3" y2="21.5"/><line x1="19" y1="18" x2="17.8" y2="21.5"/></g>`; break;
    case 'snow': inner=cloud(1,0,.8,cl)+`<g fill="${sw}">${C(8,18.5,1.5,sw)}${C(12.5,20,1.5,sw)}${C(17,18.5,1.5,sw)}</g>`; break;
    case 'snow-h': inner=cloud(1,-1,.82,cl2)+`<g fill="${sw}">${C(6.5,17,1.5,sw)}${C(11,19,1.5,sw)}${C(15.5,17,1.5,sw)}${C(19,20.5,1.5,sw)}${C(9,21.5,1.4,sw)}</g>`; break;
    case 'sleet': inner=cloud(1,0,.8,cl)+`<g stroke="${rn}" stroke-width="1.8" stroke-linecap="round"><line x1="8" y1="17" x2="6.8" y2="20.5"/><line x1="16" y1="17" x2="14.8" y2="20.5"/></g>${C(12.5,19.5,1.5,sw)}`; break;
    case 'thunder': inner=cloud(1,-1,.82,cl2)+`<path d="M13.6 14.5l-4.4 6.2h3l-1.4 4.6 4.8-6.6h-3.1z" fill="${th}"/><g stroke="${rn}" stroke-width="1.7" stroke-linecap="round" opacity=".8"><line x1="7" y1="15.5" x2="5.6" y2="19.5"/><line x1="18.5" y1="15.5" x2="17.1" y2="19.5"/></g>`; break;
    default: inner=cloud(1,3,.85,cl);
  }
  return `<svg width="${S_}" height="${S_}" viewBox="0 0 26 26" style="vertical-align:middle">${inner}</svg>`;
}

/* ===================== 渲染：实时面板 ===================== */
function renderNow(){
  const p=S.cur, now=new Date(), t=tzParts(now,p.tz);
  const info=dayInfo(t.y,t.m,t.d,holidayRegion()), L=info.lunar;
  const off=tzOffsetMin(now,p.tz), loff=tzOffsetMin(now,localTZ()), dh=(off-loff)/60;
  const c=S.wx&&S.wx.current, d0=S.wx&&S.wx.daily;
  const air=S.air&&S.air.current;
  const elev = (S.wx&&S.wx.elevation!=null)?S.wx.elevation:p.elev;
  const tags=[];
  if(info.off==='rest') tags.push(`<span class="chip rest">${T('rest')} · ${info.offName}</span>`);
  if(info.off==='work') tags.push(`<span class="chip work">${T('makeupWork')}</span>`);
  info.terms.forEach(x=>tags.push(`<span class="chip trm">${x}</span>`));
  info.festivals.forEach(x=>tags.push(`<span class="chip fes">${x}</span>`));
  info.intl.forEach(x=>tags.push(`<span class="chip intl">${x}</span>`));

  const meta=[];
  if(c){
    meta.push(['humidity',c.relative_humidity_2m+'%']);
    meta.push(['wind',Math.round(c.wind_speed_10m)+' <span style="font-size:10px">km/h</span>']);
    meta.push(['windDir',windDir(c.wind_direction_10m)]);
    meta.push(['pressure',Math.round(c.pressure_msl)+' <span style="font-size:10px">hPa</span>']);
    if(elev!=null) meta.push(['elevation',Math.round(elev)+' <span style="font-size:10px">m</span>']);
    const uvNow = air&&air.uv_index!=null ? air.uv_index : (d0?d0.uv_index_max[0]:null);
    if(uvNow!=null){ const lv=uvLevel(uvAtElevation(uvNow,elev));
      meta.push(['uv',`${uvNow.toFixed(1)} <span style="font-size:10px;color:var(--tx3)">${lv.label}</span>`]); }
    if(air&&air.us_aqi!=null){ const lv=aqiLevel(air.us_aqi);
      meta.push(['aqi',`${Math.round(air.us_aqi)} <span style="font-size:10px;color:var(--tx3)">${lv.label}</span>`]); }
    if(air&&air.pm2_5!=null) meta.push(['pm25',Math.round(air.pm2_5)+' <span style="font-size:10px">μg/m³</span>']);
    if(d0){ meta.push(['sunrise',d0.sunrise[0].slice(11)]); meta.push(['sunset',d0.sunset[0].slice(11)]); }
  }

  $('#nowPanel').innerHTML=`
    <h3 class="nowtitle">${T('nowTitle')}</h3>
    <div class="place">📍 ${esc(placeFull(p,S.lang))}
      ${p.id===S.primary?`<span class="pin">${T('primary')}</span>`:''}
      <span style="color:var(--tx3)">${esc(p.tz)} ${offLabel(off)}</span>
      ${elev!=null?`<span style="color:var(--tx3)">· ${T('elevation')} ${Math.round(elev)} m</span>`:''}
      ${p.nearNote?`<span style="color:var(--tx3)">· ${esc(p.nearNote)}</span>`:''}</div>
    <div class="clock" id="clk"></div>
    <div class="dline">${T('dateLong',{y:t.y,m:t.m,d:t.d,mn:MN(t.m)})} · ${WDL()[t.wd]}</div>
    ${altLineHTML(t.y,t.m,t.d,L)}
    <div class="chips" style="justify-content:flex-start;margin-top:11px">${tags.join('')||`<span class="chip" style="color:var(--tx3)">${T('ordinaryDay')}</span>`}</div>
    ${warnHTML()}
    <div class="sysrow">
      <span>${T('localTime')} <b id="sysclk"></b> (${localTZ()})</span>
      <span>${T('tzDiff')} <b>${dh===0?T('sameTz'):T('hoursUnit',{n:(dh>0?'+':'')+dh})}</b></span>
      <span>${T('dayOfYear')} <b>${Math.floor((Date.UTC(t.y,t.m-1,t.d)-Date.UTC(t.y,0,1))/864e5)+1}</b> ${T('days')} · ${T('weekNo')} <b>${isoWeek(t.y,t.m,t.d)}</b> ${T('weeks')}</span>
    </div>
    <h4 class="wnowtitle">${T('nowWeather')}</h4>
    ${c?`<div class="wnow">
      <div style="text-align:center">${wxIcon(c.weather_code,c.is_day,64)}</div>
      <div><div class="wtemp">${Math.round(c.temperature_2m)}°</div>
        <div class="wdesc" style="margin-top:6px">${wxText(c.weather_code)}</div>
        <div class="wfeel" title="${T('feelsLikeTitle')}">${T('feelsLike')} ${(()=>{const f=feelsLike({t:c.temperature_2m,rh:c.relative_humidity_2m,wind:c.wind_speed_10m,isDay:c.is_day,precip:c.precipitation,cloud:c.cloud_cover});return f==null?'—':Math.round(f)+'°';})()}</div></div>
      <div class="wmeta">${meta.map(([k,v])=>`<div class="wm"><div class="k">${metricLabel(k,T(k))}</div><div class="v">${v}</div></div>`).join('')}</div></div>`
    : S.wxErr?`<div class="wnow" style="display:block"><div style="font-size:12.5px;color:#E8A183">${T('weatherFailed')}：${S.wxErr}</div>
       <button onclick="retryWx()" style="margin-top:9px;padding:6px 16px;border-radius:9px;background:var(--acc);color:var(--night);font-size:12px;font-weight:700">${T('retry')}</button></div>`
    :`<div class="wnow"><span class="ld"></span> <span style="color:var(--tx3);font-size:12px">${T('gettingWeather')}</span></div>`}`;
  tickClock();
}
function tickClock(){
  const el=$('#clk'); if(!el) return;
  const now=new Date(), t=tzParts(now,S.cur.tz), s=tzParts(now,localTZ());
  el.innerHTML=`${pad(t.H)}:${pad(t.M)}<span class="s">:${pad(t.S)}</span><span class="ap">${T('dayParts')[t.H<6?0:t.H<12?1:t.H<13?2:t.H<18?3:4]}</span>`;
  const sc=$('#sysclk'); if(sc) sc.textContent=`${pad(s.H)}:${pad(s.M)}:${pad(s.S)}`;
}

/* 预警条：官方源优先，本地推算的加「推算」标记。
   去重按 type 字段做（见 65-warning.js 的 mergeWithDerived）——
   早先是拿标题前两个字互相匹配，那办法在多语言下会乱套：
   英文的 "Heat Warning" 和中文的「高温预警」前两个字对不上，会重复显示。 */
function warnHTML(){
  const all = mergeWithDerived(S.warnsOfficial || [], S.warns || []);
  if(!all.length) return '';
  return `<div class="warns">${all.map(w=>{
    const L = WARN_LEVELS[w.level] || WARN_LEVELS.yellow;
    return `<div class="warn" style="--wc:${L.color};--wbg:${L.bg}" title="${esc(w.desc||'')}">
      <span class="wico">${warnIcon(w.type)}</span>
      <span class="wtxt"><b>${esc(w.title)}</b>${w.desc?`<small>${esc(w.desc)}</small>`:''}</span>
      <span class="wtag">${w.derived?T('warnDerived'):(w.sender?esc(w.sender):T('warnOfficial'))}</span>
    </div>`;}).join('')}</div>`;
}
function warnIcon(type){
  const t=String(type||'');
  /* typhoon 要排在 wind 前面：台风也是大风，但该显示旋风图标 */
  if(/typhoon|台风|颱風|hurricane|飓风|tropical/i.test(t)) return '🌀';
  if(/heat|高温|酷熱/.test(t)) return '🌡';
  if(/rain|暴雨|大雨|降雨/.test(t)) return '🌧';
  if(/wind|大风|季候風/.test(t)) return '💨';
  if(/tsunami|海嘯|海啸/.test(t)) return '🌊';
  if(/fire|火災|火灾/.test(t)) return '🔥';
  if(/frost|霜/.test(t)) return '🧊';
  if(/cold|寒潮|低温|霜冻/.test(t)) return '❄';
  if(/snow|雪|冰/.test(t)) return '🌨';
  if(/thunder|雷/.test(t)) return '⚡';
  if(/fog|雾|霾/.test(t)) return '🌫';
  return '⚠';
}

/* ===================== 渲染：穿衣建议 ===================== */
function renderAdvice(){
  const b=$('#adviceBody'); if(!b) return;
  const w=S.wx, c=w&&w.current, d=w&&w.daily;
  if(!c||!d){ b.innerHTML=`<div class="empty">${S.wxErr?T('weatherFailed'):T('awaitWeather')}</div>`; return; }
  const air=S.air&&S.air.current;
  const elev=w.elevation;
  const adv=buildAdvice({
    tNow:c.temperature_2m, atNow:c.apparent_temperature,
    tMax:d.temperature_2m_max[0], tMin:d.temperature_2m_min[0],
    atMax:d.apparent_temperature_max?d.apparent_temperature_max[0]:null,
    atMin:d.apparent_temperature_min?d.apparent_temperature_min[0]:null,
    wind:c.wind_speed_10m, gust:c.wind_gusts_10m, rh:c.relative_humidity_2m,
    isDay:c.is_day, cloud:c.cloud_cover, bias:S.bias,
    uv:(air&&air.uv_index!=null)?Math.max(air.uv_index,d.uv_index_max[0]):d.uv_index_max[0],
    pop:d.precipitation_probability_max[0], precip:d.precipitation_sum[0],
    code:d.weather_code[0], elev, aqi:air?air.us_aqi:null, pm25:air?air.pm2_5:null
  });
  b.innerHTML=`
    <div class="advhead">
      <div class="advat"><span class="n">${adv.at==null?'—':Math.round(adv.at)+'°'}</span><small>${T('feelsLike')}</small></div>
      <div class="advband">${adv.band}</div>
      ${adv.swing!=null?`<div class="advswing">${T('dailySwing',{n:Math.round(adv.swing)})}</div>`:''}
      <div class="biasbox" title="${T('biasBoxTitle')}">
        <span class="bl">${T('constitution')}</span>
        ${[['cold','biasCold','−2.5°'],['normal','biasNormal',''],['hot','biasHot','+2.5°']].map(([k,nk,d])=>
          `<button class="bb ${S.bias===k?'on':''}" data-bias="${k}" title="${d?T('biasTitleAdj',{d}):T('biasTitleNone')}">${T(nk)}</button>`).join('')}
      </div>
    </div>
    <div class="advrow"><span class="lb">${T('layers')}</span><span class="vl">${adv.layers.join('；')}</span></div>
    ${adv.accessories.length?`<div class="advrow"><span class="lb">${T('accessories')}</span>
      <span class="vl">${adv.accessories.map(a=>`<span class="acc">${a}</span>`).join('')}</span></div>`:''}
    ${adv.notes.length?`<div class="advrow"><span class="lb">${T('notes')}</span>
      <span class="vl"><ul class="advnotes">${adv.notes.map(n=>`<li>${n}</li>`).join('')}</ul></span></div>`:''}
    <div class="hint">${T('adviceHint')}</div>`;
  $('#adviceBody').querySelectorAll('[data-bias]').forEach(el=>el.onclick=()=>{
    S.bias=el.dataset.bias; save(); renderAdvice(); });
}

/* ===================== 渲染：预报 ===================== */
function renderWx(){
  const b=$('#wxBody'), p=S.cur;
  $('#wxPlace').textContent=placeName(p,S.lang);   /* textContent 天然安全 */
  if(S.wxErr){ b.innerHTML=`<div class="wxerr">${T('weatherFailedTitle')}<div class="m">${S.wxErr}</div>
    <button onclick="retryWx()">${T('retryOnce')}</button>
    <div style="margin-top:12px;color:var(--tx3);font-size:11.5px">${T('offlineStillWorks')}</div></div>`; return; }
  if(!S.wx||!S.wx.daily){ b.innerHTML=`<div class="empty"><span class="ld"></span> ${T('loadingWeather')}</div>`; return; }
  const d=S.wx.daily,n=d.time.length;
  const past=(S.past||[]).filter(x=>!d.time.includes(x.date));
  const _lows=nums(d.temperature_2m_min.concat(past.map(x=>x.lo)));
  const _his =nums(d.temperature_2m_max.concat(past.map(x=>x.hi)));
  if(!_his.length){ b.innerHTML=`<div class="empty">${T('noHistData')}</div>`; return; }
  const lo=Math.min(...(_lows.length?_lows:_his)), hi=Math.max(..._his), span=Math.max(hi-lo,1);
  let html='';
  if(n>1){ const i=1, dt=new Date(d.time[i]+'T00:00:00Z');
    const li=solarToLunar(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate());
    html+=`<div class="tmr"><div style="flex-shrink:0">${wxIcon(d.weather_code[i],1,52)}</div>
      <div><div class="lab">${T('tomorrow')}</div>
      <div class="d">${wxText(d.weather_code[i])}　${d.time[i].slice(5)} ${WDL()[dt.getUTCDay()]}</div>
      <div class="t">${T('lunarPrefix')}${T('lunarSep')}${li.monthCN}${li.dayCN} · ${T('precipProb')} ${d.precipitation_probability_max[i]??0}% · ${T('uv')} ${Math.round(d.uv_index_max[i]??0)}</div></div>
      <div class="tt">${Math.round(d.temperature_2m_max[i])}°<small> / ${Math.round(d.temperature_2m_min[i])}°</small></div></div>`; }
  html+='<div class="fc">';
  /* 过去三天的实况，拼在预报前面 */
  for(const x of past){
    const dt=new Date(x.date+'T00:00:00Z');
    const y=dt.getUTCFullYear(),m=dt.getUTCMonth()+1,dd=dt.getUTCDate();
    const inf=dayInfo(y,m,dd,holidayRegion());
    const fes=inf.festivals[0]||inf.terms[0]||inf.intl[0]||'';
    const l=Math.round(x.lo), hh=Math.round(x.hi);
    const left=((x.lo-lo)/span)*100, wdt=Math.max(((x.hi-x.lo)/span)*100,6);
    const days=Math.round((Date.now()-Date.parse(x.date+'T12:00:00Z'))/864e5);
    html+=`<div class="fcr past">
      <div class="day">${days===1?T('yesterday'):T('daysAgo',{n:days})}<small>${m}/${dd} ${T('weekShort')}${WD()[dt.getUTCDay()]}${inf.off==='rest'?' · '+T('rest'):inf.off==='work'?' · '+T('work'):''}</small></div>
      <div>${wxIcon(x.code,1,28)}</div>
      <div class="cond">${wxText(x.code)}${x.pr>=0.5?`<em>💧${x.pr.toFixed(1)}mm</em>`:''}${fes?`<em style="color:var(--warm)">${fes}</em>`:''}</div>
      <div class="bar"><span class="lo">${l}°</span>
        <span class="track"><span class="fill" style="left:${left}%;width:${wdt}%"></span></span>
        <span class="hi">${hh}°</span></div></div>`;
  }
  if(past.length) html+='<div class="fcdiv"><span>'+T('pastActual')+'</span></div>';
  for(let i=0;i<n;i++){
    const dt=new Date(d.time[i]+'T00:00:00Z');
    const y=dt.getUTCFullYear(),m=dt.getUTCMonth()+1,dd=dt.getUTCDate();
    const inf=dayInfo(y,m,dd,holidayRegion());
    const nm=i===0?T('today'):i===1?T('tomorrow'):i===2?T('dayAfter'):`${m}/${dd}`;
    const fes=inf.festivals[0]||inf.terms[0]||inf.intl[0]||'';
    const vLo=d.temperature_2m_min[i], vHi=d.temperature_2m_max[i];
    const ok=vLo!=null&&vHi!=null&&isFinite(vLo)&&isFinite(vHi);
    const l=ok?Math.round(vLo):'—', h=ok?Math.round(vHi):'—';
    const left=ok?((vLo-lo)/span)*100:0, w=ok?Math.max(((vHi-vLo)/span)*100,6):0;
    const pop=d.precipitation_probability_max[i];
    html+=`<div class="fcr">
      <div class="day">${nm}<small>${WDL()[dt.getUTCDay()]}${inf.off==='rest'?' · '+T('rest'):inf.off==='work'?' · '+T('work'):''}</small></div>
      <div>${wxIcon(d.weather_code[i],1,28)}</div>
      <div class="cond">${wxText(d.weather_code[i])}${pop>=20?`<em>💧${pop}%</em>`:''}${fes?`<em style="color:var(--warm)">${fes}</em>`:''}</div>
      <div class="bar"><span class="lo">${ok?l+'°':'—'}</span>
        <span class="track">${ok?`<span class="fill" style="left:${left}%;width:${w}%"></span>`:''}</span>
        <span class="hi">${ok?h+'°':'—'}</span></div></div>`;
  }
  b.innerHTML=html+'</div>';
}

/* ===================== 渲染：日内逐时曲线 ===================== */
function renderIntraday(){
  const box=$('#intraBody'), note=$('#intraNote'), sec=$('#intraSec');
  if(!box) return;
  const m=S.wx&&S.wx.minutely_15;
  if(!m||!m.time||!m.time.length){ if(sec) sec.style.display='none'; return; }
  if(sec) sec.style.display='';
  const stepMin = S.wx._intradayStep || 15;
  /* 找到「现在」在序列中的位置 */
  const t=tzParts(new Date(),S.cur.tz);
  const nowStr=`${t.y}-${pad(t.m)}-${pad(t.d)}T${pad(t.H)}:${pad(Math.floor(t.M/stepMin)*stepMin)}`;
  let i=m.time.findIndex(x=>x>=nowStr);
  if(i<0) i=0;
  note.textContent = stepMin===15 ? T('intra15') : T('intra60');
  box.innerHTML = intradayChart(m.time, m.temperature_2m, m.precipitation, i, 24, stepMin);
}

/* ===================== 渲染：数据源设置 ===================== */
function renderSource(){
  const b=$('#srcBody'); if(!b) return;
  const usingQW = S.wx && S.wx._source==='qweather';
  const g = S.wx && S.wx._grid;
  b.innerHTML=`
    <div class="srcrow">
      <div class="srcopt ${!QW.enabled?'on':''}" data-src="om">
        <b>Open-Meteo</b><small>${T('srcOMDesc')}</small></div>
      <div class="srcopt ${QW.enabled?'on':''}" data-src="qw">
        <b>${T('srcQWName')}</b><small>${T('srcQWDesc')}</small></div>
    </div>
    <div class="qwbox" style="${QW.enabled?'':'display:none'}">
      <label>API Host<input id="qwHost" placeholder="${T('qwHostPh')}" value="${esc(QW.host)}"></label>
      <label>API Key<input id="qwKey" type="password" placeholder="${T('qwKeyPh')}" value="${esc(QW.key)}"></label>
      <div class="qwbtns">
        <button class="gobtn" onclick="qwSaveUI()">${T('qwSaveBtn')}</button>
        <button class="minib" onclick="qwTestUI()">${T('qwTestBtn')}</button>
        <button class="minib" onclick="qwClearUI()">${T('qwClearBtn')}</button>
      </div>
      <div class="qwmsg" id="qwMsg"></div>
      <div class="hint">${T('qwHelp')}</div>
    </div>
    <div class="hint" style="margin-top:10px">
      ${T('srcNowUsing')}<b>${usingQW?T('srcQWName'):'Open-Meteo'}</b>${
        g&&g.offsetKm!=null?T('srcOffset',{km:g.offsetKm.toFixed(1)}):''}
      ${S.qwErr?`<span style="color:#E8A183">${T('srcQwFallback',{msg:esc(S.qwErr)})}</span>`:''}
    </div>`;
  b.querySelectorAll('[data-src]').forEach(el=>el.onclick=()=>{
    QW.enabled = el.dataset.src==='qw';
    qwSave(); renderSource();
    if(!QW.enabled || qwReady()) selectPlace(S.cur);
  });
}
function qwSaveUI(){
  QW.host=$('#qwHost').value.trim(); QW.key=$('#qwKey').value.trim(); QW.enabled=true;
  qwSave();
  $('#qwMsg').innerHTML = qwReady() ? `<span style="color:var(--green)">${T('qwSaved')}</span>`
                                    : `<span style="color:#E8A183">${T('qwNeedBoth')}</span>`;
  if(qwReady()) selectPlace(S.cur);
}
async function qwTestUI(){
  QW.host=$('#qwHost').value.trim(); QW.key=$('#qwKey').value.trim();
  const el=$('#qwMsg'); el.innerHTML=`<span class="ld"></span> ${T('qwTesting')}`;
  try{ el.innerHTML='<span style="color:var(--green)">✅ '+esc(await qwTest(S.cur))+'</span>'; }
  catch(e){ el.innerHTML='<span style="color:#E8A183">❌ '+esc(e.message)+'</span>'; }
}
function qwClearUI(){
  QW.host=''; QW.key=''; QW.enabled=false; qwSave(); S.qwErr=null;
  renderSource(); selectPlace(S.cur);
}
function renderSrcBar(){
  const el=$('#srcBar'); if(!el) return;
  if(!S.wx){ el.innerHTML=''; return; }
  const qw = S.wx._source==='qweather';
  const g = S.wx._grid;
  el.innerHTML = `${T('srcBarPrefix')}<b>${qw?T('srcQWLabel'):'Open-Meteo'}</b>`
    + (g&&g.offsetKm!=null ? T('srcOffset',{km:g.offsetKm.toFixed(1)}) : '')
    + (qw?'':T('srcOMDetail'));
}

/* ===================== 渲染：日历 ===================== */
function renderCal(){
  const p=S.cur,c=S.cursor,tp=tzParts(new Date(),p.tz);
  const todayK=key(tp.y,tp.m,tp.d);
  document.querySelectorAll('.tabs button[data-v]').forEach(b=>{
    const on = b.dataset.v===S.view;
    b.classList.toggle('act', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  const body=$('#calBody');
  if(S.view==='month'){
    const y=c.getFullYear(),m=c.getMonth()+1,lz=solarToLunar(y,m,15);
    $('#calTtl').innerHTML=`${T('yearMonth',{y,m,mn:MN(m)})} ${lz?`<small>${lz.ganZhiYear}${lz.animal}年 · ${T('lunarAround',{v:T('lunarMonthOf',{p:T('lunarPrefix'), m:lz.monthCN})})}</small>`:`<small style="color:var(--tx3)">${T('lunarOutOfRangeYear')}</small>`}`;
    const start=new Date(Date.UTC(y,m-1,1)).getUTCDay();
    let h='<div class="wk">'+WD().map(w=>`<div>${w}</div>`).join('')+'</div><div class="mg">';
    for(let i=0;i<42;i++){
      const dt=new Date(Date.UTC(y,m-1,1-start+i));
      h+=cellHTML(dt,dt.getUTCMonth()+1!==m,key(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate())===todayK,
                  key(dt.getUTCFullYear(),dt.getUTCMonth()+1,dt.getUTCDate())===S.sel);
      if(i%7===6&&i>=27&&new Date(Date.UTC(y,m-1,1-start+i+1)).getUTCMonth()+1!==m) break;
    }
    body.innerHTML=h+'</div>';
  } else if(S.view==='week'){
    const base=new Date(c),dow=base.getDay();
    const mon=new Date(base.getFullYear(),base.getMonth(),base.getDate()-dow);
    const end=new Date(mon.getTime()+6*864e5);
    $('#calTtl').innerHTML=`${T('yearItem',{v:mon.getFullYear()})} ${T('weekNo')} ${isoWeek(mon.getFullYear(),mon.getMonth()+1,mon.getDate())} ${T('weeks')} <small>${mon.getMonth()+1}/${mon.getDate()} – ${end.getMonth()+1}/${end.getDate()}</small>`;
    let h='<div class="wv">';
    for(let i=0;i<7;i++){
      const dt=new Date(Date.UTC(mon.getFullYear(),mon.getMonth(),mon.getDate()+i));
      const yy=dt.getUTCFullYear(),mm=dt.getUTCMonth()+1,dd=dt.getUTCDate(),k=key(yy,mm,dd);
      const inf=dayInfo(yy,mm,dd,holidayRegion());
      const _a=altOf(yy,mm,dd);
      const lab=inf.festivals[0]||inf.terms[0]||inf.intl[0]||(_a?_a.main:'');
      const cls=(inf.festivals.length||inf.terms.length||inf.intl.length)?'fes':'';
      const w=wxForDate(k);
      h+=`<div class="wvc ${k===S.sel?'sel':''}" data-k="${k}" style="${k===todayK?'box-shadow:inset 0 0 0 1px var(--acc)':''}">
        <div class="w" style="${i===0||i===6?'color:var(--rest)':''}">${WDL()[i]}</div>
        <div class="d" style="${k===todayK?'color:var(--acc)':''}">${dd}</div>
        <div class="l ${cls}">${lab}</div>
        ${inf.off?`<div style="margin-top:4px"><span class="tag ${inf.off}" style="position:static;display:inline-block">${inf.off==='rest'?T('rest'):T('work')}</span></div>`:''}
        ${w?`<div style="margin-top:6px">${wxIcon(w.code,1,24)}</div><div class="tp"><b>${w.hi}°</b> <span>${w.lo}°</span></div>`:''}</div>`;
    }
    body.innerHTML=h+'</div>';
  } else if(S.view==='year'){
    const y=c.getFullYear();
    const lz=solarToLunar(y,6,15);
    $('#calTtl').innerHTML=`${T('yearItem',{v:y})} ${lz?`<small>${lz.ganZhiYear}${lz.animal}年</small>`:''}`;
    let restCount=0, festCount=0;
    let h='<div class="yg">';
    for(let m=1;m<=12;m++){
      const first=new Date(Date.UTC(y,m-1,1)), start=first.getUTCDay();
      const dim=new Date(Date.UTC(y,m,0)).getUTCDate();
      let cells='';
      for(let i=0;i<42;i++){
        const dn=i-start+1;
        if(dn<1||dn>dim){ cells+='<i></i>'; if(i%7===6&&i>=27&&dn>=dim) break; continue; }
        const inf=dayInfo(y,m,dn,holidayRegion());
        const wd=(start+dn-1)%7;
        let cls='';
        if(inf.off==='rest'){ cls='r'; restCount++; }
        else if(inf.off==='work') cls='w';
        else if(inf.festivals.length||inf.intl.length){ cls='f'; festCount++; }
        else if(inf.terms.length) cls='t';
        else if(wd===0||wd===6) cls='e';
        const isToday = key(y,m,dn)===todayK;
        const _ay=altOf(y,m,dn);
        const tip=[T('dateMD',{m,d:dn,mn:MN(m)}), _ay?_ay.short:'',
          ...inf.terms, ...inf.festivals, ...inf.intl,
          inf.off==='rest'?T('onHoliday'):inf.off==='work'?T('makeupWork'):''].filter(Boolean).join(' · ');
        cells+=`<i class="${cls}${isToday?' n':''}" data-k="${key(y,m,dn)}" title="${tip.replace(/"/g,'')}">${dn}</i>`;
        if(i%7===6&&i>=27&&dn>=dim) break;
      }
      const mLun=solarToLunar(y,m,15);
      h+=`<div class="ym" data-m="${m}">
        <div class="ymh"><b>${T('monthN',{m,mn:MN(m)})}</b><span>${mLun?mLun.monthCN:''}</span></div>
        <div class="ymw">${WD().map(x=>`<u>${x}</u>`).join('')}</div>
        <div class="ymd">${cells}</div></div>`;
    }
    body.innerHTML=h+'</div>'+
      `<div class="ylegend">
        <span><i class="r"></i>${T('legendStatutory')}</span><span><i class="w"></i>${T('legendMakeup')}</span>
        <span><i class="f"></i>${T('legendFestival')}</span><span><i class="t"></i>${T('legendTerm')}</span>
        <span><i class="e"></i>${T('legendWeekend')}</span><span><i class="n"></i>${T('legendToday')}</span>
        <span style="margin-left:auto;color:var(--tx3)">${T('yearSummary',{r:restCount, f:festCount})}</span>
      </div>`;
    body.querySelectorAll('.ym').forEach(el=>el.addEventListener('dblclick',()=>{
      S.view='month'; S.cursor=new Date(y,+el.dataset.m-1,1); save(); renderCal(); }));
    body.querySelectorAll('.ymh').forEach(el=>el.onclick=()=>{
      S.view='month'; S.cursor=new Date(y,+el.parentElement.dataset.m-1,1); save(); renderCal(); });
  } else {
    const y=c.getFullYear(),m=c.getMonth()+1,d=c.getDate(),k=key(y,m,d);
    const inf=dayInfo(y,m,d,holidayRegion()),L=inf.lunar,w=wxForDate(k);
    const wd=new Date(Date.UTC(y,m-1,d)).getUTCDay();
    $('#calTtl').innerHTML=`${T('yearMonth',{y,m,mn:MN(m)})} <small>${WDL()[wd]}</small>`;
    if(!L){ body.innerHTML=`<div class="dv"><div class="big">${d}</div><div class="w">${WDL()[wd]}</div>
      <div class="l" style="color:var(--tx3)">${T('lunarOutOfRange')}</div></div>`;
      S.sel=k; renderDetail(); return; }
    const tags=[];
    if(inf.off==='rest') tags.push(`<span class="chip rest">${inf.official?T('statutoryRest'):T('estimatedRest')} · ${inf.offName}</span>`);
    if(inf.off==='work') tags.push(`<span class="chip work">${T('makeupWork')}</span>`);
    inf.terms.forEach(x=>tags.push(`<span class="chip trm">${T('solarTerm')} · ${x}</span>`));
    inf.festivals.forEach(x=>tags.push(`<span class="chip fes">${x}</span>`));
    inf.intl.forEach(x=>tags.push(`<span class="chip intl">${x}</span>`));
    body.innerHTML=`<div class="dv">
      <div class="big">${d}</div>
      <div class="w">${WDL()[wd]}${k===todayK?' · '+T('today'):''}</div>
      <div class="l">${T('lunarPrefix')} ${L.monthCN}${L.dayCN}</div>
      <div class="gz">${L.ganZhiYear}${L.animal}年 · ${L.ganZhiDay}${T('gzDay')} · ${T('lunarYearMonth',{lunarPrefix:T('lunarPrefix'), y:L.lYear, m:L.monthCN, n:L.monthDays})}</div>
      <div class="chips">${tags.join('')||`<span class="chip" style="color:var(--tx3)">${T('ordinaryDay')}</span>`}</div>
      <div class="dvstat">
        <div class="b"><div class="k">${T('dayOfYear')}</div><div class="v">${Math.floor((Date.UTC(y,m-1,d)-Date.UTC(y,0,1))/864e5)+1} ${T('days')}</div></div>
        <div class="b"><div class="k">${T('weekNo')}</div><div class="v">${isoWeek(y,m,d)} ${T('weeks')}</div></div>
        <div class="b"><div class="k">${T('fromToday')}</div><div class="v">${dayDiffText(k,todayK)}</div></div>
        ${w?`<div class="b"><div class="k">${T('weatherShort')}</div><div class="v">${w.hi}° / ${w.lo}°</div></div>
        <div class="b"><div class="k">${T('condition')}</div><div class="v" style="font-size:12px">${wxText(w.code)}</div></div>`:''}
      </div></div>`;
    S.sel=k;
  }
  body.querySelectorAll('[data-k]').forEach(el=>{
    const pick=()=>{ S.sel=el.dataset.k; renderCal(); renderDetail(); };
    el.onclick=pick;
    el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); pick(); } };
  });
  renderDetail();
}
function dayDiffText(a,b){
  const [y1,m1,d1]=a.split('-').map(Number),[y2,m2,d2]=b.split('-').map(Number);
  const n=Math.round((Date.UTC(y1,m1-1,d1)-Date.UTC(y2,m2-1,d2))/864e5);
  return n===0?T('today'):n>0?T('daysLater',{n}):T('daysAgo',{n:-n});
}
function cellHTML(dt,out,today,sel){
  const y=dt.getUTCFullYear(),m=dt.getUTCMonth()+1,d=dt.getUTCDate(),k=key(y,m,d),wd=dt.getUTCDay();
  const inf=dayInfo(y,m,d,holidayRegion());
  if(!inf.lunar) return `<div class="cell out" title="${T('lunarOutOfRangeTip')}"><span class="d">${d}</span></div>`;
  /* 格子副标题：优先节日/节气，否则显示当前历法的日期。
     选「无额外历法」时这一行留空，格子只显示公历日号。 */
  const alt=altOf(y,m,d);
  let lab = alt ? alt.main : '', cls='';
  if(inf.terms.length){ lab=inf.terms[0]; cls='trm'; }
  if(inf.festivals.length){ lab=inf.festivals[0]; cls='fes'; }
  else if(inf.intl.length){ lab=inf.intl[0]; cls='fes'; }
  const w=wxForDate(k);
  const tip=[`${T('dateCompact',{y,m,d,mn:MN(m)})} ${WDL()[wd]}`, alt?alt.short:'',
    ...inf.terms,...inf.festivals,...inf.intl,
    inf.off==='rest'?T('onHolidayNamed',{name:inf.offName}):inf.off==='work'?T('makeupWork'):'',
    w?`${wxText(w.code)} ${w.hi}°/${w.lo}°`:''].filter(Boolean).join(' · ');
  return `<div class="cell ${out?'out':''} ${today?'today':''} ${sel?'sel':''} ${(wd===0||wd===6)?'wknd':''}"
    data-k="${k}" title="${tip.replace(/"/g,'')}" tabindex="0" role="button"
    aria-label="${tip.replace(/"/g,'')}"${sel?' aria-current="date"':''}>
    ${inf.off?`<span class="tag ${inf.off}">${inf.off==='rest'?T('rest'):T('work')}</span>`:''}
    <span class="d">${d}</span><span class="l ${cls}">${lab}</span>
    ${w?`<span class="wx">${wxIcon(w.code,1,15)}</span>`:''}</div>`;
}
function wxForDate(k){
  if(!S.wx||!S.wx.daily) return null;
  const i=S.wx.daily.time.indexOf(k); if(i<0) return null;
  return {code:S.wx.daily.weather_code[i],hi:Math.round(S.wx.daily.temperature_2m_max[i]),lo:Math.round(S.wx.daily.temperature_2m_min[i])};
}
function renderDetail(){
  const el=$('#detail'); if(!S.sel){ el.innerHTML=''; return; }
  const [y,m,d]=S.sel.split('-').map(Number);
  const inf=dayInfo(y,m,d,holidayRegion()),L=inf.lunar,w=wxForDate(S.sel);
  const wd=new Date(Date.UTC(y,m-1,d)).getUTCDay();
  if(!L){ el.innerHTML=`<div class="dt">${T('dateCompact',{y,m,d,mn:MN(m)})} · ${WDL()[wd]}<span class="sm">${T('lunarOutOfRangeShort')}</span></div>`; return; }
  const items=[];
  if(inf.off==='rest') items.push(`<span class="chip rest">${inf.official?T('statutoryRest'):T('estimatedRest')} · ${inf.offName}</span>`);
  if(inf.off==='work') items.push(`<span class="chip work">${T('makeupWork')}</span>`);
  inf.terms.forEach(x=>items.push(`<span class="chip trm">${x}</span>`));
  inf.festivals.forEach(x=>items.push(`<span class="chip fes">${x}</span>`));
  inf.intl.forEach(x=>items.push(`<span class="chip intl">${x}</span>`));
  el.innerHTML=`<div class="dt">${T('dateCompact',{y,m,d,mn:MN(m)})} · ${WDL()[wd]}
      <span class="sm">${T('lunarPrefix')} ${L.ganZhiYear}${L.animal}年 ${L.monthCN}${L.dayCN} · ${L.ganZhiDay}${T('gzDay')}</span>
      ${w?`<span class="sm">${wxIcon(w.code,1,18)} ${wxText(w.code)} ${w.hi}°/${w.lo}°</span>`:''}
      <button class="minib" onclick="histForDate('${S.sel}')">${T('histSameDate')}</button></div>
    <div class="chips" style="justify-content:flex-start">${items.join('')||`<span class="chip" style="color:var(--tx3)">${T('noFestival')}</span>`}</div>`;
}

/* ===================== 阴阳历互转（滚轮选择器） ===================== */
const RANGE = (a,b,fn) => { const r=[]; for(let i=a;i<=b;i++) r.push({v:i,label:fn?fn(i):String(i)}); return r; };
let WP = {};                                   /* 当前挂载的滚轮实例 */

/* 历法选择下拉。选项只列出当前环境真正支持的（ICU 数据可能缺失）。 */
function renderCalPicker(){
  const el=$('#calSel'); if(!el) return;
  const cur=S.calendar||'auto';
  const opts=[`<option value="auto"${cur==='auto'?' selected':''}>${T('calAuto')}</option>`];
  for(const c of availableCalendars()){
    const v=String(c.id);
    opts.push(`<option value="${v}"${cur===v?' selected':''}>${T(c.labelKey)}</option>`);
  }
  el.innerHTML=opts.join('');
  el.onchange=()=>{ S.calendar=el.value==='null'?null:el.value; save(); paintAll(); };
}
function renderConv(){
  const b=$('#convBody'); if(!b) return;
  document.querySelectorAll('#convTabs button').forEach(x=>x.classList.toggle('act',x.dataset.c===S.convMode));
  WP = {};
  /* 互转的反向查询（农历→公历）目前只有农历引擎实现了。
     其他历法用 Intl 只能单向格式化，反查需要自己写，留作 issue。 */
  const _cal=curCalendar();
  if(_cal && _cal!=='chinese'){
    const t0=tzParts(new Date(),S.cur.tz);
    const cur=(S._s2l||`${t0.y}-${pad(t0.m)}-${pad(t0.d)}`);
    const [cy,cm,cd]=cur.split('-').map(Number);
    const r=altCalendar(cy,cm,cd,_cal,S.lang);
    b.innerHTML=`<div class="convrow">
        <input type="date" id="cvSolarG" value="${cur}" min="1900-01-31" max="2100-12-31">
      </div>
      <div class="convout"><div class="cvbig">${r?esc(r.sub):'—'}</div>
      <div class="cvsub">${esc(T(CALENDAR_BY_ID[_cal]?.labelKey||'calNone'))}</div></div>
      <div class="hint">${T('convOnlyChinese')}</div>`;
    const inp=$('#cvSolarG');
    if(inp) inp.oninput=()=>{ S._s2l=inp.value; renderConv(); };
    return;
  }
  if(!_cal){
    b.innerHTML=`<div class="empty">${T('convNeedCalendar')}</div>`;
    return;
  }
  const t=tzParts(new Date(),S.cur.tz);

  if(S.convMode==='s2l'){
    const cur = (S._s2l||`${t.y}-${pad(t.m)}-${pad(t.d)}`).split('-').map(Number);
    b.innerHTML=`<div class="wheels" id="wS">
        <div class="wcol"><label>${T('yearCol')}</label><div class="wp" id="wSY"></div></div>
        <div class="wcol"><label>${T('monthCol')}</label><div class="wp" id="wSM"></div></div>
        <div class="wcol"><label>${T('dayCol')}</label><div class="wp" id="wSD"></div></div>
      </div>
      <div class="wtoday"><button class="minib" onclick="convToday()">${T('backToToday')}</button></div>
      <div id="cvOut" class="convout"></div>`;
    WP.y = wheelPicker($('#wSY'), {items:RANGE(1900,2100,v=>T('yearItem',{v})), value:cur[0], onChange:onSolarWheel});
    WP.m = wheelPicker($('#wSM'), {items:RANGE(1,12,v=>T('monthItem',{v,mn:MN(v)})), value:cur[1], onChange:onSolarWheel});
    WP.d = wheelPicker($('#wSD'), {items:solarDayItems(cur[0],cur[1]), value:cur[2], onChange:onSolarWheel});
    doS2L();
  } else {
    const ly=S._l2sY||t.y, lm=S._l2sM||1, ld=S._l2sD||1, isL=!!S._l2sLeap;
    b.innerHTML=`<div class="wheels" id="wL">
        <div class="wcol"><label>${T('lunarYearCol')}</label><div class="wp" id="wLY"></div></div>
        <div class="wcol"><label>${T('monthCol')}</label><div class="wp" id="wLM"></div></div>
        <div class="wcol"><label>${T('dayCol')}</label><div class="wp" id="wLD"></div></div>
      </div>
      <div class="wtoday"><button class="minib" onclick="convToday()">${T('backToToday')}</button>
        <span class="leaphint" id="cvLeapHint"></span></div>
      <div id="cvOut" class="convout"></div>`;
    WP.y = wheelPicker($('#wLY'), {items:RANGE(1900,2100,v=>T('yearItem',{v})), value:ly, onChange:onLunarYear});
    WP.m = wheelPicker($('#wLM'), {items:lunarMonthItems(ly), value:isL?-lm:lm, onChange:onLunarMonth});
    WP.d = wheelPicker($('#wLD'), {items:lunarDayItems(ly,lm,isL), value:ld, onChange:doL2S});
    updateLeapHint();
    doL2S();
  }
}
/* 公历某月的天数项 */
function solarDayItems(y,m){
  const dim = new Date(Date.UTC(y,m,0)).getUTCDate();
  return RANGE(1,dim,v=>T('dayItem',{v}));
}
/* 农历月份项：闰月用负数标识（-6 表示闰六月） */
function lunarMonthItems(ly){
  const leap = lunarLeapOf(ly), out=[];
  for(let m=1;m<=12;m++){
    out.push({v:m, label:LM_CN[m-1]+'月'});
    if(leap===m) out.push({v:-m, label:'闰'+LM_CN[m-1]+'月'});
  }
  return out;
}
function lunarDayItems(ly,lm,isLeap){
  const dim = isLeap ? leapDays(ly) : monthDays(ly,lm);
  return RANGE(1,dim,v=>lunarDayCN(v));
}
function onSolarWheel(){
  const y=WP.y.value, m=WP.m.value;
  const items=solarDayItems(y,m);
  if(WP.d) WP.d.replace(items);          /* 换月后天数可能变少，自动收敛 */
  doS2L();
}
function onLunarYear(){
  const ly=WP.y.value;
  const cur=WP.m.value;
  WP.m.replace(lunarMonthItems(ly), cur);
  onLunarMonth();
}
function onLunarMonth(){
  const ly=WP.y.value, mv=WP.m.value;
  const isL=mv<0, lm=Math.abs(mv);
  WP.d.replace(lunarDayItems(ly,lm,isL));
  updateLeapHint();
  doL2S();
}
function updateLeapHint(){
  const el=$('#cvLeapHint'); if(!el) return;
  const leap=lunarLeapOf(WP.y?WP.y.value:0);
  el.textContent = leap ? T('leapThisYear',{m:LM_CN[leap-1]}) : T('noLeapThisYear');
}
function convToday(){
  const t=tzParts(new Date(),S.cur.tz);
  if(S.convMode==='s2l'){
    WP.y.set(t.y); WP.m.set(t.m);
    WP.d.replace(solarDayItems(t.y,t.m), t.d); WP.d.set(t.d);
    doS2L();
  } else {
    const L=solarToLunar(t.y,t.m,t.d);
    if(!L) return;
    WP.y.set(L.lYear);
    WP.m.replace(lunarMonthItems(L.lYear), L.isLeap?-L.lMonth:L.lMonth);
    WP.d.replace(lunarDayItems(L.lYear,L.lMonth,L.isLeap), L.lDay);
    updateLeapHint(); doL2S();
  }
}
function doS2L(){
  if(!WP.y||!WP.m||!WP.d) return;
  const y=WP.y.value, m=WP.m.value, d=WP.d.value;
  const v=`${y}-${pad(m)}-${pad(d)}`; S._s2l=v;
  if(y<1900||y>2100){ $('#cvOut').innerHTML=`<div class="cverr">${T('outOfRange')}</div>`; return; }
  const L=solarToLunar(y,m,d); const inf=dayInfo(y,m,d,holidayRegion());
  const wd=new Date(Date.UTC(y,m-1,d)).getUTCDay();
  $('#cvOut').innerHTML=`<div class="cvbig">${T('lunarPrefix')} ${L.monthCN}${L.dayCN}</div>
    <div class="cvsub">${L.ganZhiYear}${L.animal}年 · ${L.ganZhiDay}${T('gzDay')} · ${WDL()[wd]}</div>
    <div class="chips" style="justify-content:flex-start;margin-top:9px">
      ${inf.terms.map(x=>`<span class="chip trm">${x}</span>`).join('')}
      ${inf.festivals.map(x=>`<span class="chip fes">${x}</span>`).join('')}
      ${inf.off==='rest'?`<span class="chip rest">${T('rest')} · ${inf.offName}</span>`:''}
      ${inf.off==='work'?`<span class="chip work">${T('makeupWork')}</span>`:''}</div>`;
}
function doL2S(){
  if(!WP.y||!WP.m||!WP.d) return;
  const ly=WP.y.value, mv=WP.m.value, ld=WP.d.value;
  const isLeap=mv<0, lm=Math.abs(mv);
  S._l2sY=ly; S._l2sM=lm; S._l2sD=ld; S._l2sLeap=isLeap;
  if(ly<1900||ly>2100){ $('#cvOut').innerHTML=`<div class="cverr">${T('outOfRange')}</div>`; return; }
  const dt=lunarToSolar(ly,lm,ld,isLeap);
  if(!dt){ $('#cvOut').innerHTML=`<div class="cverr">${T('invalidLunarDate')}</div>`; return; }
  const y=dt.getUTCFullYear(),m=dt.getUTCMonth()+1,d=dt.getUTCDate();
  const inf=dayInfo(y,m,d,holidayRegion());
  $('#cvOut').innerHTML=`<div class="cvbig">${T('dateLong',{y,m,d,mn:MN(m)})}</div>
    <div class="cvsub">${WDL()[dt.getUTCDay()]} · ${T('fromToday')} ${dayDiffText(key(y,m,d),(()=>{const t=tzParts(new Date(),S.cur.tz);return key(t.y,t.m,t.d);})())}</div>
    <div class="chips" style="justify-content:flex-start;margin-top:9px">
      ${inf.terms.map(x=>`<span class="chip trm">${x}</span>`).join('')}
      ${inf.festivals.map(x=>`<span class="chip fes">${x}</span>`).join('')}</div>`;
}

/* ===================== 历史天气 ===================== */
function todayKeyLocal(){ const t=tzParts(new Date(),S.cur.tz); return key(t.y,t.m,t.d); }
function renderHistCtrl(){
  const c=$('#histCtrl'); if(!c) return;
  document.querySelectorAll('#histTabs button').forEach(x=>x.classList.toggle('act',x.dataset.h===S.histMode));
  const maxD=archiveMaxDate();
  const def=S._hd||maxD;
  if(S.histMode==='one'){
    c.innerHTML=`<div class="convrow">
      <input type="date" id="hDate" value="${def}" min="${ARCHIVE_MIN}" max="${maxD}">
      <button class="gobtn" onclick="runHistOne()">${T('query')}</button></div>`;
  } else if(S.histMode==='range'){
    const e=S._hre||maxD;
    const sD=S._hrs||(()=>{const d=new Date(Date.parse(e)-89*864e5);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;})();
    c.innerHTML=`<div class="convrow">
      <input type="date" id="hS" value="${sD}" min="${ARCHIVE_MIN}" max="${maxD}">
      <span class="cvlab">→</span>
      <input type="date" id="hE" value="${e}" min="${ARCHIVE_MIN}" max="${maxD}">
      <button class="gobtn" onclick="runHistRange()">${T('query')}</button></div>
      <div class="hint">${T('rangeMaxHint',{n:RANGE_MAX_DAYS})}</div>`;
  } else {
    const t=tzParts(new Date(),S.cur.tz);
    c.innerHTML=`<div class="convrow">
      <input type="date" id="hC" value="${S._hc||key(t.y,t.m,t.d)}" min="1941-01-01" max="2100-12-31">
      <span class="cvlab">${T('lookback')}</span>
      <select id="hY">${[5,10,15].map(v=>`<option value="${v}" ${(S._hy||10)==v?'selected':''}>${T('yearsItem',{v})}</option>`).join('')}</select>
      <select id="hW">${[0,3,7].map(v=>`<option value="${v}" ${(S._hw??3)==v?'selected':''}>${v?T('plusMinusDays',{v}):T('onlyThatDay')}</option>`).join('')}</select>
      <button class="gobtn" onclick="runHistCmp()">${T('query')}</button></div>`;
  }
}
function histBusy(on){ S.histBusy=on;
  if(on) $('#histBody').innerHTML=`<div class="empty"><span class="ld"></span> ${T('querying')}</div>`; }
function histFail(e){ $('#histBody').innerHTML=`<div class="wxerr">${T('weatherFailedTitle')}<div class="m">${e.message||e}</div></div>`; }

async function runHistOne(){
  const v=$('#hDate').value; if(!v) return; S._hd=v;
  histBusy(true);
  try{
    const j=await getArchive(S.cur,v,v);
    const D=j.daily;
    if(!D||D.temperature_2m_max[0]==null){ $('#histBody').innerHTML=`<div class="empty">${T('noHistData')}</div>`; return; }
    const [y,m,d]=v.split('-').map(Number);
    const inf=dayInfo(y,m,d,holidayRegion()), L=inf.lunar;
    const wd=new Date(Date.UTC(y,m-1,d)).getUTCDay();
    $('#histBody').innerHTML=`
      <div class="histone">
        <div class="hi1">${wxIcon(D.weather_code[0],1,54)}</div>
        <div><div class="hbig">${Math.round(D.temperature_2m_max[0])}° <small>/ ${Math.round(D.temperature_2m_min[0])}°</small></div>
        <div class="hsub">${wxText(D.weather_code[0])} · ${T('meanTemp')} ${(D.temperature_2m_mean&&D.temperature_2m_mean[0]!=null?D.temperature_2m_mean[0]:(D.temperature_2m_max[0]+D.temperature_2m_min[0])/2).toFixed(1)}°</div>
        <div class="hsub">${T('precipLabel')} ${D.precipitation_sum[0]??0} mm · ${T('maxWind')} ${Math.round(D.wind_speed_10m_max[0]??0)} km/h</div></div>
      </div>
      <div class="histmeta">${T('dateCompact',{y,m,d,mn:MN(m)})} · ${WDL()[wd]} · ${T('lunarPrefix')}${T('lunarSep')}${L.monthCN}${L.dayCN} · ${L.ganZhiYear}${L.animal}年
        ${inf.festivals.length?' · '+inf.festivals.join(T('listJoin')):''}${inf.terms.length?' · '+inf.terms.join(T('listJoin')):''}</div>
      <div class="hint">${T('era5Hint')}</div>`;
  }catch(e){ histFail(e); } finally{ histBusy(false); }
}
async function runHistRange(){
  const s=$('#hS').value, e=$('#hE').value; if(!s||!e) return;
  if(s>e){ $('#histBody').innerHTML=`<div class="empty">${T('startAfterEnd')}</div>`; return; }
  const days=Math.round((Date.parse(e)-Date.parse(s))/864e5)+1;
  if(days>RANGE_MAX_DAYS){ $('#histBody').innerHTML=`<div class="empty">${T('rangeTooLong',{n:RANGE_MAX_DAYS})}${T('currentDays',{n:days})}</div>`; return; }
  S._hrs=s; S._hre=e; histBusy(true);
  try{
    const j=await getArchive(S.cur,s,e);
    const D=j.daily;
    const data=D.time.map((t,i)=>({date:t,hi:D.temperature_2m_max[i],lo:D.temperature_2m_min[i],pr:D.precipitation_sum[i]}));
    const ok=data.filter(x=>x.hi!=null);
    if(!ok.length){ $('#histBody').innerHTML=`<div class="empty">${T('noHistData')}</div>`; return; }
    const his=nums(ok.map(x=>x.hi)),los=nums(ok.map(x=>x.lo)),prs=ok.map(x=>x.pr||0);
    const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
    $('#histBody').innerHTML=`
      ${lineChart(data)}
      <div class="hstats">
        <div class="b"><div class="k">${T('avgHigh')}</div><div class="v">${avg(his).toFixed(1)}°</div></div>
        <div class="b"><div class="k">${T('avgLow')}</div><div class="v">${los.length?avg(los).toFixed(1):'—'}°</div></div>
        <div class="b"><div class="k">${T('extHigh')}</div><div class="v">${his.length?Math.max(...his).toFixed(1):'—'}°</div></div>
        <div class="b"><div class="k">${T('extLow')}</div><div class="v">${los.length?Math.min(...los).toFixed(1):'—'}°</div></div>
        <div class="b"><div class="k">${T('totalPrecip')}</div><div class="v">${prs.reduce((a,b)=>a+b,0).toFixed(0)} mm</div></div>
        <div class="b"><div class="k">${T('wetDays')}</div><div class="v">${T('dayCount',{n:prs.filter(v=>v>=1).length})}</div></div>
      </div>
      <div class="hint">${T('rangeHint',{s,e,n:ok.length})}</div>`;
  }catch(e){ histFail(e); } finally{ histBusy(false); }
}
async function runHistCmp(){
  const v=$('#hC').value; if(!v) return;
  const years=+$('#hY').value, win=+$('#hW').value;
  S._hc=v; S._hy=years; S._hw=win;
  const [,m,d]=v.split('-').map(Number);
  histBusy(true);
  try{
    const {buckets}=await fetchSamePeriod(S.cur,m,d,years,win);
    const stat=summarize(buckets);
    if(!stat){ $('#histBody').innerHTML=`<div class="empty">${T('noHistData')}</div>`; return; }
    /* 今年该日的预报（若在预报窗口内） */
    let today=null;
    if(S.wx&&S.wx.daily){
      const i=S.wx.daily.time.findIndex(t=>t.slice(5)===v.slice(5));
      if(i>=0) today={hi:S.wx.daily.temperature_2m_max[i],lo:S.wx.daily.temperature_2m_min[i],
                      code:S.wx.daily.weather_code[i],uv:S.wx.daily.uv_index_max[i]};
    }
    const narr=climateNarrative(stat,today,S.cur,m,d,years);
    /* 结合历史均值给穿衣建议 */
    const cHi = today && today.hi!=null ? today.hi : stat.hiMean;
    const cLo = today && today.lo!=null ? today.lo : stat.loMean;
    const adv=buildAdvice({
      tNow:null, atNow:null, tMax:cHi, tMin:cLo, atMax:null, atMin:null,
      wind:12, rh:60, uv:today?today.uv:null, pop:stat.wetRate, precip:stat.prMean,
      code:today?today.code:null, elev:S.wx?S.wx.elevation:null, aqi:null
    });
    $('#histBody').innerHTML=`
      <div class="narr">${narr.map(t=>`<p>${t}</p>`).join('')}</div>
      ${yearBars(stat.perYear)}
      <div class="hstats">
        <div class="b"><div class="k">${T('normHigh')}</div><div class="v">${stat.hiMean}°</div></div>
        <div class="b"><div class="k">${T('normLow')}</div><div class="v">${stat.loMean}°</div></div>
        <div class="b"><div class="k">${T('histHigh')}</div><div class="v">${stat.hiMax}°</div></div>
        <div class="b"><div class="k">${T('histLow')}</div><div class="v">${stat.loMin}°</div></div>
        <div class="b"><div class="k">${T('wetProb')}</div><div class="v">${stat.wetRate}%</div></div>
        <div class="b"><div class="k">${T('samples')}</div><div class="v">${T('dayCount',{n:stat.n})}</div></div>
      </div>
      <div class="advrow" style="margin-top:12px"><span class="lb">${T('layers')}</span><span class="vl">${adv.layers.join('；')}</span></div>
      ${adv.accessories.length?`<div class="advrow"><span class="lb">${T('accessories')}</span>
        <span class="vl">${adv.accessories.map(a=>`<span class="acc">${a}</span>`).join('')}</span></div>`:''}
      ${adv.notes.length?`<div class="advrow"><span class="lb">${T('notes')}</span>
        <span class="vl"><ul class="advnotes">${adv.notes.map(n=>`<li>${n}</li>`).join('')}</ul></span></div>`:''}
      <div class="hint">${T('cmpHint',{win: win?T('cmpWin',{n:win}):T('cmpWinOnly'), y:years})}</div>`;
  }catch(e){ histFail(e); } finally{ histBusy(false); }
}
function histForDate(k){
  S.histMode='cmp'; S._hc=k;
  renderHistCtrl();
  const el=$('#histBody'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'});
  runHistCmp();
}

/* ===================== 世界时钟 / 收藏 / 节日 ===================== */
function dayGrad(h,mi){
  const pct=((h*60+mi)/1440*100).toFixed(1), e=Math.min(+pct+2,100);
  const nite=cssVar('--daybar-night','#25211C'), dawn=cssVar('--caramel','#C97B4A'),
        day =cssVar('--golden','#E0A458'), noon=cssVar('--oat','#EBD9BE'),
        mark=cssVar('--cream','#F2EFEA');
  return `linear-gradient(90deg,transparent ${pct}%,${mark} ${pct}%,${mark} ${e}%,transparent ${e}%),`
       + `linear-gradient(90deg,${nite} 0%,${nite} 20%,${dawn} 27%,${day} 38%,${noon} 50%,${day} 64%,${dawn} 76%,${nite} 86%,${nite} 100%)`;
}
function renderClocks(){
  const now=new Date();
  $('#wcList').innerHTML=S.favs.map(f=>{
    const t=tzParts(now,f.tz),off=tzOffsetMin(now,f.tz),l=solarToLunar(t.y,t.m,t.d);
    const c=tzParts(now,S.cur.tz);
    const n=Math.round((Date.UTC(t.y,t.m-1,t.d)-Date.UTC(c.y,c.m-1,c.d))/864e5);
    const dd=n===0?'':n>0?T('nextDay'):T('prevDay');
    return `<div class="wcc ${f.id===S.primary?'pri':''}" data-id="${f.id}" style="${f.id===S.cur.id?'border-color:var(--acc)':''}">
      <span class="star" data-star="${f.id}">${f.id===S.primary?'★':'☆'}</span>
      <div class="n">${esc(placeName(f,S.lang))}</div><div class="c">${esc(placeCountry(f,S.lang))} · ${offLabel(off)}</div>
      <div class="t">${pad(t.H)}:${pad(t.M)}<small>:${pad(t.S)}</small></div>
      <div class="dd"><span>${t.m}/${t.d} ${T('weekShort')}${WD()[t.wd]} ${dd}</span><span>${l.monthCN}${l.dayCN}</span></div>
      <div class="nightbar" style="background:${dayGrad(t.H,t.M)}"></div></div>`;
  }).join('');
  $('#wcList').querySelectorAll('.wcc').forEach(el=>el.onclick=e=>{
    if(e.target.dataset.star){ S.primary=+e.target.dataset.star; save(); renderFavs(); renderClocks(); toast(T('primarySetToast')); return; }
    selectPlace(S.favs.find(f=>f.id==el.dataset.id));
  });
}
function renderFavs(){
  const now=new Date();
  $('#favs').innerHTML=S.favs.map(f=>{
    const t=tzParts(now,f.tz);
    return `<span class="fav ${f.id===S.cur.id?'act':''}" data-id="${f.id}">
      ${f.id===S.primary?'<span class="st">★</span>':''}${esc(placeName(f,S.lang))}
      <span class="t">${pad(t.H)}:${pad(t.M)}</span>
      ${S.favs.length>1?`<span class="x" data-del="${f.id}">×</span>`:''}</span>`;
  }).join('');
  $('#favs').querySelectorAll('.fav').forEach(el=>el.onclick=e=>{
    if(e.target.dataset.del){ const id=+e.target.dataset.del;
      S.favs=S.favs.filter(f=>f.id!==id);
      if(S.primary===id) S.primary=S.favs[0].id;
      save(); if(S.cur.id===id) selectPlace(S.favs[0]); else { renderFavs(); renderClocks(); fillTZ(); }
      return; }
    selectPlace(S.favs.find(f=>f.id==el.dataset.id));
  });
  $('#addFav').textContent=S.favs.some(f=>f.id===S.cur.id)?T('faved'):T('addFav');
}
/* 界面语言对应的节日地区。
   只在所选地点那个国家没有节日规则时兜底 —— 比如在内罗毕，
   我们没有肯尼亚的规则，这时中文用户看中国节日比看一片空白有用。 */
const LANG_HOLIDAY_CC = {
  'zh-CN':'CN', 'zh-TW':'TW', 'ja':'JP', 'ko':'KR',
  'en':'US', 'es':'ES', 'fr':'FR', 'de':'DE', 'ar':'AE'
};
/* 支持的节日地区。CN 单列在最前面，因为它有法定放假/调休这套独有的数据。 */
function holidayRegions(){
  const list = ['CN'].concat(Object.keys(COUNTRY_RULES).filter(c => c !== 'CN'));
  return [...new Set(list)];
}
/**
 * 当前该显示哪个地区的节日。
 *   1. 用户在下拉框里选过 → 听他的
 *   2. 所选地点的国家有规则 → 用它（在东京就看日本节日）
 *   3. 没有规则 → 退回界面语言对应的地区
 *   4. 都不行 → 还是用地点的国家码（至少节气还能显示）
 */
function holidayRegion(){
  if(S.holRegion && S.holRegion !== 'auto') return S.holRegion;
  const cc = (S.cur && S.cur.cc) ? String(S.cur.cc).toUpperCase() : '';
  if(cc === 'CN' || (cc && COUNTRY_RULES[cc])) return cc;
  return LANG_HOLIDAY_CC[S.lang] || cc || 'CN';
}
function initHolRegion(){
  const sel = $('#holSel'); if(!sel) return;
  const cur = S.holRegion || 'auto';
  sel.innerHTML = `<option value="auto"${cur==='auto'?' selected':''}>${esc(T('holRegionAuto'))}</option>` +
    holidayRegions().map(cc =>
      `<option value="${cc}"${cur===cc?' selected':''}>${esc(regionName(cc, S.lang, cc))}</option>`).join('');
  sel.title = T('holRegionLabel');
  sel.setAttribute('aria-label', T('holRegionLabel'));
  sel.onchange = () => { S.holRegion = sel.value; save(); renderHolidays(); renderCal(); renderNow(); };
}

function renderHolidays(){
  const p=S.cur,now=tzParts(new Date(),p.tz),todayU=Date.UTC(now.y,now.m-1,now.d);
  const cc=holidayRegion();
  const rows=[];
  for(let yr=now.y;yr<=now.y+1;yr++){
    const seen={};
    if(cc==='CN'){
      const H=cnHolidayMap(yr), days=Object.keys(H.R).sort(); let i=0;
      while(i<days.length){
        let j=i; const nm=H.R[days[i]];
        while(j+1<days.length&&H.R[days[j+1]]===nm&&(Date.parse(yr+'-'+days[j+1])-Date.parse(yr+'-'+days[j]))===864e5) j++;
        rows.push({u:Date.parse(yr+'-'+days[i]+'T00:00:00Z'),y:yr,md:days[i],name:nm,
          sub:`${T('holRestDays',{n:j-i+1})}${days[i]!==days[j]?T('holRange',{a:days[i].replace('-','/'), b:days[j].replace('-','/')}):''}${H.est?T('holEstimated'):T('holStatutory')}`});
        i=j+1;
      }
      CN_LUNAR_FES.forEach(([lm,ld,n])=>{ const dt=findLunar(yr,lm,ld); if(!dt) return;
        const md=`${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`; if(H.R[md]) return;
        const li=solarToLunar(yr,dt.getUTCMonth()+1,dt.getUTCDate());
        rows.push({u:dt.getTime(),y:yr,md,name:n,sub:T('lunarPrefix')+' '+li.monthCN+li.dayCN}); });
      const cx=chuxi(yr);
      if(cx&&cx.getUTCFullYear()===yr){ const md=`${pad(cx.getUTCMonth()+1)}-${pad(cx.getUTCDate())}`;
        if(!H.R[md]) rows.push({u:cx.getTime(),y:yr,md,name:'除夕',sub:T('lunarMonthEnd')}); }
      Object.entries(CN_SOLAR_FES).forEach(([md,n])=>{ if(H.R[md]||seen[md+n]) return; seen[md+n]=1;
        rows.push({u:Date.parse(yr+'-'+md+'T00:00:00Z'),y:yr,md,name:n,sub:T('solarFestival')}); });
    } else {
      const H=countryHolidays(cc,yr);
      Object.entries(H).forEach(([k,ns])=>{ const [a,b,c2]=k.split('-').map(Number);
        const li=solarToLunar(a,b,c2);
        rows.push({u:Date.UTC(a,b-1,c2),y:yr,md:`${pad(b)}-${pad(c2)}`,name:ns.join(' / '),
          sub:T('countryHolidaySub',{c:esc(regionName(cc,S.lang,cc)), lunar:T('lunarPrefix')+T('lunarSep')+li.monthCN+li.dayCN})}); });
    }
    const TT=yearTerms(yr);
    Object.entries(TT).forEach(([k,n])=>{ const [a,b,c]=k.split('-').map(Number);
      rows.push({u:Date.UTC(a,b-1,c),y:yr,md:`${pad(b)}-${pad(c)}`,name:n,sub:T('terms24'),term:true}); });
  }
  const list=rows.filter(r=>r.u>=todayU-2*864e5).sort((a,b)=>a.u-b.u).slice(0,60);
  $('#holYr').textContent=cc==='CN'?T('holYrCN'):T('holYrOther',{c:regionName(cc,S.lang,cc)});  /* textContent */
  $('#holList').innerHTML=list.map(r=>{
    const dd=Math.round((r.u-todayU)/864e5), [mm,dj]=r.md.split('-');
    return `<div class="hli ${dd<0?'past':''}" data-k="${r.y}-${r.md}">
      <div class="dt2"><div class="m">${T('yearMonthShort',{y:r.y, m:+mm, mn:MN(+mm)})}</div><div class="d">${+dj}</div></div>
      <div class="nm" style="${r.term?'color:var(--green)':''}">${r.name}<small>${r.sub}</small></div>
      <div class="cd">${dd===0?`<b>${T('today')}</b>`:dd<0?T('daysAgo',{n:-dd}):T('daysLater',{n:`<b>${dd}</b>`})}</div></div>`;
  }).join('')||`<div class="empty">${T('noData')}</div>`;
  $('#holList').querySelectorAll('.hli').forEach(el=>el.onclick=()=>{
    const [y,m,d]=el.dataset.k.split('-').map(Number);
    S.cursor=new Date(y,m-1,d); S.sel=el.dataset.k; renderCal(); });
}

/* ===================== 时区换算 ===================== */
/* 常用时区列表；显示名走语言包 STRINGS.*.tzNames */
const EXTRA_TZ=['Asia/Shanghai','Asia/Tokyo','Asia/Seoul','Asia/Singapore',
 'Asia/Hong_Kong','Asia/Dubai','Asia/Kolkata','Asia/Bangkok',
 'Europe/London','Europe/Paris','Europe/Berlin','Europe/Moscow',
 'America/New_York','America/Chicago','America/Los_Angeles',
 'America/Sao_Paulo','Australia/Sydney','Pacific/Auckland','UTC'];
function fillTZ(){
  const opts=[],seen={};
  if(S.cur){ seen[S.cur.tz]=1; opts.push([S.cur.tz,T('tzCurrentOpt',{n:placeName(S.cur,S.lang)})]); }  /* 值在下面统一 esc */
  S.favs.forEach(f=>{ if(!seen[f.tz]){seen[f.tz]=1;opts.push([f.tz,T('tzFavOpt',{n:placeName(f,S.lang)})]);} });
  const lz=localTZ(); if(!seen[lz]){seen[lz]=1;opts.push([lz,T('tzLocalOpt',{tz:lz})]);}
  const TZN=T('tzNames')||{};
  EXTRA_TZ.forEach(t=>{ if(!seen[t]){seen[t]=1;opts.push([t,TZN[t]||t]);} });
  const html=opts.map(([t,n])=>`<option value="${esc(t)}">${esc(n)} (${esc(t)})</option>`).join('');
  const a=$('#tzA'),b=$('#tzB'),av=a.value,bv=b.value;
  a.innerHTML=html; b.innerHTML=html;
  a.value=av||S.cur.tz; b.value=bv||(opts.find(o=>o[0]!==a.value)||opts[0])[0];
  if(!$('#tzTimeA').value){ const p=tzParts(new Date(),a.value);
    $('#tzTimeA').value=`${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.H)}:${pad(p.M)}`; }
  calcTZ('A');
}
const fmtLocal = p => `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.H)}:${pad(p.M)}`;
function wallToUTC(y,m,d,H,M,tz){
  let ts=Date.UTC(y,m-1,d,H,M);
  for(let i=0;i<3;i++){ const p=tzParts(new Date(ts),tz);
    const diff=Date.UTC(p.y,p.m-1,p.d,p.H,p.M)-Date.UTC(y,m-1,d,H,M);
    if(diff===0) break; ts-=diff; }
  return ts;
}
/* 双向换算：src 指明这次是哪一侧被改动，另一侧跟着算 */
function calcTZ(src){
  const A=$('#tzA').value, B=$('#tzB').value;
  const from = (src==='B') ? {tz:B, el:'#tzTimeB'} : {tz:A, el:'#tzTimeA'};
  const v=$(from.el).value; if(!v) return;
  const [ds,ts]=v.split('T'),[y,m,d]=ds.split('-').map(Number),[H,M]=ts.split(':').map(Number);
  if(!isFinite(y)||!isFinite(H)) return;
  const utc=wallToUTC(y,m,d,H,M,from.tz);
  const pa=tzParts(new Date(utc),A),pb=tzParts(new Date(utc),B);
  /* 把另一侧的输入框同步过去（避免互相触发死循环，只写非当前编辑的那侧） */
  if(src!=='A') $('#tzTimeA').value=fmtLocal(pa);
  if(src!=='B') $('#tzTimeB').value=fmtLocal(pb);
  const la=solarToLunar(pa.y,pa.m,pa.d),lb=solarToLunar(pb.y,pb.m,pb.d);
  $('#outA').innerHTML=`${pad(pa.H)}:${pad(pa.M)}<small>${pa.y}/${pa.m}/${pa.d} ${T('weekShort')}${WD()[pa.wd]} · ${T('lunarPrefix')}${T('lunarSep')}${la.monthCN}${la.dayCN}</small>`;
  $('#outB').innerHTML=`${pad(pb.H)}:${pad(pb.M)}<small>${pb.y}/${pb.m}/${pb.d} ${T('weekShort')}${WD()[pb.wd]} · ${T('lunarPrefix')}${T('lunarSep')}${lb.monthCN}${lb.dayCN}</small>`;
  const oa=tzOffsetMin(new Date(utc),A),ob=tzOffsetMin(new Date(utc),B),dh=(ob-oa)/60;
  const dd=Math.round((Date.UTC(pb.y,pb.m-1,pb.d)-Date.UTC(pa.y,pa.m-1,pa.d))/864e5);
  $('#tzDiff').innerHTML=`${A.split('/').pop().replace(/_/g,' ')} ${offLabel(oa)} → ${B.split('/').pop().replace(/_/g,' ')} ${offLabel(ob)}　${T('tzDiff')} ${T('hoursUnit',{n:`<b>${dh===0?'0':(dh>0?'+':'')+dh}</b>`})}${dd?'　'+T('dayShiftParen',{v:dd>0?T('nextDay'):T('prevDay')}):''}`;
}

/* ===================== 主流程 ===================== */
function paintAll(){
  const panes=[['paneNow',renderNow],['paneAdvice',renderAdvice],['paneIntraday',renderIntraday],['paneWeather',renderWx],
               ['paneSrcBar',renderSrcBar],['paneSource',renderSource],['paneCalendar',renderCal],
               ['paneConvert',renderConv],['paneHistory',renderHistCtrl],['paneFavs',renderFavs],
               ['paneClocks',renderClocks],['paneHolidays',renderHolidays],['paneTz',fillTZ]];
  for(const [k,f] of panes){
    try{ f(); }catch(e){ showErr(T('renderFailed',{pane:T(k),msg:e.message})); console.error(k,e); }
  }
}
async function selectPlace(p){
  if(!p) return;
  S.cur=p; S.wx=null; S.wxErr=null; S.air=null;
  const t=tzParts(new Date(),p.tz);
  S.cursor=new Date(t.y,t.m-1,t.d); S.sel=key(t.y,t.m,t.d);
  const token=++S._token;
  S.qwErr=null;
  /* 有和风凭据就先试和风（3–5 km），任何失败都静默回退到 Open-Meteo */
  const fetchWeather = async () => {
    if(qwReady()){
      try{ const j = await qwGetWeather(p); j._grid=null; return j; }
      catch(e){ S.qwErr = e.message||String(e); }
    }
    const j = await getWeather(p);
    j._source='open-meteo'; j._grid = gridNote(j,p);
    return j;
  };
  const jobW=fetchWeather().then(j=>{ if(token===S._token){S.wx=j;S.wxErr=null;} })
                          .catch(e=>{ if(token===S._token){S.wx=null;S.wxErr=e.message||String(e);} });
  const jobA=getAir(p).then(j=>{ if(token===S._token) S.air=j; }).catch(()=>{});
  const jobP=getRecentPast(p,3).then(r=>{ if(token===S._token) S.past=r; }).catch(()=>{ if(token===S._token) S.past=null; });
  /* 官方预警：按地点自动挑数据源（香港天文台 / 美国国家气象局 / 台风网 /
     和风），逐个并行请求，某个源挂了不影响其他源。详见 65-warning.js */
  const jobG=getOfficialWarnings(p,S.lang).then(r=>{ if(token===S._token) S.warnsOfficial=r; })
                                          .catch(()=>{ if(token===S._token) S.warnsOfficial=[]; });
  paintAll();
  await jobW; if(token===S._token){ S.warns=deriveWarnings(S.wx,S.lang); paintAll(); }
  await Promise.allSettled([jobA,jobP,jobG]);
  if(token===S._token){ renderNow(); renderAdvice(); renderWx(); }
}
function retryWx(){ if(S.cur) selectPlace(S.cur); }

/* ===================== 事件 ===================== */
let sT=null;
$('#q').addEventListener('input',e=>{
  clearTimeout(sT); $('#q')._r=null;   /* 立刻作废旧结果，防止回车跳到上一次搜索 */
  const q=e.target.value.trim();
  if(q.length<1){ $('#sug').classList.remove('on'); return; }
  $('#sug').innerHTML=`<div style="color:var(--tx3)"><span class="ld"></span> ${T('searching')}</div>`;
  $('#sug').classList.add('on');
  $('#q').setAttribute('aria-expanded','true');
  sT=setTimeout(async()=>{
    let res;
    try{ res=await geoSearch(q); }
    catch(err){ $('#sug').innerHTML=`<div style="color:#E8A183">${T('searchFailed',{msg:err.message})}</div>
      <div style="color:var(--tx3);font-size:11px">${T('offlineStillWorks')}</div>`;
      $('#sug').classList.add('on'); return; }
    try{
      const r=res.list;
      if(!r.length){ $('#sug').innerHTML=`<div style="color:var(--tx3)">${T('notFound')}</div>`; $('#sug').classList.add('on'); return; }
      const banner = res.viaDistrict
        ? `<div class="viadist">${T(res.viaDistrict.hadLocal?'viaDistrictBoth':'viaDistrictOne',
             {from:esc(res.viaDistrict.from), to:esc(res.viaDistrict.to)})}</div>`
        : res.offline
          ? `<div class="viadist">${res.empty?T('offlineApprox'):T('offlineResults')}</div>`
          : '';
      $('#sug').innerHTML = banner
        +r.map((x,i)=>{
          const near=(!x.pop||x.pop<50000)?nearestCity(x.lat,x.lon,300):null;
          const nearTxt=(near&&near.city.name!==x.name)?` · ${T('nearCity',{name:near.city.name,km:Math.round(near.km)})}`:'';
          /* 主名跟随界面语言，另一种写法作副标题，两种语言的用户都能认出来 */
          const main = placeName(x,S.lang), alt = (main===x.name ? x.enName : x.name);
          const en = (alt && alt!==main) ? ` <span class="ename">${esc(alt)}</span>` : '';
          return `<div data-i="${i}"><b>${esc(main)}</b>${en}
          <div class="sub">${esc([x.admin1,x.country].filter(Boolean).join(' · '))} · ${esc(x.tz)}${x.pop?' · '+T('population',{v:(x.pop>1e6?(x.pop/1e6).toFixed(1)+'M':Math.round(x.pop/1e3)+'K')}):''}${esc(nearTxt)}</div></div>`;}).join('');
      $('#sug').classList.add('on');
      $('#sug').querySelectorAll('[data-i]').forEach(el=>el.onclick=()=>{
        $('#sug').classList.remove('on'); $('#q').value='';
        const pick={...r[+el.dataset.i]};
        if(!pick.pop||pick.pop<50000){ const near=nearestCity(pick.lat,pick.lon,300);
          if(near&&near.city.name!==pick.name) pick.nearNote=T('nearCity',{name:near.city.name,km:Math.round(near.km)}); }
        selectPlace(pick);
      });
      $('#q')._r=r;
    }catch(err){ showErr(T('errSearchRender',{msg:err.message})); }
  },320);
});
$('#q').addEventListener('keydown',e=>{ if(e.key==='Enter'&&$('#q')._r&&$('#q')._r.length){
  $('#sug').classList.remove('on'); $('#q').value=''; selectPlace($('#q')._r[0]); }});
document.addEventListener('click',e=>{
  if(!e.target.closest('.search')){ $('#sug').classList.remove('on'); $('#q').setAttribute('aria-expanded','false'); }
});

$('#addFav').onclick=()=>{
  if(S.favs.some(f=>f.id===S.cur.id)){ toast(T('alreadyFav')); return; }
  S.favs.push(S.cur); save(); renderFavs(); renderClocks(); fillTZ(); toast(T('favedToast',{name:placeName(S.cur,S.lang)}));  /* toast 用 textContent */
};
$('#theme').onclick=()=>{ S.theme=S.theme==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',S.theme); save();
  paintAll();   /* 图表颜色随主题变，需重绘 */ };
document.querySelectorAll('.tabs button[data-v]').forEach(b=>b.onclick=()=>{
  S.view=b.dataset.v; save();
  if(S.view!=='month'&&S.sel){ const [y,m,d]=S.sel.split('-').map(Number); S.cursor=new Date(y,m-1,d); }
  renderCal(); });
document.querySelectorAll('#convTabs button').forEach(b=>b.onclick=()=>{ S.convMode=b.dataset.c; renderConv(); });
document.querySelectorAll('#histTabs button').forEach(b=>b.onclick=()=>{ S.histMode=b.dataset.h;
  renderHistCtrl(); $('#histBody').innerHTML=`<div class="empty">${T('pickThenQuery',{q:T('query')})}</div>`; });

/* 农历数据边界，留出月视图补格所需的余量 */
const CUR_MIN=new Date(1900,1,1), CUR_MAX=new Date(2100,10,1);
function clampCursor(d){ return d<CUR_MIN?new Date(CUR_MIN):d>CUR_MAX?new Date(CUR_MAX):d; }
function shift(n){ const c=S.cursor, prev=new Date(c);
  let nx;
  if(S.view==='year') nx=new Date(c.getFullYear()+n,c.getMonth(),1);
  else if(S.view==='month') nx=new Date(c.getFullYear(),c.getMonth()+n,1);
  else if(S.view==='week') nx=new Date(c.getFullYear(),c.getMonth(),c.getDate()+7*n);
  else nx=new Date(c.getFullYear(),c.getMonth(),c.getDate()+n);
  const cl=clampCursor(nx);
  if(cl.getTime()===prev.getTime() && nx.getTime()!==prev.getTime()){ toast(T('lunarBoundary')); return; }
  S.cursor=cl;
  try{ renderCal(); }
  catch(e){ S.cursor=prev; showErr(T('errCalRender',{msg:e.message})); try{ renderCal(); }catch(_){} }
}
$('#prev').onclick=()=>shift(-1);
$('#next').onclick=()=>shift(1);
$('#todayB').onclick=()=>{ const t=tzParts(new Date(),S.cur.tz);
  S.cursor=new Date(t.y,t.m-1,t.d); S.sel=key(t.y,t.m,t.d); renderCal(); };
document.addEventListener('keydown',e=>{
  if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  if(e.key==='ArrowLeft') shift(-1); else if(e.key==='ArrowRight') shift(1);
  else if(e.key==='t'||e.key==='T') $('#todayB').click(); });
$('#swap').onclick=()=>{
  const a=$('#tzA').value; $('#tzA').value=$('#tzB').value; $('#tzB').value=a;
  const ta=$('#tzTimeA').value; $('#tzTimeA').value=$('#tzTimeB').value; $('#tzTimeB').value=ta;
  calcTZ('A');
};
$('#tzA').onchange=()=>calcTZ('A');           /* 改地点 A：以 A 的时间为准重算 B */
$('#tzB').onchange=()=>calcTZ('A');
$('#tzTimeA').oninput=()=>calcTZ('A');
$('#tzTimeB').oninput=()=>calcTZ('B');        /* 改 B 的时间：反推 A */

/* 语言选择器 */
function initLang(){
  const sel=$('#langSel'); if(!sel) return;
  sel.innerHTML=LOCALES.map(l=>`<option value="${l}" ${l===S.lang?'selected':''}>${LANG_NAMES[l]||l}</option>`).join('');
  sel.style.display=LOCALES.length>1?'':'none';
  sel.onchange=()=>{ S.lang=sel.value; setLang(S.lang); save();
    S.warns = deriveWarnings(S.wx, S.lang);      /* 预警文案是按语言生成的，切换时要重算 */
    initHolRegion();                             /* 节日地区的选项名也要按新语言重建 */
    applyStaticText(); paintAll(); };
}
/* 当前生效的历法 id。'auto' 时按「地点优先、语言兜底」推断，
   详见 25-calendars.js 的 resolveCalendar。 */
function curCalendar(){ return resolveCalendar(S.calendar, S.lang, S.cur); }
/* 取某日在当前历法下的表示，供日历格子与详情复用 */
function altOf(y,m,d){
  const cal = curCalendar();
  if(!cal) return null;
  try{ return altCalendar(y, m, d, cal, S.lang); }catch(e){ return null; }
}

/* 「当前天气」面板里的第二行日期。
   早先这里写死了农历，结果英文界面看伦敦也会冒出一行「Lunar 七月初六」。
   现在跟随 curCalendar()：北京显示农历，首尔显示檀纪，
   伦敦配英文界面则整行不出现。农历有干支和节气，信息比其他历法多，
   所以单独排版；其他历法走 Intl 给的长格式。 */
function altLineHTML(y,m,d,L){
  const cal = curCalendar();
  if(!cal) return '';
  if(cal === 'chinese'){
    if(!L) return '';
    return `<div class="lline">${T('lunarPrefix')}${T('lunarSep')}${L.ganZhiYear}${L.animal}年 ` +
           `${L.monthCN}${L.dayCN}${L.term?' · '+L.term:''} · ${L.ganZhiDay}${T('gzDay')}</div>`;
  }
  const a = altOf(y,m,d);
  if(!a || !a.sub) return '';
  return `<div class="lline">${esc(a.sub)}</div>`;
}
function applyStaticText(){
  document.documentElement.lang=S.lang;
  /* 阿拉伯语走 RTL，其余 LTR。CSS 里用 html[dir="rtl"] 做镜像适配。 */
  document.documentElement.setAttribute('dir', isRTL(S.lang) ? 'rtl' : 'ltr');
  const set=(id,v)=>{ const e=$(id); if(e) e.textContent=v; };
  set('#brandName',T('appName')); set('#adviceTitle',T('adviceTitle')); set('#calTitle',T('calendar'));
  set('#convTitle',T('converterTitle')); set('#wxTitle',T('weather7')); set('#histTitle',T('historyTitle'));
  set('#tzTitle',T('tzConvert')); set('#wcTitle',T('worldClock')); set('#wcHint',T('clickToSwitch'));
  set('#holTitle',T('holidays')); set('#todayB',T('today'));
  document.title=T('appName');
  $('#q').placeholder=T('searchPlaceholder');
  $('#theme').textContent=T('theme');
  set('#intraTitle',T('intraTitle')); set('#srcTitle',T('srcTitle')); set('#srcSub',T('srcSubtitle'));
  set('#tzLabA',T('placeA')); set('#tzLabB',T('placeB'));
  const sw=$('#swap'); if(sw) sw.title=T('swapTitle');
  const hh=$('#histHint'); if(hh) hh.textContent=T('pickDateThenQuery');   /* 只在还没查询过时存在 */
  const lgs=$('#langSel'); if(lgs) lgs.title=T('lang')+' / Language';
  const tabs=[['[data-v="day"]','day'],['[data-v="week"]','week'],['[data-v="month"]','month'],
              ['[data-v="year"]','year'],
              ['[data-c="s2l"]','solarToLunar'],['[data-c="l2s"]','lunarToSolar'],
              ['[data-h="one"]','histSingle'],['[data-h="range"]','histRange'],['[data-h="cmp"]','histCompare']];
  tabs.forEach(([sel,k])=>{ const e=document.querySelector(sel); if(e) e.textContent=T(k); });
  const f=$('#foot'); if(f) f.innerHTML=`${T('footer1')}<br>${T('footer2')}`;
}

/* ===================== 启动 ===================== */
try{
  load(); qwLoad();
  document.documentElement.setAttribute('data-theme',S.theme);
  initLang(); initHolRegion(); applyStaticText();
  S.cur=S.favs.find(f=>f.id===S.primary)||S.favs[0];
  selectPlace(S.cur);
}catch(e){ showErr(T('errBoot',{msg:e.message})); }
setInterval(()=>{ try{ tickClock(); if(new Date().getSeconds()%2===0){ renderClocks(); renderFavs(); } }catch(e){} },1000);
setInterval(async()=>{
  const tk=S._token, who=S.cur;
  try{ const j=await getWeather(who);
    if(tk!==S._token||S.cur!==who) return;      /* 期间用户切了城市，丢弃旧响应 */
    S.wx=j; S.wxErr=null;
    try{ const a=await getAir(who); if(tk===S._token&&S.cur===who) S.air=a; }catch(e){}
    if(tk===S._token&&S.cur===who) paintAll();
  }catch(e){}
},15*60*1000);

/* Service Worker（仅 http/https 下注册） */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
  /* 新版本接管时自动刷新一次，避免长期停在旧 JS（含旧的节假日表） */
  let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloaded) return; reloaded=true; location.reload();
  });
}
