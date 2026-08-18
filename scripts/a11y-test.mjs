/* 无障碍与内容安全策略检查

   这套测试守的是几件很容易在改版里被无声改掉的事：
     * 页面骨架的 landmark（banner / main / nav / contentinfo）——
       屏幕阅读器靠它们做区域跳转，删掉不会报错，但盲用户会直接迷路。
     * 只有符号没有文字的按钮（‹ › ⇄ 🎨）必须带 aria-label，
       否则朗读出来是「按钮」或者「黑桃」，完全无法理解。
     * CSP 必须出现在全部三个产物里，且 connect-src 是白名单而不是 *。
     * 阿拉伯语要能把 <html dir> 翻成 rtl。

   注意：CSP 是否真的不会误伤页面，只有浏览器能给出答案。
   这里能验证的是「策略写对了、注入到了」，不能验证「运行时不报错」。   */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadApp, createRunner } from './_harness.mjs';

const t = createRunner('无障碍与 CSP');
/* 先把 HTML 注释剥掉再扫。注释里出现 <select>、<button> 这类词是常有的事
   （解释某段代码的时候），扫进去就是假阳性。 */
const shell = readFileSync(join(ROOT, 'src', 'index.html'), 'utf8')
  .replace(/<!--[\s\S]*?-->/g, '');
const css = readFileSync(join(ROOT, 'src', 'styles.css'), 'utf8');

/* ---------- 1. 页面骨架的 landmark ---------- */
t.section('语义骨架');

t.ok('header 带 role="banner"', /<header[^>]*role="banner"/.test(shell));
t.ok('main 存在且 id=mainContent（跳转锚点）', /<main[^>]*id="mainContent"/.test(shell));
t.ok('nav 带 aria-label（页面有多个导航区时必需）', /<nav[^>]*aria-label=/.test(shell));
t.ok('footer 带 role="contentinfo"', /<footer[^>]*role="contentinfo"/.test(shell));

const skip = shell.match(/<a class="skiplink" href="(#[^"]+)"/);
t.ok('存在「跳到主要内容」链接', !!skip);
if (skip) {
  const target = skip[1].slice(1);
  t.ok(`跳转锚点 #${target} 确实存在`, new RegExp(`id="${target}"`).test(shell));
}

/* 每个 landmark 只能有一个，否则屏幕阅读器的区域列表会出现歧义 */
for (const [tag, re] of [['main', /<main[\s>]/g], ['header', /<header[\s>]/g], ['footer', /<footer[\s>]/g]]) {
  t.eq(`<${tag}> 有且只有一个`, (shell.match(re) || []).length, 1);
}

/* ---------- 2. 符号按钮的无障碍名 ---------- */
t.section('可读的控件名');

/* 抓出所有 <button>…</button>，看正文去掉标签后剩什么。
   只剩符号/表情/空白的，就必须有 aria-label 或 aria-labelledby。 */
const BUTTON = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
/* 「有文字」= 含有字母、汉字、假名、谚文或数字。纯箭头/表情不算。 */
const HAS_TEXT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Arabic}\p{Script=Hebrew}a-zA-Z0-9]/u;

let checked = 0;
const nameless = [];
for (const m of shell.matchAll(BUTTON)) {
  const [, attrs, inner] = m;
  const text = inner.replace(/<[^>]*>/g, '').trim();
  if (HAS_TEXT.test(text)) continue;             // 有可读文字，天然有名字
  checked++;
  if (!/aria-label\s*=/.test(attrs) && !/aria-labelledby\s*=/.test(attrs)) nameless.push(text || '(空)');
}
t.ok(`扫到 ${checked} 个纯符号按钮`, checked > 0);
t.eq('纯符号按钮都有无障碍名' + (nameless.length ? '：缺 ' + nameless.join(' ') : ''), nameless.length, 0);

/* <select> 没有可见 <label>，必须自带 aria-label */
for (const m of shell.matchAll(/<select\b([^>]*)>/g)) {
  const id = (m[1].match(/id="([^"]+)"/) || [])[1] || '?';
  /* 时区换算的两个下拉框有紧邻的 .k 文字标签，豁免 */
  if (id === 'tzA' || id === 'tzB') continue;
  t.ok(`<select id="${id}"> 有 aria-label`, /aria-label\s*=/.test(m[1]));
}

/* 搜索框是 combobox，ARIA 规范要求配套属性齐全 */
const q = shell.match(/<input id="q"[\s\S]*?>/);
t.ok('搜索框存在', !!q);
if (q) {
  for (const attr of ['role="combobox"', 'aria-expanded', 'aria-autocomplete', 'aria-controls', 'aria-label']) {
    t.ok(`搜索框有 ${attr}`, q[0].includes(attr));
  }
  const ctl = (q[0].match(/aria-controls="([^"]+)"/) || [])[1];
  t.ok(`aria-controls 指向的 #${ctl} 是 role="listbox"`,
       !!ctl && new RegExp(`id="${ctl}"[^>]*role="listbox"`).test(shell));
}

/* 动态区域要有 live region，否则错误和提示只是视觉上闪一下 */
t.ok('错误条是 role="alert"（打断式播报）', /id="errbar"[^>]*role="alert"/.test(shell));
t.ok('提示条是 role="status"（不打断）', /id="toast"[^>]*role="status"/.test(shell));

/* ---------- 3. 样式层的无障碍兜底 ---------- */
t.section('样式兜底');

t.ok('有 :focus-visible 焦点圈（键盘用户唯一的位置线索）', /:focus-visible/.test(css));
t.ok('响应「减少动态效果」系统设置', /prefers-reduced-motion/.test(css));
t.ok('响应「提高对比度」系统设置', /prefers-contrast/.test(css));
t.ok('skiplink 有样式（默认藏起来，聚焦时露出）', /\.skiplink/.test(css));
t.ok('声明 color-scheme（否则暗色下系统绘制的下拉框是白的）', /color-scheme\s*:/.test(css));

const rtlRules = (css.match(/html\[dir="rtl"\]/g) || []).length;
t.ok(`RTL 镜像规则 ${rtlRules} 条`, rtlRules >= 20);

/* ---------- 4. RTL 语言 ---------- */
t.section('从右往左的语言');

const { ctx: G, attrs } = loadApp();
t.ok('isRTL 可用', typeof G.isRTL === 'function');
if (typeof G.isRTL === 'function') {
  t.ok('阿拉伯语判定为 RTL', G.isRTL('ar') === true);
  for (const l of G.LOCALES || []) {
    if (l === 'ar') continue;
    t.ok(`${l} 判定为 LTR`, G.isRTL(l) === false);
  }
}
/* 每种语言都得有显示名，否则下拉框里会出现空白项 */
if (G.LANG_NAMES) {
  const langs = Object.keys(G.LANG_NAMES);
  t.ok(`语言数 ${langs.length}`, langs.length >= 9);
  t.eq('所有语言都有显示名', langs.filter(l => !String(G.LANG_NAMES[l] || '').trim()).length, 0);
  /* LOCALES 与 LANG_NAMES 必须一一对应，漏一个就是下拉框里的空白项 */
  t.eq('LOCALES 与 LANG_NAMES 数量一致', (G.LOCALES || []).length, langs.length);
}

/* 光判定函数对还不够——真正要保证的是 <html dir> 会跟着切。
   这里直接驱动切语言的入口，看沙箱里 documentElement 收到了什么。 */
if (typeof G.applyStaticText === 'function' && G.S) {
  for (const [lang, want] of [['ar', 'rtl'], ['zh-CN', 'ltr'], ['en', 'ltr']]) {
    G.S.lang = lang;
    let err = null;
    try { G.applyStaticText(); } catch (e) { err = e; }
    if (err) { t.info(`切到 ${lang} 时 applyStaticText 抛错：${err.message}`); }
    t.eq(`切到 ${lang} 后 <html dir> = ${want}`, attrs.dir, want);
  }
} else {
  t.info('applyStaticText 或 S 未导出，跳过 dir 实际翻转验证');
}

/* ---------- 5. 内容安全策略 ---------- */
t.section('内容安全策略');

const DIST = join(ROOT, 'dist');
const outputs = [
  ['单文件版', join(DIST, '天时-单文件.html')],
  ['图标版',   join(DIST, '天时-单文件-带图标.html')],
  ['PWA 版',   join(DIST, 'pwa', 'index.html')]
];

/* 应用真正会连的域名。多一个都算超发权限。 */
const ALLOWED = [
  'https://api.open-meteo.com',
  'https://geocoding-api.open-meteo.com',
  'https://air-quality-api.open-meteo.com',
  'https://archive-api.open-meteo.com',
  'https://*.qweatherapi.com',
  /* 官方预警源 */
  'https://data.weather.gov.hk',
  'https://api.weather.gov',
  'https://typhoon.nmc.cn',
  'https://www.nmc.cn',
  'https://api.brightsky.dev'
];

if (!existsSync(DIST)) {
  t.info('dist 不存在，先跑 npm run build 再测 CSP');
} else {
  for (const [name, p] of outputs) {
    if (!existsSync(p)) { t.info(`${name} 未构建，跳过`); continue; }
    const html = readFileSync(p, 'utf8');

    t.ok(`${name}：占位符已替换`, !html.includes('@CSP@'));

    const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    t.ok(`${name}：有 CSP`, !!meta);
    if (!meta) continue;
    const policy = meta[1];

    t.ok(`${name}：default-src 为 'none'（默认全禁，再逐项放开）`, /default-src\s+'none'/.test(policy));

    const connect = (policy.match(/connect-src([^;]*)/) || [])[1] || '';
    t.ok(`${name}：connect-src 不含裸通配符`, !/\*(?![.\w])/.test(connect));
    for (const origin of ALLOWED) {
      t.ok(`${name}：connect-src 含 ${origin}`, connect.includes(origin));
    }
    /* 反过来查：白名单之外不该冒出别的域名 */
    const extra = (connect.match(/https?:\/\/[^\s;]+/g) || []).filter(o => !ALLOWED.includes(o));
    t.eq(`${name}：无计划外域名` + (extra.length ? '：' + extra.join(' ') : ''), extra.length, 0);

    /* 这三条是防点击劫持和表单外发，成本为零 */
    for (const d of ["base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'"]) {
      t.ok(`${name}：${d}`, policy.includes(d));
    }

    /* 单文件版是 file:// 打开的，'self' 在那里是 opaque 源，行为各浏览器不一致 */
    if (name.includes('单文件') || name === '图标版') {
      t.ok(`${name}：资源类指令不依赖 'self'（file:// 下不可靠）`,
           !/(script|style|img|font)-src[^;]*'self'/.test(policy));
      t.ok(`${name}：允许内联脚本（单文件版全部内联）`, /script-src[^;]*'unsafe-inline'/.test(policy));
    } else {
      t.ok(`${name}：script-src 用 'self'`, /script-src[^;]*'self'/.test(policy));
      t.ok(`${name}：script-src 不开 'unsafe-inline'（脚本是外链文件，没必要开）`,
           !/script-src[^;]*'unsafe-inline'/.test(policy));
      t.ok(`${name}：worker-src 允许 Service Worker`, /worker-src[^;]*'self'/.test(policy));
      t.ok(`${name}：manifest-src 允许安装为应用`, /manifest-src[^;]*'self'/.test(policy));
    }

    /* 法务横幅（OFL 第 2 条要求每份拷贝都带版权声明） */
    t.ok(`${name}：内嵌字体许可声明`, html.includes('SIL Open Font License'));
  }
}

process.exit(t.done() ? 1 : 0);
