<div align="center">

# 天时 · Meridian

**Perpetual calendar + global weather + historical climate**
No signup, no API key, no data collection

[![CI](https://github.com/penelopexu/meridian/actions/workflows/ci.yml/badge.svg)](https://github.com/penelopexu/meridian/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)
[![Languages](https://img.shields.io/badge/languages-9-orange.svg)](src/js/10-i18n.js)

[中文](README.md) · [Live demo](https://penelopexu.github.io/meridian/) · [Download single file](https://github.com/penelopexu/meridian/releases/latest)

</div>

---

## What it does

- **Perpetual calendar** — Chinese lunar calendar 1900–2100, the 24 solar terms, sexagenary years, zodiac animals, bidirectional lunar↔solar conversion
- **12 calendar systems** — besides the Chinese lunisolar calendar: Korean Dangi, Japanese imperial eras, Islamic (Umm al-Qura), Hebrew, Indian national, Persian, Buddhist, Coptic, Ethiopic, and Minguo
- **Chinese public holidays** — statutory days off and the compensatory working days that go with them, entered day by day from the State Council notices; plus traditional festivals and solar terms
- **Holidays elsewhere** — rules for 28 countries/regions including Easter computation, following the selected location automatically, or set manually
- **Weather** — current conditions, next 48 h at 15-minute resolution, 7-day forecast, past 3 days actual, with elevation, UV index and air quality
- **Clothing advice** — a local rules engine combining apparent temperature, wind, humidity, UV, elevation and the day/night temperature swing
- **Historical weather** — back to **1940**; single day, date-range line chart, or same-period-across-years comparison
- **Weather warnings** — five official sources wired in with no API key (China Meteorological Administration at county level, Hong Kong Observatory, US National Weather Service, Deutscher Wetterdienst, CMA Typhoon Network), optionally QWeather; anywhere not covered falls back to locally derived warnings
- **Timezone conversion** — symmetric two-way conversion, DST handled
- **Four views** — day / week / month / year, with all 12 months on one screen in year view
- **Multiple saved locations** — the primary one loads by default
- **9 languages** — Simplified Chinese, Traditional Chinese, English, Japanese, Korean, Spanish, French, German, Arabic (with RTL layout)
- **Accessible** — semantic landmarks, keyboard operable, visible focus, honours *reduced motion* and *increased contrast* system settings

## Two ways to use it

### Single file

Download `天时-单文件-带图标.html` from [Releases](https://github.com/penelopexu/meridian/releases/latest) and open it in a browser.

One 400 KB file with fonts, styles, scripts, a 144-city offline database, 2,885 Chinese county→prefecture mappings and the full 1900–2100 lunar table all inlined. Works from a USB stick. The calendar, lunar dates, solar terms, holidays and date conversion need **no network at all** — only weather does.

### PWA

Visit <https://penelopexu.github.io/meridian/> and use your browser's *Install* button. It then behaves like a native app, with its own window and icon, and works offline.

> Deploying to your own domain? See [docs/域名与部署.md](docs/域名与部署.md) (Chinese).

## Local development

```bash
git clone https://github.com/penelopexu/meridian.git
cd meridian
node build.mjs        # build; no npm install needed
npm test              # 582 assertions
npm run serve         # preview the PWA locally
```

Node 18+. **Zero npm dependencies** — `npm install` installs nothing.

Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md).

### Layout

Files in `src/js/` are **concatenated in filename order** and run as a single script. There is no module system and no bundler; every top-level declaration is global.

```
05-icons.js         metric icons (toggleable at build time)
10-i18n.js          message catalogue and T(), 9 languages
20-lunar.js         lunar core + solar-term astronomy + date conversion
25-calendars.js     multi-calendar layer (Intl-driven; Chinese uses our own engine)
30-holidays.js      Chinese statutory/traditional holidays, 28-country rules, Easter
40-cities.js        144-city offline database, great-circle distance, nearest match
45-cn-districts.js  2,885 Chinese county → prefecture mappings
50-api.js           network layer (timeout, retry, error normalisation, HTML escaping)
55-qweather.js      optional data source: QWeather grid, 3–5 km
60-advice.js        clothing advice rules engine
65-warning.js       weather warnings: multi-source selection + local derivation
70-climate.js       same-period-across-years statistics
80-chart.js         hand-rolled SVG charts (zero dependencies)
85-wheel.js         inertial wheel picker
90-app.js           UI and interaction
```

**The main hazard of this design is silent shadowing from duplicate top-level names.** `npm run check` detects it; PRs must show 0 conflicts.

### Tests

| Command | What it covers | Assertions |
|---|---|---|
| `npm run check` | syntax, top-level name collisions | 6 |
| `npm run test:lunar` | lunar engine (full 1900–2100 round-trip + almanac anchors) | 52 |
| `npm run test:offline` | holidays / advice / warnings / charts / XSS / colour contrast & consistency | 142 |
| `npm run test:calendar` | 12 calendar systems, location-based selection, holiday region | 77 |
| `npm run test:alert` | alert parsing, source selection, dedup (real captured samples) | 132 |
| `npm run test:i18n` | key completeness, placeholders, rendering in 9 languages (needs network) | 63 |
| `npm run test:a11y` | accessibility and Content Security Policy | 109 |
| `npm run test:ui` | UI snapshot regression | 49 blocks |

## Data sources and accuracy

- Weather and history: [Open-Meteo](https://open-meteo.com/) — free, no API key, CC BY 4.0
- Historical data is **ERA5 reanalysis** on a ~25 km grid — **not station observations**. Fine at city scale; expect deviations in mountains and near coastlines. The most recent two days are the preliminary ERA5T product and may be revised later.
- Lunar dates and solar terms are computed offline (iterative solution of the sun's apparent longitude), verified for round-trip consistency across the entire 1900–2100 range
- Chinese statutory holidays are entered day-by-day for 2024–2026; unpublished years are extrapolated and labelled *estimated* in the UI
- Administrative divisions from [modood/Administrative-divisions-of-China](https://github.com/modood/Administrative-divisions-of-China) (Ministry of Civil Affairs data)

### An open question: this engine vs. ICU

Across ~72,000 days from 1901 to 2099, this project's lunar engine disagrees with the browser's built-in ICU `chinese` calendar on **300 days of month-day numbering** and a further **177 days where only the leap-month label differs**, concentrated in 13 years.

At every anchor that can be checked against published almanacs — Chinese New Year 1954 (Feb 3), 2027 (Feb 6), the 1987 leap month — **this engine agrees with the almanac and ICU does not**. However, I was unable to write a trustworthy independent astronomical arbiter to settle the remaining differences, so this is recorded honestly as unresolved rather than claimed as a win.

The full list is in [`docs/lunar-vs-icu.tsv`](docs/lunar-vs-icu.tsv). **Calendrical expertise is very welcome here** → [open an issue](https://github.com/penelopexu/meridian/issues/new?template=lunar-discrepancy.yml)

## How apparent temperature and clothing advice are computed

**A piecewise model — each formula is used only within its own accepted valid range:**

| Condition | Formula | Source |
|---|---|---|
| Air temp ≥ 27 °C | Heat Index (Rothfusz regression) | US National Weather Service |
| Air temp ≤ 10 °C and wind > 4.8 km/h | Wind Chill (JAG/TI) | 2001 US–Canada joint revision |
| 10 – 27 °C | air temperature, lightly adjusted for wind, humidity, sunshine, precipitation | — |

**Why not just use the API's `apparent_temperature`**: Open-Meteo uses the Australian Apparent Temperature formula (Steadman 1994), designed for heat-stress assessment. It over-weights humidity between 20 and 27 °C. Measured case: 25 °C, 98 % RH, 3 km/h wind — the formula returns 30.6 °C, while the actual sensation is close to the air temperature itself. There is no internationally accepted humidity correction for that middle band; national weather services simply report the air temperature.

**The 11 clothing bands (from "scorching" to "extreme cold") are this tool's own empirical table, not a standard.** Thermal comfort varies enormously between people and with acclimatisation, so the UI offers a three-way calibration — *runs cold / normal / runs hot* — shifting the result by ∓2.5 °C.

## Grid resolution

Measured by probing cell-centre spacing:

| Region | Grid | Underlying model |
|---|---|---|
| New York | ~0.8 km | HRRR 3 km |
| Berlin | ~1.4 km | ICON-D2 2.2 km |
| Paris | ~1.5 km | AROME 1.3 km |
| London | ~2.0 km | UKMO UKV 2 km |
| Sydney / Moscow | 3–4 km | |
| Tokyo / Seoul | 5–6 km | JMA MSM 5 km |
| Singapore / Lagos / Mumbai | 8–9 km | global model |
| **China** | **9.6 km** | global model only |

Europe and North America reach kilometre scale because NOAA, DWD, Météo-France and UKMO publish their mesoscale models openly. The China Meteorological Administration's CMA-MESO (3 km) is not open, so Open-Meteo only has the 15 km global model there. Every 2–3 km regional model returns *"No data available"* inside China.

> These figures are inferred from cell-centre spacing. HRRR uses a Lambert projection and ICON-D2 a rotated grid, so spacing in lat/lon is uneven and the measured value looks finer than the model's nominal resolution. Effective resolution is still the nominal figure, but the order-of-magnitude conclusion holds.

### Two free improvements (on by default)

- **`cell_selection=land`** — coastal locations can otherwise land on an ocean cell. Measured: Sanya 27.9 °C (nearest) vs 30.2 °C (land), a 2.3 ° difference; Qingdao pier 1.6 °.
- **`minutely_15`** — 15-minute resolution for the intraday curve, capped at 48 hours (8 days costs 29 KB; 48 hours costs 9 KB).

### Optional: QWeather grid (3–5 km)

Enter your own API Host and Key in the *Data source* panel. Credentials are written **only to your own browser's localStorage** — this is a static site with no server, so nothing is uploaded anywhere. Free tier: 1,000 requests/day, 100 QPM.

Failures **fall back silently** to Open-Meteo and show the reason in the panel.

Two caveats:

- QWeather grid data is a model downscaling product; their own documentation says it should not be compared directly against station observations. **A finer grid is not the same as a better forecast** — querying Berlin through QWeather is not necessarily better than Open-Meteo's direct ICON-D2, which is the German weather service's native mesoscale model.
- QWeather has announced that from 2027-01-01 the API-KEY method will have daily request limits; JWT will be required.

## Place-name search

### Open-Meteo's Chinese index is incomplete, so we query both

| Query | Chinese index returns | English index returns |
|---|---|---|
| `new york` | New York City absent entirely | New York 8,804,190 ✓ |
| `纽约` | zero results | — |
| `东京` | two same-named villages, population 0 | Tokyo 9,733,276 ✓ |
| `伦敦` | London, Ontario, Canada (420k) | London UK 8,961,989 ✓ |

Every search therefore queries the English and Chinese indexes **in parallel**, deduplicating by GeoNames id. Chinese input is additionally translated to English via the built-in city database and queried a third time. Results are scored *exact name match > prefix > substring*, ties broken by population.

### Chinese counties and districts

Open-Meteo's geocoder only goes down to prefecture level, so searching 惠阳 returns nothing. The fallback chain:

1. Online search
2. Zero results, or only same-named villages under 300,000 population → look up the built-in county table and search the parent prefecture instead (惠阳 → 惠州, 雁塔 → 西安, 顺德 → 佛山)
3. Still nothing → fuzzy-match against the 144-city offline database, clearly labelled in the UI as not a real search result

## Weather warnings

Three tiers, shown together, each labelled with its origin:

| Tier | Source | Coverage | Key needed |
|---|---|---|---|
| 1 | China Meteorological Administration | mainland China, county level, all hazards | no |
| 1 | Hong Kong Observatory | Hong Kong | no |
| 1 | US National Weather Service | all of the US | no |
| 1 | Bright Sky (relaying DWD) | Germany | no |
| 1 | CMA Typhoon Network | NW Pacific typhoons | no |
| 2 | QWeather | global | yes |
| 3 | Locally derived | global — always available | no |

**Why coverage is patchy**: this is a static site with no server, so every request comes from
the visitor's browser. Browsers block any cross-origin request whose response lacks
`Access-Control-Allow-Origin` — and the two services that would have filled the gaps,
MeteoAlarm (Europe) and WMO (global), both omit that header. Europe outside Germany, South
America, Africa and South Asia therefore have only the derived warnings plus optional QWeather.

Also probed and **unusable**: MeteoAlarm, WMO and the India Meteorological Department all lack
CORS headers. Australia's Bureau of Meteorology endpoint does respond, but its own payload states
*"You must not use, copy or share it"* — an explicit prohibition, so it is not integrated.
**Contributions of additional sources are very welcome** — the only requirement is
*no API key and CORS-enabled*. Test a candidate with `scripts/probe-alert-sources.html`.

### What the derived warnings can and cannot do

Thresholds come from the China Meteorological Administration's warning-signal standard,
applied to forecast data and clearly labelled *derived* — never presented as an official
issuance. Covers heat, rainstorm, gale, cold wave, snow and thunderstorm, using the national
four-colour scale (blue < yellow < orange < red).

The official standard uses sliding windows ("within 24 hours", "within 3 hours") while we only
have daily aggregates, so this is a **conservative approximation** — it under-reports rather
than over-reports. When an official source has issued the same category, the derived one is
dropped.

**Typhoons cannot be derived.** A typhoon warning presupposes that a *named* tropical cyclone
exists and that its track will affect this location; daily maximum wind speed cannot tell a
typhoon apart from a cold-front gale. Typhoons therefore require an official source.

### Typhoons

Sourced from the CMA Typhoon Network. Beyond the warning banner it shows great-circle distance
from the selected location, central wind force, pressure and direction of travel.
**The distance grading is ours, not an official issuance** (≤200 km red, ≤500 orange,
≤900 yellow, beyond that blue, then capped by the storm's own category) and is labelled
*derived* in the UI.

That endpoint has no public documentation and could change shape at any time, so the parser is
written to be structure-agnostic: it searches the returned data for records that carry a
plausible latitude, longitude and wind speed together, and returns nothing at all if it can't
find them — rather than throwing or rendering half-parsed data.

## Privacy and security

- Saved locations, theme and language live only in your browser's `localStorage`
- QWeather credentials, if you enter them, likewise stay local — never uploaded, never committed
- No network activity beyond weather requests to Open-Meteo (and QWeather if you enable it)
- No analytics, no tracking, no ads
- The Content Security Policy locks `connect-src` to the weather API domains, so even a successful XSS could not exfiltrate data to an arbitrary host
- Every string arriving from the network passes through `esc()` before reaching `innerHTML`

> This is a **static site with no server**. That means credentials you enter live in *your own* browser and never touch anyone else's machine — but it also means there is nowhere to hide a secret. See [SECURITY.md](SECURITY.md).

## Licence

Source code: [MIT](LICENSE).

The bundled Plus Jakarta Sans font data is under the **SIL Open Font License 1.1** and is *not* covered by the MIT licence. Weather data is copyright Open-Meteo and its upstream sources (CC BY 4.0). Full third-party notices in [NOTICE](NOTICE).
