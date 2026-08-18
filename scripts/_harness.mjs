/* 测试脚手架：把 src/js/*.js 拼起来，在一个最小 DOM 桩里跑。
   项目没有模块系统（所有函数是全局的），所以测试也用同样的方式加载，
   保证测的就是浏览器里真正执行的那份代码。 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** 扫出所有顶层声明的名字。
    vm.runInContext 里 const/let/class 只进词法作用域，不会挂到 context 上，
    只有 function 和 var 会。所以要显式把它们导出来测试才能取到。 */
export function topLevelNames(src) {
  const names = new Set();
  const re = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  /* 解构声明：const {a, b} = ... / const [a, b] = ... */
  const re2 = /^(?:const|let|var)\s*[{[]([^}\]]+)[}\]]\s*=/gm;
  while ((m = re2.exec(src))) {
    m[1].split(',').forEach(p => {
      const n = p.split(':').pop().split('=')[0].trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(n)) names.add(n);
    });
  }
  return [...names];
}

/** 拼接所有源码，截掉「启动」段（那段有顶层 await 且会发网络请求） */
export function bundleSource({ withIcons = false, keepBoot = false } = {}) {
  const dir = join(ROOT, 'src', 'js');
  const files = readdirSync(dir).filter(f => f.endsWith('.js')).sort();
  let src = files.map(f => `/* ===== ${f} ===== */\n` +
                            readFileSync(join(dir, f), 'utf8')).join('\n');
  if (withIcons) src = src.replace('/*@ICONS@*/ false', '/*@ICONS@*/ true');
  if (!keepBoot) {
    const i = src.indexOf('/* ===================== 启动 ===================== */');
    if (i > 0) src = src.slice(0, i);
  }
  /* 把顶层声明挂到 globalThis，测试才取得到 */
  const names = topLevelNames(src);
  const footer = '\n\n/* --- 测试用导出（由 _harness 自动生成） --- */\n' +
    'Object.assign(globalThis, {\n' +
    names.map(n => `  get ${n}(){ try{ return ${n}; }catch(e){ return undefined; } }`).join(',\n') +
    '\n});\n';
  return { src: src + footer, files, names };
}

/** 最小 DOM 桩。够跑渲染函数，不模拟布局。 */
export function makeDom() {
  const store = {};
  const attrs = {};
  const cache = {};
  const el = id => ({
    id, _html: '', _txt: '', value: '', checked: false,
    dataset: {}, style: {}, tabIndex: 0, scrollTop: 0, clientHeight: 170,
    set innerHTML(v) { this._html = v; store[id] = v; },
    get innerHTML() { return this._html; },
    set textContent(v) { this._txt = v; store[id + ':txt'] = v; },
    get textContent() { return this._txt; },
    set placeholder(v) {}, set title(v) {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    querySelector() { return el(id + '>x'); },
    querySelectorAll() { return []; },
    addEventListener(){}, removeEventListener(){}, appendChild(){},
    closest() { return null; }, scrollIntoView(){}, scrollTo(){}, focus(){},
    set onclick(f){}, set onchange(f){}, set oninput(f){}, set onkeydown(f){}
  });
  return {
    store, attrs,
    globals: {
      document: {
        querySelector: s => cache[s] || (cache[s] = el(s)),
        querySelectorAll: () => [],
        addEventListener() {},
        documentElement: {
          setAttribute(k, v) { attrs[k] = v; },
          removeAttribute(k) { delete attrs[k]; },
          lang: ''
        },
        title: ''
      },
      getComputedStyle: () => ({ getPropertyValue: () => '' }),
      localStorage: {
        _d: {},
        getItem(k) { return this._d[k] ?? null; },
        setItem(k, v) { this._d[k] = v; },
        removeItem(k) { delete this._d[k]; }
      },
      window: { addEventListener() {} },
      navigator: {},
      location: { protocol: 'file:' }
    }
  };
}

/** 在沙箱里加载源码，返回可直接取全局函数的 context */
export function loadApp(opts = {}) {
  const { src } = bundleSource(opts);
  const dom = makeDom();
  const ctx = vm.createContext({
    console, fetch, setTimeout, clearTimeout, setInterval, clearInterval,
    Intl, Date, Math, JSON, performance, AbortController, TextEncoder, TextDecoder,
    ...dom.globals
  });
  vm.runInContext(src, ctx, { filename: 'meridian-bundle.js' });
  return { ctx, store: dom.store, attrs: dom.attrs };
}

/* ---- 极简断言 ---- */
export function createRunner(title) {
  let pass = 0, fail = 0;
  const fails = [];
  console.log(`\n\x1b[1m${title}\x1b[0m`);
  return {
    section(name) { console.log(`\n  ${name}`); },
    ok(name, cond, detail = '') {
      if (cond) { pass++; console.log(`    \x1b[32m✓\x1b[0m ${name}${detail ? '  ' + detail : ''}`); }
      else { fail++; fails.push(name); console.log(`    \x1b[31m✗\x1b[0m ${name}${detail ? '  ' + detail : ''}`); }
    },
    eq(name, got, want) {
      const c = JSON.stringify(got) === JSON.stringify(want);
      this.ok(name, c, c ? String(got) : `期望 ${JSON.stringify(want)}，实际 ${JSON.stringify(got)}`);
    },
    info(s) { console.log(`      \x1b[90m${s}\x1b[0m`); },
    done() {
      console.log(`\n  ${fail ? '\x1b[31m' : '\x1b[32m'}${pass} 通过, ${fail} 失败\x1b[0m`);
      if (fail) { console.log('  失败项: ' + fails.join(', ')); }
      return fail;
    }
  };
}
