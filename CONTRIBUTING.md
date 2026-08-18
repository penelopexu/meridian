# 参与贡献 / Contributing

中文在前，English below.

---

## 中文

欢迎参与。这个项目刻意保持简单：**零依赖、无打包器、无框架**，改完直接跑就能看结果。

### 快速开始

```bash
git clone https://github.com/penelopexu/meridian.git
cd meridian
node build.mjs        # 构建，无需 npm install
npm test              # 跑全部测试
npm run serve         # 本地预览 PWA（Service Worker 需要 http）
```

需要 Node 18+。**没有任何 npm 依赖**，`npm install` 什么都不会装。

### 项目怎么组织的

`src/js/` 下的文件按**文件名数字前缀顺序拼接**，然后整体在浏览器里执行。没有模块系统，所有顶层声明都是全局的。

```
05-icons.js       指标图标（可由构建开关关闭）
10-i18n.js        语言包，9 种语言
20-lunar.js       农历核心 + 二十四节气天文算法 + 阴阳历互转
25-calendars.js   多历法层（Intl 驱动，农历走自研引擎）
30-holidays.js    中国法定/传统节日、28 国节日规则
40-cities.js      144 座城市离线库
45-cn-districts.js 2885 条中国县级 → 地级市映射
50-api.js         网络层
55-qweather.js    可选数据源：和风天气格点
60-advice.js      穿衣建议规则引擎
65-warning.js     气象预警
70-climate.js     历年同期统计
80-chart.js       手绘 SVG 图表
85-wheel.js       惯性滚轮选择器
90-app.js         UI 与交互
```

**这种架构最大的风险是顶层重名会静默覆盖。** `npm run check` 会自动检测，PR 里必须是 0 冲突。

### 改代码前请知道的几件事

**颜色不要写死。** 全部用 CSS 变量（`var(--acc)` 等）。图表和天气图标在运行时用 `cssVar()` 读取，这样换主题和调色板时会自动跟随。

**文案不要写死。** 一律走 `T('key')` 或 `T('key', {n: 1})`。新增文案要在 `src/js/10-i18n.js` 里给**全部 9 种语言**补齐，`npm run test:i18n` 会检查缺失、类型不一致和占位符不匹配。

**网络字段必须转义。** 来自 API 的字符串（城市名、国家名等）在进入 `innerHTML` 前要过 `esc()`。转义已在 `geoSearch()` 里收口，但渲染层也做了第二道防御——因为 localStorage 里可能存着老版本写入的未转义数据。

**数值管线注意 null。** JavaScript 里 `Math.min(...[null])` 是 0、`Math.round(null)` 是 0。用 `nums()` 过滤后再做聚合。这类 bug 不会报错，只会给出错误答案。

**日历要判空。** `solarToLunar()` 在 1900-01-31 之前和 2100 之后返回 `null`。月视图会渲染相邻月份的补格，所以边界月份一定会碰到 `null`。

### 提交前

```bash
npm run check         # 语法 + 全局重名
npm test              # 全部测试
npm run build         # 确认能构建
```

CI 会跑同样的检查。多语言测试需要联网，失败不阻断合并。

### 提交信息

用中文或英文都行，说清「改了什么」和「为什么」。如果修的是 bug，请说明**根因**而不只是现象。

### 想加新功能？

先开个 issue 讨论。这个项目有意克制：

- **不加运行时依赖。** 零依赖是核心约束，不接受引入 npm 包的 PR。
- **不加追踪、统计、广告。**
- **不要求用户注册或提供密钥**才能用基础功能。

### 几个明确欢迎的方向

- 更多语言（语言包结构清晰，加一种语言只需在 `10-i18n.js` 补三处）
- 更多国家的节假日规则（`30-holidays.js`）
- 无障碍改进
- **更多国家/地区的官方预警源** —— 见下方说明，这是目前最缺的
- **农历与 ICU 的分歧复核** —— 见 [issue 模板](.github/ISSUE_TEMPLATE/lunar-discrepancy.yml) 和 `docs/lunar-vs-icu.tsv`，这个特别欢迎懂历法的人来看

### 想加一个官方预警源？

判据只有一条：**免 key 且允许跨域（CORS）**。我们是纯静态站点，没有服务端能代为转发，
浏览器会拦掉一切不发 `Access-Control-Allow-Origin` 的响应。

先用 `scripts/probe-alert-sources.html` 自测（在浏览器里打开，它会用真正的 `fetch()`
去试，并能区分「没有 CORS 头」和「网络不通」）。通过之后：

1. 在 `src/js/65-warning.js` 的 `ALERT_SOURCES` 里加一项，写清 `match`（哪些地点适用）
   和 `load`（怎么取、怎么解析）
2. `load` 必须自己吞掉所有异常 —— 一个源挂了不能影响其他源和整个界面
3. 把域名加进 **三处** CSP 白名单：`build.mjs` 的 `API_ORIGINS`、`public/_headers`、
   以及 `scripts/a11y-test.mjs` 的 `ALLOWED`（测试会校验三者一致）
4. 在 `scripts/alert-test.mjs` 里用造样本补测试。真实接口平时返回「没有警告」，
   有警告的那条分支只能靠造样本覆盖

### 许可

提交即表示同意你的贡献以 MIT 许可发布。注意仓库里的**字体数据是 OFL 1.1**，不受 MIT 覆盖，详见 `NOTICE`。

---

## English

Contributions welcome. This project is deliberately simple: **zero dependencies, no bundler, no framework**.

### Quick start

```bash
git clone https://github.com/penelopexu/meridian.git
cd meridian
node build.mjs        # build; no npm install needed
npm test              # run all tests
npm run serve         # preview the PWA locally
```

Node 18+. **There are no npm dependencies.**

### Architecture

Files in `src/js/` are **concatenated in filename order** and executed as one script. No module system — every top-level declaration is global.

**The main hazard of this design is silent shadowing from duplicate top-level names.** `npm run check` detects it; PRs must show 0 conflicts.

### Before you write code

- **Never hardcode colors.** Use CSS variables. Charts and icons read them at runtime via `cssVar()`.
- **Never hardcode strings.** Use `T('key')`. New strings must be added for **all 9 languages**; `npm run test:i18n` checks for gaps, type mismatches and placeholder drift.
- **Escape network strings** with `esc()` before they reach `innerHTML`.
- **Watch out for `null` in numeric pipelines.** `Math.min(...[null])` is `0` in JS. Filter with `nums()` first.
- **Guard calendar boundaries.** `solarToLunar()` returns `null` outside 1900-01-31 … 2100.

### Before submitting

```bash
npm run check && npm test && npm run build
```

### Scope

Please open an issue before adding features. This project intentionally says no to:

- Runtime dependencies
- Tracking, analytics, ads
- Requiring signup or API keys for core functionality

### Especially welcome

- More languages, more countries' holiday rules, accessibility improvements
- **Reviewing the lunar-vs-ICU discrepancies** — see `docs/lunar-vs-icu.tsv`; expertise in calendrical astronomy is very welcome here

### License

By contributing you agree your work is released under MIT. Note the bundled **font data is OFL 1.1** and not covered by MIT — see `NOTICE`.
