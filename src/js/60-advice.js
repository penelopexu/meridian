/* ===== 体感与穿衣建议规则引擎（纯本地，无需网络） =====

   【体感温度为什么不直接用接口给的值】
   Open-Meteo 的 apparent_temperature 用的是澳大利亚体感温度公式（Steadman 1994）：
       AT = T + 0.33e − 0.70v − 4.00
   这个公式是为「热应激评估」设计的，在 20–27°C 区间会过度放大湿度权重。
   实测：25°C + 98%RH + 3km/h → AT = 30.6°C，但实际体感接近 25°C，并不炎热。

   本模块改用分段模型，每段只在各自公认的有效区间内使用：
     T ≥ 27°C            → NOAA 热指数 Rothfusz 回归式（官方声明仅适用于 ≥ 80°F）
     T ≤ 10°C 且风 > 4.8 → 加拿大/美国联合风寒指数 JAG/TI 2001
     10 ~ 27°C           → 以气温为准，只做小幅风、湿、日照、降水修正
   这个中间段国际上没有权威的湿度订正公式，气象部门通行做法就是直接报气温。   */

/* NOAA 热指数（Rothfusz 回归 + 两个边角订正），输入摄氏，输出摄氏 */
function heatIndexC(tC, rh){
  const T = tC*9/5 + 32;
  if(T < 80) return tC;                       // 官方有效下界，低于此直接返回气温
  let HI = -42.379 + 2.04901523*T + 10.14333127*rh - 0.22475541*T*rh
         - 0.00683783*T*T - 0.05481717*rh*rh + 0.00122874*T*T*rh
         + 0.00085282*T*rh*rh - 0.00000199*T*T*rh*rh;
  if(rh < 13 && T >= 80 && T <= 112)
    HI -= ((13-rh)/4) * Math.sqrt((17-Math.abs(T-95))/17);
  else if(rh > 85 && T >= 80 && T <= 87)
    HI += ((rh-85)/10) * ((87-T)/5);
  return (HI-32)*5/9;
}
/* 风寒指数 JAG/TI（2001，加拿大气象局与美国国家气象局联合修订） */
function windChillC(tC, windKmh){
  if(tC > 10 || windKmh <= 4.8) return tC;    // 官方有效区间之外不适用
  const v = Math.pow(windKmh, 0.16);
  return 13.12 + 0.6215*tC - 11.37*v + 0.3965*tC*v;
}

/**
 * 体感温度（分段模型）
 * @param o {t 气温, rh 相对湿度%, wind 风速km/h, isDay, precip 降水mm, cloud 云量%, }
 */
function feelsLike(o){
  const t = o.t;
  if(t == null || !isFinite(t)) return null;
  const w  = Math.max(o.wind || 0, 0);
  const rh = (o.rh != null && isFinite(o.rh)) ? o.rh : null;
  let at;

  if(t >= 27 && rh != null){
    at = heatIndexC(t, rh);                   // 湿度主导
  } else if(t <= 10 && w > 4.8){
    at = windChillC(t, w);                    // 风主导
  } else {
    at = t;                                   // 舒适区：以气温为准
    if(w > 5) at -= Math.min((w-5)/10*0.6, 2.5);            // 风的轻微降温
    if(rh != null && t >= 22 && rh >= 75)                    // 偏热且潮，小幅加成
      at += ((rh-75)/25) * ((t-22)/5) * 1.2;
    if(rh != null && t <= 12 && rh >= 80) at -= 1.0;         // 湿冷更难熬
  }
  if(o.precip > 0) at -= Math.min(1 + o.precip*0.3, 3);      // 淋湿的蒸发降温
  if(o.isDay && o.cloud != null && t >= 15){                 // 日晒加成
    if(o.cloud < 30) at += 1.5; else if(o.cloud < 60) at += 0.7;
  }
  return at;
}
/* 兼容旧调用名 */
function apparentTemp(t, rh, windKmh){ return feelsLike({t, rh, wind:windKmh}); }

/* 个人冷暖偏好 → 体感温度偏移
   方向：怕冷的人在同样天气下觉得更冷，所以体感往下调，落到更冷的档位，
        建议自然就变成穿更多；怕热的人反之。
   （注意别写反：调高体感 = 判定更热 = 建议穿更少，那是怕热该有的效果） */
const COMFORT_BIAS = { cold:-2.5, normal:0, hot:2.5 };
/* 自检：符号写反过一次，留个断言钉住方向 */
if(!(COMFORT_BIAS.cold < COMFORT_BIAS.normal && COMFORT_BIAS.normal < COMFORT_BIAS.hot))
  console.error('COMFORT_BIAS 方向错误：应为 怕冷 < 正常 < 怕热');

/* 海拔修正：
   - 气温递减率约 6.5°C/1000m（接口已按实际网格高程给值，此处仅用于提示）
   - 紫外线随海拔每升高 1000m 增强约 10–12% */
function uvAtElevation(uv, elevM){
  if(!uv || !elevM || elevM<=0) return uv;
  return uv * (1 + 0.10*(elevM/1000));
}

/* 只留数值阈值与色调，label / tip 走语言包（STRINGS.*.uvLevels[id]） */
const UV_LEVELS = [
  {max:2.9,  id:'low',      tone:'ok'},
  {max:5.9,  id:'moderate', tone:'warn'},
  {max:7.9,  id:'high',     tone:'warn'},
  {max:10.9, id:'veryHigh', tone:'bad'},
  {max:99,   id:'extreme',  tone:'bad'}
];
function uvLevel(uv){
  const lv = (uv==null||!isFinite(uv))                /* 脏数据不要报最高级 */
    ? UV_LEVELS[0]
    : (UV_LEVELS.find(l=>uv<=l.max) || UV_LEVELS[UV_LEVELS.length-1]);
  const txt = (T('uvLevels')||{})[lv.id] || {};
  return {max:lv.max, id:lv.id, tone:lv.tone, label:txt.label||lv.id, tip:txt.tip||null};
}

/* 美标 AQI 分级 */
const AQI_LEVELS = [
  {max:50,  id:'good',      tone:'ok'},
  {max:100, id:'moderate',  tone:'ok'},
  {max:150, id:'usg',       tone:'warn'},
  {max:200, id:'unhealthy', tone:'warn'},
  {max:300, id:'veryBad',   tone:'bad'},
  {max:999, id:'hazardous', tone:'bad'}
];
function aqiLevel(v){
  const lv = (v==null||!isFinite(v))
    ? AQI_LEVELS[0]
    : (AQI_LEVELS.find(l=>v<=l.max) || AQI_LEVELS[AQI_LEVELS.length-1]);
  const txt = (T('aqiLevels')||{})[lv.id] || {};
  return {max:lv.max, id:lv.id, tone:lv.tone, label:txt.label||lv.id, tip:txt.tip||null};
}

/* 按体感温度分档。档位名 / 穿着 / 补充说明都在语言包 STRINGS.*.bands[id] 里，
   这里只保留温度阈值，切语言时不用改这张表。 */
const BANDS = [
  {min: 35, id:'scorching'},
  {min: 30, id:'veryHot'},
  {min: 26, id:'hot'},
  {min: 22, id:'warm'},
  {min: 18, id:'mild'},
  {min: 14, id:'cool'},
  {min: 10, id:'chilly'},
  {min:  5, id:'cold'},
  {min:  0, id:'veryCold'},
  {min:-10, id:'freezing'},
  {min:-99, id:'extreme'}
];
function tempBand(at){
  if(at==null || !isFinite(at)) return null;      /* 防止 null 被当成 0 掉进「很冷」档 */
  const b = BANDS.find(b=>at>=b.min) || BANDS[BANDS.length-1];
  const txt = (T('bands')||{})[b.id] || {};
  return {min:b.min, id:b.id, key:txt.name||b.id, wear:txt.wear||'', extra:txt.extra||null};
}
/* 依次取第一个有效数字 */
function firstNum(...xs){ for(const x of xs) if(x!=null && isFinite(x)) return x; return null; }
const avg2 = (a,b) => (a!=null&&b!=null&&isFinite(a)&&isFinite(b)) ? (a+b)/2 : null;

/**
 * 生成建议
 * @param d {tMax,tMin,atMax,atMin,tNow,atNow,wind,gust,rh,uv,pop,precip,code,elev,aqi,pm25}
 */
function buildAdvice(d){
  /* 体感一律用本模块的分段模型算，不直接采信接口的 apparent_temperature，
     原因见文件顶部注释。只有在完全没有气温数据时才退回接口值。 */
  const baseT = firstNum(d.tNow, avg2(d.tMax,d.tMin));
  let at = (baseT != null)
    ? feelsLike({t:baseT, rh:d.rh, wind:d.wind, isDay:d.isDay, precip:d.precip, cloud:d.cloud})
    : firstNum(d.atNow, avg2(d.atMax,d.atMin));
  /* 个人冷暖偏好校准 */
  if(at != null && d.bias) at += (COMFORT_BIAS[d.bias] || 0);
  const band = tempBand(at);
  if(!band) return {at:null, band:'—', layers:[T('advNoTemp')],
                    accessories:[], notes:[], uvAdj:null, swing:null};
  const layers = [band.wear];
  const acc = [];
  const notes = [];

  if(band.extra) notes.push(band.extra);

  /* 昼夜温差 */
  const swing = (d.tMax!=null && d.tMin!=null) ? d.tMax-d.tMin : null;
  if(swing!=null && swing>=12) notes.push(T('advSwingBig',{n:Math.round(swing)}));
  else if(swing!=null && swing>=8) notes.push(T('advSwingMid',{n:Math.round(swing)}));

  /* 风 */
  if(d.wind>=40) { layers.push(T('advWindproof')); notes.push(T('advWindStrong',{n:Math.round(d.wind)})); }
  else if(d.wind>=25) notes.push(T('advWindMod',{n:Math.round(d.wind)}));
  if(d.gust!=null && d.gust>=60) notes.push(T('advGust',{n:Math.round(d.gust)}));

  /* 湿度 */
  if(d.rh!=null){
    if(d.rh>=80 && at>=26) notes.push(T('advHumidHot'));
    else if(d.rh>=85 && at<10) notes.push(T('advHumidCold'));
    else if(d.rh<=30) notes.push(T('advDry'));
  }

  /* 降水 */
  const willRain = (d.pop!=null && d.pop>=50) || (d.precip!=null && d.precip>=1);
  const mayRain  = (d.pop!=null && d.pop>=30);
  const isSnow = d.code!=null && [71,73,75,77,85,86].includes(d.code);
  if(isSnow){ acc.push(T('accAntiSlip')); notes.push(T('advSnowRoad')); }
  else if(willRain){ acc.push(T('accUmbrella')); if(d.precip>=10) acc.push(T('accRaincoat')); }
  else if(mayRain) acc.push(T('accFoldUmbrella'));

  /* 紫外线（含海拔增强） */
  const uvAdj = uvAtElevation(d.uv, d.elev);
  if(uvAdj!=null && isFinite(uvAdj) && uvAdj>0){
    const lv = uvLevel(uvAdj);
    if(lv.tip) notes.push(T('advUv',{label:lv.label, v:uvAdj.toFixed(1), tip:lv.tip}));
    if(uvAdj>=6){ acc.push(T('accSunscreen')); acc.push(T('accSunglasses')); }
    if(uvAdj>=8) acc.push(T('accSunhat'));
  }

  /* 海拔 */
  if(d.elev!=null){
    if(d.elev>=3000) notes.push(T('advElev3000',{n:Math.round(d.elev)}));
    else if(d.elev>=2000) notes.push(T('advElev2000',{n:Math.round(d.elev)}));
    else if(d.elev>=1200) notes.push(T('advElev1200',{n:Math.round(d.elev)}));
  }

  /* 空气质量 */
  if(d.aqi!=null && isFinite(d.aqi)){
    const lv=aqiLevel(d.aqi);
    if(lv.tip) notes.push(T('advAqi',{label:lv.label, v:Math.round(d.aqi), tip:lv.tip}));
    if(d.aqi>=150) acc.push(T('accMask'));
  }

  /* 极端温度提醒 */
  if(at>=35) notes.push(T('advHeat'));
  if(at<=-10) notes.push(T('advFreeze'));

  return {
    at, band: band.key, layers,
    accessories:[...new Set(acc)],
    notes,
    uvAdj, swing
  };
}
