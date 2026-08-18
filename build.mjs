#!/usr/bin/env node
/* 构建脚本：一次产出两种形态
   dist/天时-单文件.html   —— 所有资源内联，双击即用（file:// 可用，无 Service Worker）
   dist/pwa/               —— 分离资源 + manifest + service worker，用于 GitHub Pages
   用法：node build.mjs                                                        */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const SRC  = join(root,'src');
const PUB  = join(root,'public');
const DIST = join(root,'dist');
const read = p => readFileSync(p,'utf8');

/* ---- 收集源文件 ---- */
const jsFiles = readdirSync(join(SRC,'js')).filter(f=>f.endsWith('.js')).sort();
const js      = jsFiles.map(f=>`/* ===== ${f} ===== */\n`+read(join(SRC,'js',f))).join('\n');
const css     = read(join(SRC,'fonts.css')) + '\n' + read(join(SRC,'styles.css'));
const shell   = read(join(SRC,'index.html'));


/* 产物顶部的法务横幅：OFL 第 2 条要求「每一份拷贝」都带版权声明，
   单文件版会被到处转发，所以必须内嵌，不能只靠仓库里的 NOTICE 文件。 */
const LEGAL_BANNER = `<!--
  天时 Meridian — https://github.com/penelopexu/meridian
  Source code: MIT License, Copyright (c) 2026 Estel

  This file embeds a subset of Plus Jakarta Sans:
    Copyright 2020 The Plus Jakarta Sans Project Authors
    Licensed under the SIL Open Font License 1.1 (https://scripts.sil.org/OFL)
    The font data remains under OFL and is NOT covered by the MIT license.

  Weather data: Open-Meteo (CC BY 4.0) — https://open-meteo.com/
  Geocoding: GeoNames via Open-Meteo (CC BY 4.0)
  CN administrative divisions: modood/Administrative-divisions-of-China (WTFPL)

  Full third-party notices: see NOTICE in the source repository.
-->
`;


/* 内容安全策略。两种形态分开写，因为 file:// 下 'self' 的行为
   各浏览器不一致（源是 opaque），单文件版索性完全不依赖 'self'。
   共同点：把网络出口锁死到天气接口，即使有 XSS 也无法外传数据到任意域名。 */
const API_ORIGINS = "https://api.open-meteo.com https://geocoding-api.open-meteo.com " +
                    "https://air-quality-api.open-meteo.com https://archive-api.open-meteo.com " +
                    "https://*.qweatherapi.com " +
                    /* 官方预警源。这几个是白名单里仅有的非天气接口，
                       每加一个都要同步改 scripts/a11y-test.mjs 里的 ALLOWED。 */
                    "https://data.weather.gov.hk https://api.weather.gov https://typhoon.nmc.cn " +
                    "https://www.nmc.cn https://api.brightsky.dev";
const CSP_SINGLE = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src ${API_ORIGINS}; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">`;
const CSP_PWA = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src ${API_ORIGINS}; manifest-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">`;

const VERSION = new Date().toISOString().slice(0,10).replace(/-/g,'') + '.' +
                String(Math.floor(Date.now()/1000)%100000);

/* 清空 dist（某些挂载盘不允许 unlink，失败就直接覆盖写） */
try{ rmSync(DIST,{recursive:true,force:true}); }
catch(e){ console.warn('  (提示) 无法清空 dist，改为覆盖写入：'+e.code); }
mkdirSync(join(DIST,'pwa','icons'),{recursive:true});

/* 指标图标开关：产出带图标与不带图标两版，方便直接对比 */
const withIcons = flag => js.replace('/*@ICONS@*/ false', `/*@ICONS@*/ ${flag}`);

/* ---- 1. 单文件版（两个变体） ---- */
const mkSingle = flag => shell
  .replace('<!--@STYLES@-->', `<style>\n${css}\n</style>`)
  .replace('<!--@SCRIPTS@-->', `<script>\n${withIcons(flag)}\n</script>`)
  .replace('<!--@CSP@-->', CSP_SINGLE)
  /* 单文件版没有 manifest / sw / 图标文件，去掉引用避免 404 */
  .replace(/^.*rel="manifest".*$/m,'')
  .replace(/^.*rel="icon".*$/m,'')
  .replace(/^.*rel="apple-touch-icon".*$/m,'');
const singlePlain = LEGAL_BANNER + mkSingle(false);
const singleIcons = LEGAL_BANNER + mkSingle(true);
writeFileSync(join(DIST,'天时-单文件.html'), singlePlain);
writeFileSync(join(DIST,'天时-单文件-带图标.html'), singleIcons);

/* ---- 2. PWA 版（带图标） ---- */
const pwaHtml = shell
  .replace('<!--@STYLES@-->', `<link rel="stylesheet" href="app.css?v=${VERSION}">`)
  .replace('<!--@SCRIPTS@-->', `<script src="app.js?v=${VERSION}"></script>`)
  .replace('<!--@CSP@-->', CSP_PWA);
writeFileSync(join(DIST,'pwa','index.html'), LEGAL_BANNER + pwaHtml);
writeFileSync(join(DIST,'pwa','app.css'), '/*! See NOTICE in the source repo. Embedded font: Plus Jakarta Sans, OFL 1.1 */\n' + css);
writeFileSync(join(DIST,'pwa','app.js'),  withIcons(true));

/* manifest 与 service worker：注入版本号 */
writeFileSync(join(DIST,'pwa','manifest.webmanifest'), read(join(PUB,'manifest.webmanifest')));
writeFileSync(join(DIST,'pwa','sw.js'),
  read(join(PUB,'sw.js')).replaceAll('@VERSION@', VERSION).replaceAll('@ASSETS@',
    JSON.stringify(['./','./index.html',`./app.css?v=${VERSION}`,`./app.js?v=${VERSION}`,
                    './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png'])));

/* 拷文件一律走「读出来再写回去」，不用 cpSync。
   原因：Windows 共享盘/网络盘上 cpSync 覆盖已存在的文件会抛 EPERM，
   而 writeFileSync 是截断写，不受影响。上面 rmSync 清 dist 失败的也是同一类问题，
   所以第二次构建必然踩到。 */
const copy = (from, to) => writeFileSync(to, readFileSync(from));

if(existsSync(join(PUB,'icons'))){
  mkdirSync(join(DIST,'pwa','icons'),{recursive:true});
  for(const f of readdirSync(join(PUB,'icons'))) copy(join(PUB,'icons',f), join(DIST,'pwa','icons',f));
}
/* GitHub Pages 不要跑 Jekyll */
writeFileSync(join(DIST,'pwa','.nojekyll'),'');

/* 平台专属文件，存在才拷：
   _headers  Cloudflare Pages / Netlify 的响应头（GitHub Pages 会忽略它，无害）
   robots.txt
   CNAME     自定义域名。默认不在仓库里——一旦存在，*.github.io 那个地址就失效了，
             所以留给你在真正申请到域名之后再建。见 docs/域名与部署.md */
for(const f of ['_headers','CNAME','robots.txt']){
  if(existsSync(join(PUB,f))) copy(join(PUB,f), join(DIST,'pwa',f));
}

const kb = n => (n/1024).toFixed(1)+' KB';
console.log(`构建完成  版本 ${VERSION}`);
console.log(`  模块        ${jsFiles.length} 个：${jsFiles.join(', ')}`);
console.log(`  单文件版    dist/天时-单文件.html          ${kb(singlePlain.length)}`);
console.log(`  图标版      dist/天时-单文件-带图标.html    ${kb(singleIcons.length)}`);
console.log(`  PWA 版      dist/pwa/               app.js ${kb(js.length)} + app.css ${kb(css.length)}`);
