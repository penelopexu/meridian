/* ===== 离线城市库：144 座主要城市 =====
   字段：geonamesId | 中文名 | 英文名 | 国家码 | 纬度 | 经度 | IANA时区 | 人口
   用途：1) 断网时本地搜索兜底  2) 小地名就近城市匹配 */
const CITY_RAW = `1816670|北京|Beijing|CN|39.9075|116.3972|Asia/Shanghai|18960744
1796236|上海|Shanghai|CN|31.2222|121.4581|Asia/Shanghai|24874500
1809858|广州|Guangzhou|CN|23.1167|113.25|Asia/Shanghai|16096724
1795565|深圳|Shenzhen|CN|22.5455|114.0683|Asia/Shanghai|17494398
1815286|成都|Chengdu|CN|30.6667|104.0667|Asia/Shanghai|13568357
1808926|杭州|Hangzhou|CN|30.2936|120.1614|Asia/Shanghai|9236032
1814906|重庆|Chongqing|CN|29.5603|106.5577|Asia/Shanghai|7457599
1791247|武汉|Wuhan|CN|30.5833|114.2667|Asia/Shanghai|10392693
1790630|西安|Xi'an|CN|34.2583|108.9286|Asia/Shanghai|9600000
1886760|苏州|Suzhou|CN|31.3041|120.5954|Asia/Shanghai|6715559
1792947|天津|Tianjin|CN|39.1422|117.1767|Asia/Shanghai|11090314
1799962|南京|Nanjing|CN|32.0617|118.7778|Asia/Shanghai|9314685
1815577|长沙|Changsha|CN|28.1987|112.9709|Asia/Shanghai|3093980
1784658|郑州|Zhengzhou|CN|34.7578|113.6486|Asia/Shanghai|4253913
1797929|青岛|Qingdao|CN|36.0649|120.3804|Asia/Shanghai|7172451
2034937|沈阳|Shenyang|CN|41.7922|123.4328|Asia/Shanghai|7050000
1799397|宁波|Ningbo|CN|29.8782|121.5494|Asia/Shanghai|3731203
1804651|昆明|Kunming|CN|25.0389|102.7183|Asia/Shanghai|3855346
1790923|无锡|Wuxi|CN|31.5689|120.2886|Asia/Shanghai|4396835
1808722|合肥|Hefei|CN|31.8639|117.2808|Asia/Shanghai|5050000
1814087|大连|Dalian|CN|38.9122|121.6022|Asia/Shanghai|4913879
1810821|福州|Fuzhou|CN|26.0614|119.3061|Asia/Shanghai|3740000
1790645|厦门|Xiamen|CN|24.4798|118.0819|Asia/Shanghai|4617251
2037013|哈尔滨|Harbin|CN|45.75|126.65|Asia/Shanghai|5242897
1805753|济南|Jinan|CN|36.6683|116.9972|Asia/Shanghai|4335989
1791388|温州|Wenzhou|CN|27.9994|120.6668|Asia/Shanghai|2650000
1795270|石家庄|Shijiazhuang|CN|38.0414|114.4786|Asia/Shanghai|3938513
1799869|南宁|Nanning|CN|22.8167|108.3167|Asia/Shanghai|3839800
1809461|贵阳|Guiyang|CN|26.5833|106.7167|Asia/Shanghai|3037159
1793511|太原|Taiyuan|CN|37.8694|112.5603|Asia/Shanghai|4303673
1800163|南昌|Nanchang|CN|28.684|115.8531|Asia/Shanghai|2357839
10630003|徐州|Xuzhou|CN|34.2044|117.2839|Asia/Shanghai|1253991
1529102|乌鲁木齐|Urumqi|CN|43.801|87.6005|Asia/Urumqi|3029372
1804430|兰州|Lanzhou|CN|36.057|103.8399|Asia/Shanghai|3000000
1809078|海口|Haikou|CN|20.0342|110.3465|Asia/Shanghai|2873358
1796556|三亚|Sanya|CN|18.2543|109.5095|Asia/Shanghai|1031396
1280737|拉萨|Lhasa|CN|29.65|91.1|Asia/Shanghai|118721
2036892|呼和浩特|Hohhot|CN|40.8106|111.6522|Asia/Shanghai|2350000
1786657|银川|Yinchuan|CN|38.4681|106.2731|Asia/Shanghai|1487579
1788852|西宁|Xining|CN|36.6255|101.7574|Asia/Shanghai|1677177
1819729|香港|Hong Kong|HK|22.2783|114.1747|Asia/Hong_Kong|7396076
1821274|澳门|Macau|MO|22.2006|113.5461|Asia/Macau|649335
1668341|台北|Taipei|TW|25.0531|121.5264|Asia/Taipei|7871900
1673820|高雄|Kaohsiung|TW|22.6163|120.3133|Asia/Taipei|2737660
1850147|东京|Tokyo|JP|35.6895|139.6917|Asia/Tokyo|9733276
1853909|大阪|Osaka|JP|34.6938|135.5011|Asia/Tokyo|2753862
1857910|京都|Kyoto|JP|35.0211|135.7538|Asia/Tokyo|1463723
2128295|札幌|Sapporo|JP|43.0667|141.35|Asia/Tokyo|1973832
1835848|首尔|Seoul|KR|37.566|126.9784|Asia/Seoul|10349312
1838524|釜山|Busan|KR|35.1017|129.03|Asia/Seoul|3285147
1880252|新加坡|Singapore|SG|1.2897|103.8501|Asia/Singapore|5638700
1609350|曼谷|Bangkok|TH|13.754|100.5014|Asia/Bangkok|5104476
1153671|清迈|Chiang Mai|TH|18.7904|98.9847|Asia/Bangkok|127240
1735161|吉隆坡|Kuala Lumpur|MY|3.1412|101.6865|Asia/Kuala_Lumpur|1453975
1642911|雅加达|Jakarta|ID|-6.2146|106.8451|Asia/Jakarta|8540121
1701668|马尼拉|Manila|PH|14.6042|120.9822|Asia/Manila|1600000
1581130|河内|Hanoi|VN|21.0245|105.8412|Asia/Bangkok|8053663
1566083|胡志明市|Ho Chi Minh City|VN|10.823|106.6296|Asia/Ho_Chi_Minh|14002598
1821306|金边|Phnom Penh|KH|11.5625|104.916|Asia/Phnom_Penh|1573544
1298824|仰光|Yangon|MM|16.8053|96.1561|Asia/Yangon|4477638
1261481|新德里|New Delhi|IN|28.6214|77.2148|Asia/Kolkata|317797
1275339|孟买|Mumbai|IN|19.0728|72.8826|Asia/Kolkata|12691836
1277333|班加罗尔|Bengaluru|IN|12.9719|77.5937|Asia/Kolkata|8495492
1275004|加尔各答|Kolkata|IN|22.5626|88.363|Asia/Kolkata|4631392
1185241|达卡|Dhaka|BD|23.7104|90.4074|Asia/Dhaka|10356500
1174872|卡拉奇|Karachi|PK|24.8608|67.0104|Asia/Karachi|11624219
1248991|科伦坡|Colombo|LK|6.9355|79.8487|Asia/Colombo|648034
1283240|加德满都|Kathmandu|NP|27.7017|85.3206|Asia/Kathmandu|1442271
2028462|乌兰巴托|Ulaanbaatar|MN|47.9077|106.8832|Asia/Ulaanbaatar|844818
292223|迪拜|Dubai|AE|25.0772|55.3093|Asia/Dubai|3790000
292968|阿布扎比|Abu Dhabi|AE|24.4512|54.397|Asia/Dubai|1807000
290030|多哈|Doha|QA|25.2855|51.531|Asia/Qatar|344939
108410|利雅得|Riyadh|SA|24.6877|46.7219|Asia/Riyadh|4205961
293397|特拉维夫|Tel Aviv|IL|32.0809|34.7806|Asia/Jerusalem|432892
745044|伊斯坦布尔|Istanbul|TR|41.0138|28.9497|Europe/Istanbul|15701602
112931|德黑兰|Tehran|IR|35.6944|51.4215|Asia/Tehran|7153309
524901|莫斯科|Moscow|RU|55.752|37.6178|Europe/Moscow|10381222
498817|圣彼得堡|Saint Petersburg|RU|59.9386|30.3141|Europe/Moscow|5351935
2643743|伦敦|London|GB|51.5085|-0.1257|Europe/London|8961989
2643123|曼彻斯特|Manchester|GB|53.4809|-2.2374|Europe/London|568996
2650225|爱丁堡|Edinburgh|GB|55.9521|-3.1965|Europe/London|514990
2964574|都柏林|Dublin|IE|53.3331|-6.2489|Europe/Dublin|1024027
2988507|巴黎|Paris|FR|48.8534|2.3488|Europe/Paris|2138551
2990440|尼斯|Nice|FR|43.7031|7.2661|Europe/Paris|342669
2950159|柏林|Berlin|DE|52.5244|13.4105|Europe/Berlin|3426354
2867714|慕尼黑|Munich|DE|48.1374|11.5755|Europe/Berlin|1260391
2925533|法兰克福|Frankfurt|DE|50.1155|8.6842|Europe/Berlin|650000
2911298|汉堡|Hamburg|DE|53.5507|9.993|Europe/Berlin|1845229
2759794|阿姆斯特丹|Amsterdam|NL|52.374|4.8897|Europe/Amsterdam|741636
2800866|布鲁塞尔|Brussels|BE|50.8505|4.3488|Europe/Brussels|1019022
2657896|苏黎世|Zurich|CH|47.3667|8.55|Europe/Zurich|415367
2660646|日内瓦|Geneva|CH|46.2022|6.1457|Europe/Zurich|201741
2761369|维也纳|Vienna|AT|48.2085|16.3721|Europe/Vienna|1691468
3067696|布拉格|Prague|CZ|50.088|14.4208|Europe/Prague|1165581
756135|华沙|Warsaw|PL|52.2298|21.0118|Europe/Warsaw|1702139
3054643|布达佩斯|Budapest|HU|47.4984|19.0404|Europe/Budapest|1741041
3169070|罗马|Rome|IT|41.8919|12.5113|Europe/Rome|2318895
3173435|米兰|Milan|IT|45.4643|9.1895|Europe/Rome|1371498
3164603|威尼斯|Venice|IT|45.4371|12.3326|Europe/Rome|51298
3117735|马德里|Madrid|ES|40.4165|-3.7026|Europe/Madrid|3255944
3128760|巴塞罗那|Barcelona|ES|41.3888|2.159|Europe/Madrid|1686208
2267057|里斯本|Lisbon|PT|38.7251|-9.1498|Europe/Lisbon|517802
264371|雅典|Athens|GR|37.9838|23.7278|Europe/Athens|664046
2673730|斯德哥尔摩|Stockholm|SE|59.3294|18.0687|Europe/Stockholm|1515017
3143244|奥斯陆|Oslo|NO|59.9127|10.7461|Europe/Oslo|1082575
2618425|哥本哈根|Copenhagen|DK|55.6759|12.5655|Europe/Copenhagen|1153615
658225|赫尔辛基|Helsinki|FI|60.1695|24.9354|Europe/Helsinki|658864
3413829|雷克雅未克|Reykjavik|IS|64.1355|-21.8954|Atlantic/Reykjavik|118918
5128581|纽约|New York|US|40.7143|-74.006|America/New_York|8804190
5368361|洛杉矶|Los Angeles|US|34.0522|-118.2437|America/Los_Angeles|3820914
5391959|旧金山|San Francisco|US|37.7749|-122.4194|America/Los_Angeles|827526
5809844|西雅图|Seattle|US|47.6062|-122.3321|America/Los_Angeles|780995
4887398|芝加哥|Chicago|US|41.85|-87.65|America/Chicago|2664452
4930956|波士顿|Boston|US|42.3584|-71.0598|America/New_York|653833
4140963|华盛顿|Washington|US|38.8951|-77.0364|America/New_York|689545
4164138|迈阿密|Miami|US|25.7743|-80.1937|America/New_York|487014
5506956|拉斯维加斯|Las Vegas|US|36.175|-115.1372|America/Los_Angeles|641903
4699066|休斯顿|Houston|US|29.7633|-95.3633|America/Chicago|2314157
5419384|丹佛|Denver|US|39.7392|-104.9847|America/Denver|729019
5856195|火奴鲁鲁|Honolulu|US|21.3069|-157.8583|Pacific/Honolulu|350964
6167865|多伦多|Toronto|CA|43.7064|-79.3986|America/Toronto|2794356
6173336|温哥华|Vancouver|CA|49.6506|-125.4494|America/Vancouver|748937
6077243|蒙特利尔|Montreal|CA|45.5088|-73.5878|America/Toronto|1762949
5913490|卡尔加里|Calgary|CA|51.0501|-114.0853|America/Edmonton|1306784
3530597|墨西哥城|Mexico City|MX|19.4285|-99.1277|America/Mexico_City|12294193
3531673|坎昆|Cancun|MX|21.1743|-86.8466|America/Cancun|888797
3448439|圣保罗|Sao Paulo|BR|-23.5475|-46.6361|America/Sao_Paulo|12400232
3451190|里约热内卢|Rio de Janeiro|BR|-22.9064|-43.1822|America/Sao_Paulo|6747815
3435910|布宜诺斯艾利斯|Buenos Aires|AR|-34.6131|-58.3772|America/Argentina/Buenos_Aires|2891082
3871336|圣地亚哥|Santiago|CL|-33.4569|-70.6483|America/Santiago|4837295
3936456|利马|Lima|PE|-12.0432|-77.0282|America/Lima|7737002
3688689|波哥大|Bogota|CO|4.6097|-74.0817|America/Bogota|7674366
2147714|悉尼|Sydney|AU|-33.8678|151.2073|Australia/Sydney|5557233
2158177|墨尔本|Melbourne|AU|-37.814|144.9633|Australia/Melbourne|5350705
2174003|布里斯班|Brisbane|AU|-27.4679|153.0281|Australia/Brisbane|2780063
2063523|珀斯|Perth|AU|-31.9522|115.8614|Australia/Perth|2309338
2193733|奥克兰|Auckland|NZ|-36.8485|174.7635|Pacific/Auckland|1547200
2179537|惠灵顿|Wellington|NZ|-41.2866|174.7756|Pacific/Auckland|381900
360630|开罗|Cairo|EG|30.0626|31.2497|Africa/Cairo|9606916
184745|内罗毕|Nairobi|KE|-1.2833|36.8167|Africa/Nairobi|4397073
993800|约翰内斯堡|Johannesburg|ZA|-26.2023|28.0436|Africa/Johannesburg|9418183
3369157|开普敦|Cape Town|ZA|-33.9258|18.4232|Africa/Johannesburg|4772846
2332459|拉各斯|Lagos|NG|6.4541|3.3947|Africa/Lagos|15388000
2553604|卡萨布兰卡|Casablanca|MA|33.5883|-7.6114|Africa/Casablanca|3665954`;
const CITIES = CITY_RAW.trim().split('\n').map(l=>{
  const [id,zh,en,cc,lat,lon,tz,pop]=l.split('|');
  return {id:+id,name:zh,en,cc,lat:+lat,lon:+lon,tz,pop:+pop,offline:true};
});
/* geonames id → 内置条目，用于给在线结果补中文名 */
const CITY_BY_ID = (()=>{ const m={}; CITIES.forEach(c=>m[c.id]=c); return m; })();
/* 中文名 → 英文名，用于把中文查询翻译成英文再查（Open-Meteo 中文索引不全） */
const CITY_ZH2EN = (()=>{ const m={}; CITIES.forEach(c=>{ if(c.name&&c.en) m[c.name]=c.en; }); return m; })();

/* 球面距离（公里） */
function haversine(lat1,lon1,lat2,lon2){
  const R=6371,p=Math.PI/180;
  const a=Math.sin((lat2-lat1)*p/2)**2+Math.cos(lat1*p)*Math.cos(lat2*p)*Math.sin((lon2-lon1)*p/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}
/* 找最近的已知城市 */
function nearestCity(lat,lon,maxKm=Infinity){
  let best=null,bd=Infinity;
  for(const c of CITIES){ const d=haversine(lat,lon,c.lat,c.lon); if(d<bd){bd=d;best=c;} }
  return (best && bd<=maxKm) ? {city:best,km:bd} : null;
}
/* 本地模糊搜索（断网兜底） */
function searchOffline(q){
  const s=q.trim().toLowerCase(); if(!s) return [];
  return CITIES
    .map(c=>{
      const zh=c.name, en=c.en.toLowerCase();
      let score=-1;
      if(zh===s||en===s) score=100;
      else if(zh.startsWith(s)||en.startsWith(s)) score=80;
      else if(zh.includes(s)||en.includes(s)) score=60;
      return score<0?null:{c,score};
    })
    .filter(Boolean)
    .sort((a,b)=>(b.score-a.score)||(b.c.pop-a.c.pop))
    .slice(0,10)
    .map(x=>({...x.c, country:'', admin1:''}));
}


/* ===== 地点名的多语言显示 =====

   收藏的地点是「加入那一刻」的快照：name 可能是中文（内置库补的），
   enName 是接口原始的英文名。早先切语言时这些标签纹丝不动，
   界面成了英文、标签还写着「倫敦」。

   国名不走快照，改用 Intl.DisplayNames 按当前语言实时生成 ——
   这样九种语言都对，不必自己维护九份国名表。          */

const _regionFmt = new Map();
function regionName(cc, lang, fallback){
  const code = String(cc || '').toUpperCase();
  if(!/^[A-Z]{2}$/.test(code)) return fallback || code;
  const key = lang + '|' + code;
  if(_regionFmt.has(key)) return _regionFmt.get(key);
  let v = fallback || code;
  try {
    const f = new Intl.DisplayNames([lang], {type:'region'});
    v = f.of(code) || v;
  } catch(e) { /* 环境不支持就退回快照里的名字 */ }
  _regionFmt.set(key, v);
  return v;
}

const hasCJKText = s => /[㐀-鿿豈-﫿]/.test(String(s || ''));

/* 城市名：中文界面优先用中文名，其余语言优先用英文原名 */
function placeName(p, lang){
  if(!p) return '';
  return String(lang || '').startsWith('zh')
    ? (p.name || p.enName || '')
    : (p.enName || p.name || '');
}
/* 国名：始终按当前语言实时生成 */
function placeCountry(p, lang){
  if(!p) return '';
  return regionName(p.cc, lang, p.country);
}
/* 省/州名。接口只按查询语言给一份，没有多语言版本。
   非中文界面下如果它是中文，就干脆不显示 —— 中英混排比少一级更难看。 */
function placeAdmin1(p, lang){
  if(!p || !p.admin1) return '';
  if(!String(lang || '').startsWith('zh') && hasCJKText(p.admin1)) return '';
  return p.admin1;
}
/* 一行完整地点：城市 · 省 · 国。
   直辖市会出现「北京 · 北京市 · 中国」这种重复，所以判重时先去掉
   「市/省/州」这类后缀再比，任一方包含另一方就只留城市名。 */
function placeFull(p, lang){
  const nm = placeName(p, lang), a1 = placeAdmin1(p, lang);
  const bare = s => String(s || '').replace(/(特别行政区|自治区|自治州|直辖市|省|市|州|区)$/,'').trim();
  const n0 = bare(nm), a0 = bare(a1);
  const dup = !a0 || !n0 || a0 === n0 || a0.includes(n0) || n0.includes(a0);
  return [nm, dup ? '' : a1, placeCountry(p, lang)].filter(Boolean).join(' · ');
}
