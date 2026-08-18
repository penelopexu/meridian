# 安全策略 / Security Policy

## 这个项目的安全边界

「天时」是**纯静态前端**，没有服务端、没有数据库、没有用户账号。这决定了它的风险面很窄：

- 所有数据（收藏地点、主题、语言、可选的 API 凭据）只存在**用户自己浏览器的 localStorage**，从不上传
- 除了向 Open-Meteo（以及用户主动启用的和风天气）请求天气，没有任何网络行为
- 无统计、无追踪、无广告、无第三方脚本

## 已知的风险点

**1. 用户自填的 API 凭据**

启用和风天气数据源时，API Host 和 Key 存在 localStorage。这意味着：

- 同一浏览器上的其他脚本理论上可以读到（但本项目不加载任何第三方脚本）
- 部署到公网时，凭据仍只在**访问者自己的浏览器**里，不会被服务端或作者拿到
- **不要**把自己的 Key 提交进仓库。`.gitignore` 已排除 `.env`、`*.key` 等，但 localStorage 本来也不进 Git

**2. 来自 API 的字符串**

城市名、国家名等来自 Open-Meteo（其底层是 GeoNames 数据）。这些字符串会进入 `innerHTML`。项目做了两层防御：

- 在 `geoSearch()` 里统一 `esc()` 转义（一处收口）
- 渲染层再转义一次（因为 localStorage 里可能存着旧版本写入的未转义数据）

如果你发现任何绕过这两层的路径，请按下面的流程报告。

**3. Service Worker 缓存**

SW 只缓存同源资源，天气接口一律 network-only。`activate` 时只清理 `meridian-`（以及改名前的 `tianshi-`）前缀的缓存，不会影响同域下的其他应用。

## 报告漏洞

如果你发现了安全问题，**请不要开公开 issue**。

请发邮件到：**penelopexu@gmail.com**

请包含：
- 问题描述与影响
- 复现步骤
- 你认为的严重程度

我会在 **7 天内**回复确认，并在修复后于 CHANGELOG 中致谢（除非你希望匿名）。

## 支持的版本

这是个人维护的小项目，只维护最新版本。请先确认问题在最新版上仍然存在。

---

# Security Policy (English)

Tianshi is a **fully static frontend**: no server, no database, no accounts. All user data (favorites, theme, language, optional API credentials) lives only in the visitor's own `localStorage` and is never uploaded. The only network calls are to Open-Meteo (and to QWeather if the user explicitly enables it).

**Known surfaces:**

1. **User-supplied API credentials** are stored in `localStorage`. They stay in the visitor's browser; neither the deployment nor the author can read them. Never commit your own keys.
2. **Strings from the weather API** (city and country names, ultimately from GeoNames) reach `innerHTML`. They are escaped twice: once centrally in `geoSearch()`, and again at render time as defence in depth against stale unescaped values in `localStorage`. Report any path that bypasses both.
3. **Service Worker** caches same-origin assets only; weather endpoints are network-only; cache cleanup is scoped to the `meridian-` prefix (plus the legacy `tianshi-` one).

**Reporting:** please do **not** open a public issue. Email **penelopexu@gmail.com** with a description, reproduction steps and your assessment of severity. You'll get a reply within 7 days, and credit in the CHANGELOG once fixed (unless you prefer to stay anonymous).

**Supported versions:** latest release only. Please confirm the issue still exists on the latest build.
