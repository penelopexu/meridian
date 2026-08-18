/* ===== 指标小图标（1.5px 线性风格，跟随文字颜色） =====
   METRIC_ICONS 由构建脚本注入：true = 带图标版，false = 纯文字版。
   两版只差这一个开关，其余代码完全相同，方便 A/B 对比。            */
const METRIC_ICONS = /*@ICONS@*/ false;

const ICO = (() => {
  const w = p => `<svg class="mi" viewBox="0 0 20 20" fill="none" stroke="currentColor"
    stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  return {
    /* 水滴 */
    humidity: w(`<path d="M10 2.5c3 3.6 5 6 5 8.4a5 5 0 0 1-10 0c0-2.4 2-4.8 5-8.4z"/>`),
    /* 风 */
    wind: w(`<path d="M2.5 7h9a2.2 2.2 0 1 0-2.2-2.2"/><path d="M2.5 11h11.5a2.2 2.2 0 1 1-2.2 2.2"/><path d="M2.5 15h6"/>`),
    /* 罗盘 */
    windDir: w(`<circle cx="10" cy="10" r="7.3"/><path d="M12.6 7.4 8.9 8.9l-1.5 3.7 3.7-1.5z"/>`),
    /* 气压计 */
    pressure: w(`<circle cx="10" cy="10" r="7.3"/><path d="M10 10 13 7"/><circle cx="10" cy="10" r=".9" fill="currentColor" stroke="none"/>`),
    /* 山 */
    elevation: w(`<path d="M2 16 7.5 6.5l3.5 5.6 2-3L18 16z"/><path d="M6 16h12"/>`),
    /* 太阳射线 */
    uv: w(`<circle cx="10" cy="10" r="3.4"/><path d="M10 2.2v1.6M10 16.2v1.6M2.2 10h1.6M16.2 10h1.6M4.5 4.5l1.1 1.1M14.4 14.4l1.1 1.1M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1"/>`),
    /* 叶片 / 空气 */
    aqi: w(`<path d="M3.5 12.5c0-4.4 3.6-8 8-8h4.5v4c0 4.4-3.6 8-8 8H3.5z"/><path d="M6 14 14 6"/>`),
    /* 颗粒物 */
    pm25: w(`<circle cx="6.5" cy="7" r="1.6"/><circle cx="13" cy="6" r="1.1"/><circle cx="10" cy="11.5" r="1.9"/><circle cx="15" cy="13" r="1.3"/><circle cx="5.5" cy="13.5" r="1"/>`),
    /* 日出 */
    sunrise: w(`<path d="M2.8 15.5h14.4"/><circle cx="10" cy="11.6" r="3"/><path d="M10 2.5v3M4.6 6.6l1.2 1.2M15.4 6.6l-1.2 1.2"/>`),
    /* 日落 */
    sunset: w(`<path d="M2.8 15.5h14.4"/><circle cx="10" cy="11.6" r="3"/><path d="M10 6.2v-3M4.6 6.6l1.2 1.2M15.4 6.6l-1.2 1.2"/><path d="M7.6 4.4 10 6.8l2.4-2.4"/>`),
    /* 温度计 */
    temp: w(`<path d="M12 11.4V4.6a2 2 0 1 0-4 0v6.8a3.6 3.6 0 1 0 4 0z"/><path d="M10 7.5v4.6"/>`),
    /* 云 */
    cloud: w(`<path d="M6 15.5a3.5 3.5 0 0 1 .4-6.98A5 5 0 0 1 16 9.5a3 3 0 0 1-.3 6z"/>`),
    /* 能见度 */
    visibility: w(`<path d="M1.8 10S4.9 4.8 10 4.8 18.2 10 18.2 10 15.1 15.2 10 15.2 1.8 10 1.8 10z"/><circle cx="10" cy="10" r="2.3"/>`)
  };
})();

/* 给指标标题加图标；未开启或没有对应图标时原样返回 */
function metricLabel(key, text){
  if(!METRIC_ICONS || !ICO[key]) return text;
  return `${ICO[key]}<span>${text}</span>`;
}
