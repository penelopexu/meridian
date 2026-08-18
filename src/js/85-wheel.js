/* ===== 惯性滚轮选择器 wheel picker =====
   靠原生滚动拿惯性和触摸手感，再叠三层增强：
     1) scroll-snap 让停下时自动吸附到整格
     2) 鼠标滚轮连续转动时逐级加速（快速翻过几十项不用一直转）
     3) 距离中心越远越淡越小，做出转盘的视觉
   无依赖，触摸/鼠标/键盘都能用。                                    */

const WHEEL_H = 34;          // 每格高度 px
const WHEEL_PAD = 2;         // 上下各留几格空白，让首尾项也能滚到中心

function wheelPicker(el, opts){
  const items = opts.items;                     // [{v, label}]
  let value = opts.value;
  const onChange = opts.onChange || (()=>{});
  let idx = Math.max(0, items.findIndex(x=>x.v===value));
  if(idx < 0) idx = 0;

  el.classList.add('wheel');
  el.innerHTML =
    `<div class="wsel"></div><div class="wlist">`
    + Array(WHEEL_PAD).fill('<div class="wi wpad"></div>').join('')
    + items.map((x,i)=>`<div class="wi" data-i="${i}">${x.label}</div>`).join('')
    + Array(WHEEL_PAD).fill('<div class="wi wpad"></div>').join('')
    + `</div>`;
  const list = el.querySelector('.wlist');
  const cells = [...el.querySelectorAll('.wi[data-i]')];

  let settle = null, lastWheel = 0, streak = 0, programmatic = false;

  function paint(){
    const center = list.scrollTop + list.clientHeight/2;
    cells.forEach((c,i)=>{
      const cy = (i+WHEEL_PAD)*WHEEL_H + WHEEL_H/2;
      const d = Math.abs(cy-center)/WHEEL_H;                 // 距中心几格
      const near = Math.min(d,3);
      c.style.opacity = (1 - near*0.26).toFixed(2);
      c.style.transform = `scale(${(1 - near*0.075).toFixed(3)})`;
      c.classList.toggle('on', d < 0.5);
    });
  }
  function nearestIndex(){
    return Math.max(0, Math.min(items.length-1, Math.round(list.scrollTop/WHEEL_H)));
  }
  function commit(){
    const n = nearestIndex();
    if(n !== idx){ idx = n; value = items[n].v; onChange(value, n); }
  }
  function snap(smooth=true){
    programmatic = true;
    list.scrollTo({top: idx*WHEEL_H, behavior: smooth?'smooth':'auto'});
    setTimeout(()=>{ programmatic=false; paint(); }, smooth?260:0);
  }

  list.addEventListener('scroll', ()=>{
    paint();
    if(programmatic) return;
    clearTimeout(settle);
    settle = setTimeout(()=>{                                // 停稳后吸附并提交
      const n = nearestIndex();
      programmatic = true;
      list.scrollTo({top:n*WHEEL_H, behavior:'smooth'});
      setTimeout(()=>{ programmatic=false; commit(); paint(); }, 220);
    }, 90);
  }, {passive:true});

  /* 鼠标滚轮：连续转动时加速，最多一次跳 6 格 */
  list.addEventListener('wheel', e=>{
    const now = performance.now();
    streak = (now - lastWheel < 220) ? Math.min(streak+1, 18) : 0;
    lastWheel = now;
    const step = 1 + Math.floor(streak/3);                   // 1→6 格
    if(Math.abs(e.deltaY) < 4) return;
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    idx = Math.max(0, Math.min(items.length-1, nearestIndex() + dir*step));
    clearTimeout(settle);
    programmatic = true;
    list.scrollTo({top: idx*WHEEL_H, behavior:'auto'});
    programmatic = false;
    paint();
    clearTimeout(settle);
    settle = setTimeout(()=>{ commit(); }, 140);
  }, {passive:false});

  /* 点击某一项直接选中 */
  cells.forEach(c=>c.onclick=()=>{ idx=+c.dataset.i; snap(); setTimeout(commit,280); });

  /* 键盘 */
  el.tabIndex = 0;
  el.addEventListener('keydown', e=>{
    let d=0;
    if(e.key==='ArrowUp') d=-1; else if(e.key==='ArrowDown') d=1;
    else if(e.key==='PageUp') d=-5; else if(e.key==='PageDown') d=5;
    else if(e.key==='Home') d=-items.length; else if(e.key==='End') d=items.length;
    else return;
    e.preventDefault();
    idx = Math.max(0, Math.min(items.length-1, idx+d));
    snap(); setTimeout(commit,280);
  });

  snap(false); paint();

  return {
    get value(){ return value; },
    set(v){
      const n = items.findIndex(x=>x.v===v);
      if(n<0 || n===idx) return;
      idx=n; value=v; snap(false); paint();
    },
    /* 换一批选项（例如农历月份随年份变化） */
    replace(newItems, keepValue){
      opts.items = newItems;
      items.length = 0; newItems.forEach(x=>items.push(x));
      const want = keepValue!==undefined ? keepValue : value;
      el.querySelector('.wlist').innerHTML =
          Array(WHEEL_PAD).fill('<div class="wi wpad"></div>').join('')
        + items.map((x,i)=>`<div class="wi" data-i="${i}">${x.label}</div>`).join('')
        + Array(WHEEL_PAD).fill('<div class="wi wpad"></div>').join('');
      cells.length=0; el.querySelectorAll('.wi[data-i]').forEach(c=>{
        cells.push(c); c.onclick=()=>{ idx=+c.dataset.i; snap(); setTimeout(commit,280); }; });
      let n = items.findIndex(x=>x.v===want);
      if(n<0) n = Math.min(idx, items.length-1);
      idx=n; value=items[n].v; snap(false); paint();
      return value;
    }
  };
}
