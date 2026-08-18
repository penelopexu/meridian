/* ================= 节日 / 假期 ================= */
const pad = n => String(n).padStart(2,'0');
const key = (y,m,d) => `${y}-${pad(m)}-${pad(d)}`;

/* ---- 中国法定节假日：国务院办公厅正式通知（放假 R / 补班 W） ---- */
const CN_OFFICIAL = {
 2024:{R:{'01-01':'元旦','02-10':'春节','02-11':'春节','02-12':'春节','02-13':'春节','02-14':'春节','02-15':'春节','02-16':'春节','02-17':'春节','04-04':'清明节','04-05':'清明节','04-06':'清明节','05-01':'劳动节','05-02':'劳动节','05-03':'劳动节','05-04':'劳动节','05-05':'劳动节','06-08':'端午节','06-09':'端午节','06-10':'端午节','09-15':'中秋节','09-16':'中秋节','09-17':'中秋节','10-01':'国庆节','10-02':'国庆节','10-03':'国庆节','10-04':'国庆节','10-05':'国庆节','10-06':'国庆节','10-07':'国庆节'},
      W:['02-04','02-18','04-07','04-28','05-11','09-14','09-29','10-12']},
 2025:{R:{'01-01':'元旦','01-28':'春节','01-29':'春节','01-30':'春节','01-31':'春节','02-01':'春节','02-02':'春节','02-03':'春节','02-04':'春节','04-04':'清明节','04-05':'清明节','04-06':'清明节','05-01':'劳动节','05-02':'劳动节','05-03':'劳动节','05-04':'劳动节','05-05':'劳动节','05-31':'端午节','06-01':'端午节','06-02':'端午节','10-01':'国庆节','10-02':'国庆节','10-03':'国庆节','10-04':'国庆节','10-05':'国庆节','10-06':'国庆中秋','10-07':'国庆节','10-08':'国庆节'},
      W:['01-26','02-08','04-27','09-28','10-11']},
 2026:{R:{'01-01':'元旦','01-02':'元旦','01-03':'元旦','02-15':'春节','02-16':'春节','02-17':'春节','02-18':'春节','02-19':'春节','02-20':'春节','02-21':'春节','02-22':'春节','02-23':'春节','04-04':'清明节','04-05':'清明节','04-06':'清明节','05-01':'劳动节','05-02':'劳动节','05-03':'劳动节','05-04':'劳动节','05-05':'劳动节','06-19':'端午节','06-20':'端午节','06-21':'端午节','09-25':'中秋节','09-26':'中秋节','09-27':'中秋节','10-01':'国庆节','10-02':'国庆节','10-03':'国庆节','10-04':'国庆节','10-05':'国庆节','10-06':'国庆节','10-07':'国庆节'},
      W:['01-04','02-14','02-28','05-09','09-20','10-10']}
};

/* 未公布年份：按法定节日本身推算（不含调休） */
function cnStatutoryFallback(y){
  const R = {};
  const put=(m,d,n)=>{ const dt=new Date(Date.UTC(y,m-1,d)); R[`${pad(dt.getUTCMonth()+1)}-${pad(dt.getUTCDate())}`]=n; };
  put(1,1,'元旦');
  // 春节：除夕~初三
  const cny = findLunar(y,1,1);
  if(cny){ for(let i=-1;i<=3;i++){ const d=new Date(cny.getTime()+i*864e5); if(d.getUTCFullYear()===y) R[`${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`]='春节'; } }
  // 清明（节气）
  const tms = yearTerms(y);
  for(const k in tms) if(tms[k]==='清明') R[k.slice(5)]='清明节';
  put(5,1,'劳动节'); put(5,2,'劳动节');
  const dw = findLunar(y,5,5);  if(dw) R[`${pad(dw.getUTCMonth()+1)}-${pad(dw.getUTCDate())}`]='端午节';
  const zq = findLunar(y,8,15); if(zq) R[`${pad(zq.getUTCMonth()+1)}-${pad(zq.getUTCDate())}`]='中秋节';
  put(10,1,'国庆节'); put(10,2,'国庆节'); put(10,3,'国庆节');
  return {R, W:[], est:true};
}
const _cnCache={};
function cnHolidayMap(y){
  if(_cnCache[y]) return _cnCache[y];
  return (_cnCache[y] = CN_OFFICIAL[y] ? {...CN_OFFICIAL[y], est:false} : cnStatutoryFallback(y));
}
/* 查某公历年内 农历 lm 月 ld 日 对应的公历 Date(UTC) */
const _flCache={};
function findLunar(y,lm,ld){
  const ck=`${y}-${lm}-${ld}`; if(_flCache[ck]!==undefined) return _flCache[ck];
  for(let i=0;i<366;i++){
    const d=new Date(Date.UTC(y,0,1+i)); if(d.getUTCFullYear()!==y) break;
    const l=solarToLunar(y,d.getUTCMonth()+1,d.getUTCDate());
    if(l && !l.isLeap && l.lMonth===lm && l.lDay===ld) return (_flCache[ck]=d);
  }
  return (_flCache[ck]=null);
}
/* 除夕（正月初一前一天） */
function chuxi(y){ const c=findLunar(y,1,1); return c? new Date(c.getTime()-864e5) : null; }

/* ---- 中国传统 / 现代节日 ---- */
const CN_SOLAR_FES = {
 '01-01':'元旦','02-14':'情人节','03-08':'妇女节','03-12':'植树节','03-15':'消费者权益日',
 '04-01':'愚人节','05-01':'劳动节','05-04':'青年节','05-12':'护士节','06-01':'儿童节',
 '07-01':'建党节','08-01':'建军节','09-10':'教师节','09-18':'九一八纪念日','10-01':'国庆节',
 '10-31':'万圣夜','11-11':'双十一','12-13':'国家公祭日','12-24':'平安夜','12-25':'圣诞节'
};
const CN_LUNAR_FES = [
 [1,1,'春节'],[1,15,'元宵节'],[2,2,'龙抬头'],[3,3,'上巳节'],[5,5,'端午节'],[6,6,'天贶节'],
 [7,7,'七夕节'],[7,15,'中元节'],[8,15,'中秋节'],[9,9,'重阳节'],[10,1,'寒衣节'],
 [10,15,'下元节'],[12,8,'腊八节'],[12,23,'北方小年'],[12,24,'南方小年']
];

/* ---- 复活节（公历） ---- */
function easter(y){
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,
        f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,
        i=Math.floor(c/4),k2=c%4,l=(32+2*e+2*i-h-k2)%7,m=Math.floor((a+11*h+22*l)/451);
  const mo=Math.floor((h+l-7*m+114)/31), da=((h+l-7*m+114)%31)+1;
  return new Date(Date.UTC(y,mo-1,da));
}
/* 某月第 n 个星期 wd（n<0 表示倒数） */
function nthWd(y,m,wd,n){
  if(n>0){ const first=new Date(Date.UTC(y,m-1,1)); const off=(wd-first.getUTCDay()+7)%7; return new Date(Date.UTC(y,m-1,1+off+(n-1)*7)); }
  const last=new Date(Date.UTC(y,m,0)); const off=(last.getUTCDay()-wd+7)%7; return new Date(Date.UTC(y,m,0-off));
}
/* 不晚于 y-m-d 的最近一个星期 wd */
function wdOnOrBefore(y,m,d,wd){
  const dt=new Date(Date.UTC(y,m-1,d)); const off=(dt.getUTCDay()-wd+7)%7;
  return new Date(Date.UTC(y,m-1,d-off));
}
/* 落在 [y-m-d1, y-m-d2] 区间内的星期 wd */
function wdInRange(y,m,d1,wd){
  const dt=new Date(Date.UTC(y,m-1,d1)); const off=(wd-dt.getUTCDay()+7)%7;
  return new Date(Date.UTC(y,m-1,d1+off));
}

/* ---- 各国节日规则 ---- */
const COUNTRY_RULES = {
 US:{name:'美国',list:y=>[
   [Date.UTC(y,0,1),'New Year\'s Day 元旦'],[nthWd(y,1,1,3),'Martin Luther King Jr. Day'],
   [nthWd(y,2,1,3),'Presidents\' Day 总统日'],[Date.UTC(y,2,17),'St. Patrick\'s Day'],
   [easter(y),'Easter 复活节'],[nthWd(y,5,0,2),'Mother\'s Day 母亲节'],[nthWd(y,5,1,-1),'Memorial Day 阵亡将士日'],
   [Date.UTC(y,5,19),'Juneteenth'],[nthWd(y,6,0,3),'Father\'s Day 父亲节'],
   [Date.UTC(y,6,4),'Independence Day 独立日'],[nthWd(y,9,1,1),'Labor Day 劳动节'],
   [nthWd(y,10,1,2),'Columbus Day'],[Date.UTC(y,10,11),'Veterans Day 退伍军人节'],
   [Date.UTC(y,9,31),'Halloween 万圣夜'],[nthWd(y,11,4,4),'Thanksgiving 感恩节'],
   [Date.UTC(y,11,25),'Christmas 圣诞节']]},
 GB:{name:'英国',list:y=>[
   [Date.UTC(y,0,1),'New Year\'s Day'],[new Date(easter(y).getTime()-2*864e5),'Good Friday 受难日'],
   [new Date(easter(y).getTime()+864e5),'Easter Monday'],[nthWd(y,5,1,1),'Early May Bank Holiday'],
   [nthWd(y,5,1,-1),'Spring Bank Holiday'],[nthWd(y,8,1,-1),'Summer Bank Holiday'],
   [Date.UTC(y,11,25),'Christmas Day 圣诞节'],[Date.UTC(y,11,26),'Boxing Day 节礼日']]},
 JP:{name:'日本',list:y=>{
   const tms=yearTerms(y); let vernal=null,autumnal=null;
   for(const k in tms){ if(tms[k]==='春分') vernal=k; if(tms[k]==='秋分') autumnal=k; }
   const kd=s=>{const[a,b,c]=s.split('-').map(Number);return Date.UTC(a,b-1,c);};
   return [[Date.UTC(y,0,1),'元日 New Year'],[nthWd(y,1,1,2),'成人の日'],[Date.UTC(y,1,11),'建国記念の日'],
   [Date.UTC(y,1,23),'天皇誕生日'],[vernal?kd(vernal):null,'春分の日'],[Date.UTC(y,3,29),'昭和の日'],
   [Date.UTC(y,4,3),'憲法記念日'],[Date.UTC(y,4,4),'みどりの日'],[Date.UTC(y,4,5),'こどもの日'],
   [nthWd(y,7,1,3),'海の日'],[Date.UTC(y,7,11),'山の日'],[nthWd(y,9,1,3),'敬老の日'],
   [autumnal?kd(autumnal):null,'秋分の日'],[nthWd(y,10,1,2),'スポーツの日'],
   [Date.UTC(y,10,3),'文化の日'],[Date.UTC(y,10,23),'勤労感謝の日'],[Date.UTC(y,11,25),'クリスマス']];}},
 KR:{name:'韩国',list:y=>{
   const s=findLunar(y,1,1), c=findLunar(y,8,15), b=findLunar(y,4,8);
   const r=[[Date.UTC(y,0,1),'신정 元旦'],[Date.UTC(y,2,1),'삼일절 三一节'],[Date.UTC(y,4,5),'어린이날 儿童节'],
   [Date.UTC(y,5,6),'현충일 显忠日'],[Date.UTC(y,7,15),'광복절 光复节'],[Date.UTC(y,9,3),'개천절 开天节'],
   [Date.UTC(y,9,9),'한글날 韩文日'],[Date.UTC(y,11,25),'성탄절 圣诞'] ];
   if(s) r.push([s.getTime(),'설날 春节']); if(c) r.push([c.getTime(),'추석 中秋']);
   if(b) r.push([b.getTime(),'부처님오신날 佛诞']); return r;}},
 SG:{name:'新加坡',list:y=>{
   const s=findLunar(y,1,1);
   const r=[[Date.UTC(y,0,1),'New Year\'s Day'],[new Date(easter(y).getTime()-2*864e5),'Good Friday'],
   [Date.UTC(y,4,1),'Labour Day 劳动节'],[Date.UTC(y,7,9),'National Day 国庆'],[Date.UTC(y,11,25),'Christmas']];
   if(s){ r.push([s.getTime(),'农历新年']); r.push([s.getTime()+864e5,'农历新年次日']); } return r;}},
 HK:{name:'中国香港',list:y=>{
   const s=findLunar(y,1,1), c=findLunar(y,8,15), d=findLunar(y,5,5), cy=findLunar(y,9,9), tms=yearTerms(y);
   let qm=null; for(const k in tms) if(tms[k]==='清明'){const[a,b,cc]=k.split('-').map(Number);qm=Date.UTC(a,b-1,cc);}
   const r=[[Date.UTC(y,0,1),'元旦'],[qm,'清明节'],[new Date(easter(y).getTime()-2*864e5),'耶稣受难节'],
   [Date.UTC(y,4,1),'劳动节'],[Date.UTC(y,6,1),'香港特别行政区成立纪念日'],[Date.UTC(y,9,1),'国庆日'],
   [Date.UTC(y,11,25),'圣诞节'],[Date.UTC(y,11,26),'圣诞节后第一个周日']];
   if(s){r.push([s.getTime(),'农历年初一']);r.push([s.getTime()+864e5,'年初二']);r.push([s.getTime()+2*864e5,'年初三']);}
   if(d) r.push([d.getTime(),'端午节']); if(c) r.push([c.getTime()+864e5,'中秋节翌日']);
   if(cy) r.push([cy.getTime(),'重阳节']); return r;}},
 TW:{name:'中国台湾',list:y=>{
   const s=findLunar(y,1,1), c=findLunar(y,8,15), d=findLunar(y,5,5), tms=yearTerms(y);
   let qm=null; for(const k in tms) if(tms[k]==='清明'){const[a,b,cc]=k.split('-').map(Number);qm=Date.UTC(a,b-1,cc);}
   const r=[[Date.UTC(y,0,1),'开国纪念日'],[Date.UTC(y,1,28),'和平纪念日'],[qm,'清明节'],
   [Date.UTC(y,9,10),'双十节'],[Date.UTC(y,11,25),'圣诞节']];
   if(s){r.push([s.getTime()-864e5,'除夕']);r.push([s.getTime(),'春节']);}
   if(d) r.push([d.getTime(),'端午节']); if(c) r.push([c.getTime(),'中秋节']); return r;}},
 AU:{name:'澳大利亚',list:y=>[[Date.UTC(y,0,1),'New Year\'s Day'],[Date.UTC(y,0,26),'Australia Day 国庆'],
   [new Date(easter(y).getTime()-2*864e5),'Good Friday'],[new Date(easter(y).getTime()+864e5),'Easter Monday'],
   [Date.UTC(y,3,25),'ANZAC Day'],[nthWd(y,6,1,2),'Queen\'s/King\'s Birthday'],
   [Date.UTC(y,11,25),'Christmas'],[Date.UTC(y,11,26),'Boxing Day']]},
 CA:{name:'加拿大',list:y=>[[Date.UTC(y,0,1),'New Year\'s Day'],[new Date(easter(y).getTime()-2*864e5),'Good Friday'],
   [wdOnOrBefore(y,5,24,1),'Victoria Day'],[Date.UTC(y,6,1),'Canada Day 国庆'],[nthWd(y,9,1,1),'Labour Day'],
   [Date.UTC(y,8,30),'Truth & Reconciliation Day'],[nthWd(y,10,1,2),'Thanksgiving 感恩节'],
   [Date.UTC(y,10,11),'Remembrance Day'],[Date.UTC(y,11,25),'Christmas'],[Date.UTC(y,11,26),'Boxing Day']]},
 DE:{name:'德国',list:y=>[[Date.UTC(y,0,1),'Neujahr 元旦'],[new Date(easter(y).getTime()-2*864e5),'Karfreitag'],
   [new Date(easter(y).getTime()+864e5),'Ostermontag'],[Date.UTC(y,4,1),'Tag der Arbeit 劳动节'],
   [new Date(easter(y).getTime()+39*864e5),'Christi Himmelfahrt'],[new Date(easter(y).getTime()+50*864e5),'Pfingstmontag'],
   [Date.UTC(y,9,3),'Tag der Deutschen Einheit 统一日'],[Date.UTC(y,11,25),'1. Weihnachtstag'],[Date.UTC(y,11,26),'2. Weihnachtstag']]},
 FR:{name:'法国',list:y=>[[Date.UTC(y,0,1),'Jour de l\'An'],[new Date(easter(y).getTime()+864e5),'Lundi de Pâques'],
   [Date.UTC(y,4,1),'Fête du Travail 劳动节'],[Date.UTC(y,4,8),'Victoire 1945'],
   [new Date(easter(y).getTime()+39*864e5),'Ascension'],[new Date(easter(y).getTime()+50*864e5),'Lundi de Pentecôte'],
   [Date.UTC(y,6,14),'Fête Nationale 国庆日'],[Date.UTC(y,7,15),'Assomption'],[Date.UTC(y,10,1),'Toussaint'],
   [Date.UTC(y,10,11),'Armistice 1918'],[Date.UTC(y,11,25),'Noël 圣诞']]},
 IT:{name:'意大利',list:y=>[[Date.UTC(y,0,1),'Capodanno'],[Date.UTC(y,0,6),'Epifania'],
   [new Date(easter(y).getTime()+864e5),'Lunedì dell\'Angelo'],[Date.UTC(y,3,25),'Liberazione 解放日'],
   [Date.UTC(y,4,1),'Festa del Lavoro'],[Date.UTC(y,5,2),'Festa della Repubblica 共和国日'],
   [Date.UTC(y,7,15),'Ferragosto'],[Date.UTC(y,10,1),'Ognissanti'],[Date.UTC(y,11,25),'Natale'],[Date.UTC(y,11,26),'S. Stefano']]},
 ES:{name:'西班牙',list:y=>[[Date.UTC(y,0,1),'Año Nuevo'],[Date.UTC(y,0,6),'Reyes 三王节'],
   [new Date(easter(y).getTime()-2*864e5),'Viernes Santo'],[Date.UTC(y,4,1),'Día del Trabajo'],
   [Date.UTC(y,7,15),'Asunción'],[Date.UTC(y,9,12),'Fiesta Nacional 国庆'],[Date.UTC(y,10,1),'Todos los Santos'],
   [Date.UTC(y,11,6),'Constitución'],[Date.UTC(y,11,25),'Navidad']]},
 NL:{name:'荷兰',list:y=>[[Date.UTC(y,0,1),'Nieuwjaarsdag'],[new Date(easter(y).getTime()-2*864e5),'Goede Vrijdag'],
   [new Date(easter(y).getTime()+864e5),'Tweede Paasdag'],[Date.UTC(y,3,27),'Koningsdag 国王日'],
   [Date.UTC(y,4,5),'Bevrijdingsdag'],[new Date(easter(y).getTime()+39*864e5),'Hemelvaartsdag'],
   [Date.UTC(y,11,25),'Eerste Kerstdag'],[Date.UTC(y,11,26),'Tweede Kerstdag']]},
 RU:{name:'俄罗斯',list:y=>[[Date.UTC(y,0,1),'Новый год 新年'],[Date.UTC(y,0,7),'Рождество 东正教圣诞'],
   [Date.UTC(y,1,23),'День защитника Отечества'],[Date.UTC(y,2,8),'Международный женский день 妇女节'],
   [Date.UTC(y,4,1),'Праздник Весны и Труда'],[Date.UTC(y,4,9),'День Победы 胜利日'],
   [Date.UTC(y,5,12),'День России 俄罗斯日'],[Date.UTC(y,10,4),'День народного единства']]},
 IN:{name:'印度',list:y=>[[Date.UTC(y,0,1),'New Year'],[Date.UTC(y,0,26),'Republic Day 共和国日'],
   [Date.UTC(y,7,15),'Independence Day 独立日'],[Date.UTC(y,9,2),'Gandhi Jayanti 甘地诞辰'],
   [Date.UTC(y,11,25),'Christmas']]},
 TH:{name:'泰国',list:y=>[[Date.UTC(y,0,1),'วันปีใหม่ 元旦'],[Date.UTC(y,3,6),'วันจักรี 却克里王朝纪念日'],
   [Date.UTC(y,3,13),'สงกรานต์ 泼水节'],[Date.UTC(y,3,14),'สงกรานต์ 泼水节'],[Date.UTC(y,3,15),'สงกรานต์ 泼水节'],
   [Date.UTC(y,4,4),'วันฉัตรมงคล 加冕日'],[Date.UTC(y,6,28),'วันเฉลิมฯ ร.10 国王诞辰'],
   [Date.UTC(y,7,12),'วันแม่ 母亲节'],[Date.UTC(y,9,13),'วันนวมินทรมหาราช'],[Date.UTC(y,11,5),'วันพ่อ 父亲节'],
   [Date.UTC(y,11,10),'วันรัฐธรรมนูญ 宪法日'],[Date.UTC(y,11,31),'วันสิ้นปี 除夕']]},
 BR:{name:'巴西',list:y=>[[Date.UTC(y,0,1),'Confraternização'],[new Date(easter(y).getTime()-47*864e5),'Carnaval 狂欢节'],
   [new Date(easter(y).getTime()-2*864e5),'Sexta-feira Santa'],[Date.UTC(y,3,21),'Tiradentes'],
   [Date.UTC(y,4,1),'Dia do Trabalho'],[Date.UTC(y,8,7),'Independência 独立日'],
   [Date.UTC(y,9,12),'N. Sra. Aparecida'],[Date.UTC(y,10,2),'Finados'],[Date.UTC(y,10,15),'Proclamação da República'],
   [Date.UTC(y,11,25),'Natal']]},
 MX:{name:'墨西哥',list:y=>[[Date.UTC(y,0,1),'Año Nuevo'],[nthWd(y,2,1,1),'Día de la Constitución'],
   [nthWd(y,3,1,3),'Natalicio de Benito Juárez'],[Date.UTC(y,4,1),'Día del Trabajo'],
   [Date.UTC(y,8,16),'Independencia 独立日'],[Date.UTC(y,10,2),'Día de Muertos 亡灵节'],
   [nthWd(y,11,1,3),'Revolución'],[Date.UTC(y,11,25),'Navidad']]},
 AE:{name:'阿联酋',list:y=>[[Date.UTC(y,0,1),'New Year'],[Date.UTC(y,10,30),'Commemoration Day'],
   [Date.UTC(y,11,2),'National Day 国庆'],[Date.UTC(y,11,3),'National Day 国庆']]},
 NZ:{name:'新西兰',list:y=>[[Date.UTC(y,0,1),'New Year\'s Day'],[Date.UTC(y,1,6),'Waitangi Day'],
   [new Date(easter(y).getTime()-2*864e5),'Good Friday'],[new Date(easter(y).getTime()+864e5),'Easter Monday'],
   [Date.UTC(y,3,25),'ANZAC Day'],[nthWd(y,6,1,1),'King\'s Birthday'],[nthWd(y,10,1,4),'Labour Day'],
   [Date.UTC(y,11,25),'Christmas'],[Date.UTC(y,11,26),'Boxing Day']]},
 CH:{name:'瑞士',list:y=>[[Date.UTC(y,0,1),'Neujahr'],[new Date(easter(y).getTime()-2*864e5),'Karfreitag'],
   [new Date(easter(y).getTime()+864e5),'Ostermontag'],[new Date(easter(y).getTime()+39*864e5),'Auffahrt'],
   [Date.UTC(y,7,1),'Bundesfeier 国庆日'],[Date.UTC(y,11,25),'Weihnachten']]},
 SE:{name:'瑞典',list:y=>[[Date.UTC(y,0,1),'Nyårsdagen'],[Date.UTC(y,0,6),'Trettondedag jul'],
   [new Date(easter(y).getTime()-2*864e5),'Långfredagen'],[Date.UTC(y,4,1),'Första maj'],
   [Date.UTC(y,5,6),'Nationaldagen 国庆'],[wdInRange(y,6,19,5),'Midsommarafton 仲夏节'],
   [Date.UTC(y,11,24),'Julafton'],[Date.UTC(y,11,25),'Juldagen']]},
 MY:{name:'马来西亚',list:y=>{ const s=findLunar(y,1,1);
   const r=[[Date.UTC(y,0,1),'New Year'],[Date.UTC(y,4,1),'Labour Day'],[Date.UTC(y,7,31),'Merdeka 独立日'],
   [Date.UTC(y,8,16),'Malaysia Day'],[Date.UTC(y,11,25),'Christmas']];
   if(s){r.push([s.getTime(),'农历新年']);r.push([s.getTime()+864e5,'农历新年次日']);} return r;}},
 ID:{name:'印度尼西亚',list:y=>[[Date.UTC(y,0,1),'Tahun Baru'],[Date.UTC(y,7,17),'Hari Kemerdekaan 独立日'],
   [Date.UTC(y,11,25),'Natal']]},
 PH:{name:'菲律宾',list:y=>[[Date.UTC(y,0,1),'New Year'],[new Date(easter(y).getTime()-3*864e5),'Maundy Thursday'],
   [new Date(easter(y).getTime()-2*864e5),'Good Friday'],[Date.UTC(y,3,9),'Araw ng Kagitingan'],
   [Date.UTC(y,4,1),'Labor Day'],[Date.UTC(y,5,12),'Independence Day 独立日'],
   [nthWd(y,8,1,-1),'National Heroes Day'],[Date.UTC(y,10,30),'Bonifacio Day'],
   [Date.UTC(y,11,25),'Christmas'],[Date.UTC(y,11,30),'Rizal Day']]},
 VN:{name:'越南',list:y=>{ const s=findLunar(y,1,1), hv=findLunar(y,3,10);
   const r=[[Date.UTC(y,0,1),'Tết Dương lịch 元旦'],[Date.UTC(y,3,30),'Ngày Giải phóng 解放日'],
   [Date.UTC(y,4,1),'Quốc tế Lao động'],[Date.UTC(y,8,2),'Quốc khánh 国庆']];
   if(s){for(let i=-1;i<=3;i++) r.push([s.getTime()+i*864e5,'Tết Nguyên Đán 春节']);}
   if(hv) r.push([hv.getTime(),'Giỗ Tổ Hùng Vương']); return r;}},
 ZA:{name:'南非',list:y=>[[Date.UTC(y,0,1),'New Year\'s Day'],[Date.UTC(y,2,21),'Human Rights Day'],
   [new Date(easter(y).getTime()-2*864e5),'Good Friday'],[new Date(easter(y).getTime()+864e5),'Family Day'],
   [Date.UTC(y,3,27),'Freedom Day 自由日'],[Date.UTC(y,4,1),'Workers\' Day'],[Date.UTC(y,5,16),'Youth Day'],
   [Date.UTC(y,7,9),'Women\'s Day'],[Date.UTC(y,8,24),'Heritage Day'],[Date.UTC(y,11,16),'Day of Reconciliation'],
   [Date.UTC(y,11,25),'Christmas'],[Date.UTC(y,11,26),'Day of Goodwill']]}
};
/* 通用兜底 */
const GENERIC = y=>[[Date.UTC(y,0,1),'New Year\'s Day 元旦'],[Date.UTC(y,4,1),'International Workers\' Day 劳动节'],
  [easter(y),'Easter 复活节'],[Date.UTC(y,11,25),'Christmas 圣诞节'],[Date.UTC(y,11,31),'New Year\'s Eve 跨年夜']];

/* 返回 {'YYYY-MM-DD':[名称,...]} */
const _ctryCache={};
function countryHolidays(cc, y){
  const ck=cc+y; if(_ctryCache[ck]) return _ctryCache[ck];
  const rule = COUNTRY_RULES[cc];
  const raw = rule ? rule.list(y) : GENERIC(y);
  const map={};
  raw.forEach(([t,n])=>{ if(t==null) return;
    const d = (t instanceof Date)? t : new Date(t);
    if(isNaN(d)) return;
    const k = key(d.getUTCFullYear(), d.getUTCMonth()+1, d.getUTCDate());
    (map[k]=map[k]||[]).push(n);
  });
  return (_ctryCache[ck]=map);
}
function countryName(cc, fallback){ return COUNTRY_RULES[cc] ? COUNTRY_RULES[cc].name : (fallback||cc); }

/* ---- 汇总某一天的全部信息 ---- */
/* 各国哪些是「真·法定公休」——只有这些才打「休」标，
   万圣夜、母亲节、圣帕特里克节这类纪念日不算 */
const PUBLIC_HOLIDAY = {
 US:['New Year','Martin Luther','Presidents','Memorial','Juneteenth','Independence','Labor Day','Columbus','Veterans','Thanksgiving','Christmas'],
 JP:['元日','成人','建国','天皇','春分','昭和','憲法','みどり','こども','海の日','山の日','敬老','秋分','スポーツ','文化','勤労'],
 GB:['New Year','Good Friday','Easter Monday','Bank Holiday','Christmas','Boxing'],
 CA:['New Year','Good Friday','Victoria','Canada Day','Labour','Truth','Thanksgiving','Remembrance','Christmas','Boxing'],
 AU:['New Year','Australia Day','Good Friday','Easter Monday','ANZAC','Birthday','Christmas','Boxing'],
 NZ:['New Year','Waitangi','Good Friday','Easter Monday','ANZAC','Birthday','Labour','Christmas','Boxing'],
 SE:['Nyårsdagen','Trettondedag','Långfredagen','Första maj','Nationaldagen','Midsommar','Julafton','Juldagen'],
 CH:['Neujahr','Karfreitag','Ostermontag','Auffahrt','Bundesfeier','Weihnachten'],
 MX:['Año Nuevo','Constitución','Benito Juárez','Trabajo','Independencia','Revolución','Navidad'],
 PH:['New Year','Maundy','Good Friday','Kagitingan','Labor','Independence','Heroes','Bonifacio','Christmas','Rizal'],
 IN:['Republic Day','Independence','Gandhi','Christmas'],
 ZA:['New Year','Human Rights','Good Friday','Family Day','Freedom','Workers','Youth','Women','Heritage','Reconciliation','Christmas','Goodwill']
};
/* 未列出的国家：默认全部视为公休（这些国家的规则表里本来就只放了法定假日） */
function isPublicHoliday(cc, name){
  const wl = PUBLIC_HOLIDAY[cc];
  if(!wl) return true;
  return wl.some(k => name.includes(k));
}

function dayInfo(y,m,d, cc){
  const k = key(y,m,d), mk = `${pad(m)}-${pad(d)}`;
  const lunar = solarToLunar(y,m,d);
  const out = {key:k, lunar, festivals:[], terms:lunar&&lunar.term?[lunar.term]:[], intl:[], off:null, official:false};
  if(!lunar) return out;   /* 越界日期：只返回空壳，调用方需判空 */
  const isCN = (cc==='CN');

  if(isCN){
    const H = cnHolidayMap(y);
    if(H.R[mk]) { out.off='rest'; out.offName=H.R[mk]; out.official=!H.est; }
    else if(H.W.includes(mk)) { out.off='work'; out.offName='调休上班'; out.official=true; }
    if(CN_SOLAR_FES[mk]) out.festivals.push(CN_SOLAR_FES[mk]);
    if(lunar){
      CN_LUNAR_FES.forEach(([lm,ld,n])=>{ if(!lunar.isLeap && lunar.lMonth===lm && lunar.lDay===ld) out.festivals.push(n); });
      const cx = chuxi(y);
      if(cx && cx.getUTCFullYear()===y && cx.getUTCMonth()+1===m && cx.getUTCDate()===d) out.festivals.push('除夕');
    }
    // 母亲节/父亲节/感恩节（中国也常过）
    const dt=new Date(Date.UTC(y,m-1,d));
    if(m===5 && dt.getTime()===nthWd(y,5,0,2).getTime()) out.festivals.push('母亲节');
    if(m===6 && dt.getTime()===nthWd(y,6,0,3).getTime()) out.festivals.push('父亲节');
    if(m===11&& dt.getTime()===nthWd(y,11,4,4).getTime()) out.festivals.push('感恩节');
  } else {
    const H = countryHolidays(cc, y);
    if(H[k]){
      out.intl = H[k].slice();
      const pub = H[k].find(n => isPublicHoliday(cc, n));
      if(pub){ out.off='rest'; out.offName=pub; }   /* 纪念日不打「休」标 */
    }
    if(lunar){ CN_LUNAR_FES.forEach(([lm,ld,n])=>{ if(!lunar.isLeap && lunar.lMonth===lm && lunar.lDay===ld) out.festivals.push(n); }); }
  }
  return out;
}
