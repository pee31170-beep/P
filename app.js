(() => {
'use strict';

// ----- data loading -----
const FILES = {
  assumptions: 'data/assumptions.csv',
  ev_public: 'data/ev_public_rates.csv',
  fuel: 'data/fuel_prices_2569.csv',
  fuel_today: 'data/fuel_today.csv',
  home_rates: 'data/home_rates.csv'
};
const store = { status: 'loading', data: {} };

// ----- derived tables (same formulas as the original dashboard) -----
const calcFuelStats = (fuel, fuel_today, assumptions) => {
  const asOfV = Number(assumptions.find(r => r.key === 'as_of').value);
  const asOf = Date.UTC(Math.floor(asOfV / 10000), Math.floor(asOfV / 100) % 100 - 1, asOfV % 100);
  const rows = fuel.map(r => ({ t: Date.parse(String(r.date).slice(0, 10)), r })).sort((x, y) => x.t - y.t);
  const r2 = (x) => Math.round(x * 100) / 100;
  return fuel_today.map(ft => {
    const k = ft.fuel; const vals = rows.map(x => Number(x.r[k]));
    let sum = 0, days = 0;
    rows.forEach((x, i) => { const end = i + 1 < rows.length ? rows[i + 1].t : asOf + 86400000; const d = (end - x.t) / 86400000; sum += vals[i] * d; days += d; });
    return { fuel: k, label: ft.label, min: r2(Math.min(...vals)), max: r2(Math.max(...vals)), avg: r2(sum / days), today: r2(Number(ft.price_today)) };
  });
};

const calcEvRates = (ev_public) => ev_public.map(r => ({ id: r.id, provider: r.provider, tier: r.tier, offpeak: Number(r.offpeak), peak: Number(r.peak), confidence: r.confidence }));

const calcHomeCost = (home_rates, assumptions) => {
  const a = Object.fromEntries(assumptions.map(r => [r.key, Number(r.value)]));
  const r4 = (x) => Math.round(x * 10000) / 10000;
  return home_rates.map(r => { const allin = (Number(r.base) + a.ft) * (1 + a.vat);
    return { id: r.id, meter: r.meter, tier: r.tier, base: Number(r.base), allin: r4(allin), per_kwh_batt: r4(allin / a.ac_eff) }; });
};

const calcRanking = (fuel_stats, ev_rates, home_cost) => {
  const f = Object.fromEntries(fuel_stats.map(r => [r.fuel, r]));
  const e = Object.fromEntries(ev_rates.map(r => [r.id, r]));
  const h = Object.fromEntries(home_cost.map(r => [r.id, r]));
  return [
    ['h_tou_off', 'บ้าน TOU Off-Peak', 'EV ชาร์จบ้าน', 'ev', h.tou_off.per_kwh_batt],
    ['h_p12_1', 'บ้านอัตราปกติ (หน่วย 1–200)', 'EV ชาร์จบ้าน', 'ev', h.p12_1.per_kwh_batt],
    ['h_p12_2', 'บ้านอัตราปกติ (หน่วย 201–400)', 'EV ชาร์จบ้าน', 'ev', h.p12_2.per_kwh_batt],
    ['h_p12_3', 'บ้านอัตราปกติ (หน่วยที่ 401+)', 'EV ชาร์จบ้าน', 'ev', h.p12_3.per_kwh_batt],
    ['h_tou_on', 'บ้าน TOU On-Peak', 'EV ชาร์จบ้าน', 'ev', h.tou_on.per_kwh_batt],
    ['p_volta25_off', 'PEA VOLTA 25 kW Off-Peak', 'EV สถานีสาธารณะ', 'ev', e.volta25.offpeak],
    ['p_pluz_off', 'PluZ 40–180 kW Off-Peak', 'EV สถานีสาธารณะ', 'ev', e.pluz180.offpeak],
    ['p_ea', 'EA Anywhere DC', 'EV สถานีสาธารณะ', 'ev', e.ea.offpeak],
    ['p_pluz_peak', 'PluZ 40–180 kW Peak', 'EV สถานีสาธารณะ', 'ev', e.pluz180.peak],
    ['p_volta360_peak', 'PEA VOLTA 300–360 kW Peak', 'EV สถานีสาธารณะ', 'ev', e.volta360.peak],
    ['p_tesla', 'Tesla Supercharger', 'EV สถานีสาธารณะ', 'ev', e.tesla.offpeak],
    ['f_95_min', 'แก๊สโซฮอล์ 95 ต่ำสุดปี 69', 'รถสันดาป', 'fuel', f.GSH95.min],
    ['f_e20_today', 'E20 วันนี้', 'รถสันดาป', 'fuel', f.E20.today],
    ['f_95_avg', 'แก๊สโซฮอล์ 95 เฉลี่ยปี 69', 'รถสันดาป', 'fuel', f.GSH95.avg],
    ['f_b7_today', 'ดีเซล B7 วันนี้', 'รถสันดาป', 'fuel', f.DieselB7.today],
    ['f_95_today', 'แก๊สโซฮอล์ 95 วันนี้', 'รถสันดาป', 'fuel', f.GSH95.today],
    ['f_95_max', 'แก๊สโซฮอล์ 95 สูงสุดปี 69', 'รถสันดาป', 'fuel', f.GSH95.max]
  ].map(([key, label, group, kind, unit_price]) => ({ key, label, group, kind, unit_price }));
};

async function load() {
  try {
    const entries = await Promise.all(Object.entries(FILES).map(async ([id, url]) => [id, await d3.csv(url)]));
    const d = Object.fromEntries(entries);
    d.fuel_stats = calcFuelStats(d.fuel, d.fuel_today, d.assumptions);
    d.ev_rates = calcEvRates(d.ev_public);
    d.home_cost = calcHomeCost(d.home_rates, d.assumptions);
    d.ranking = calcRanking(d.fuel_stats, d.ev_rates, d.home_cost);
    store.data = d; store.status = 'ok';
  } catch (err) {
    console.error(err);
    store.status = 'error';
  }
  document.getElementById('dash-root').removeAttribute('data-dash-state');
  render();
}

// ----- user-set consumption (persisted in URL + localStorage) -----
const DEF = { ice: 14, ev: 12.8, km: 20000 };
const LS_KEY = 'ice-ev-params';
const pos = (v) => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined;
const params = (() => {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) { saved = {}; }
  const q = new URLSearchParams(location.search);
  return {
    ice: pos(q.get('ice')) ?? pos(saved.ice) ?? DEF.ice,
    ev: pos(q.get('ev')) ?? pos(saved.ev) ?? DEF.ev,
    km: pos(q.get('km')) ?? pos(saved.km) ?? DEF.km
  };
})();
const setParams = (next) => {
  Object.assign(params, next);
  try { localStorage.setItem(LS_KEY, JSON.stringify(params)); } catch (e) { /* storage unavailable */ }
  const q = new URLSearchParams(location.search);
  if (q.has('ice') || q.has('ev') || q.has('km')) history.replaceState(null, '', location.pathname);
  render();
};
const P = () => ({ ...params });

const perKm = (r, p) => r.kind === 'fuel' ? r.unit_price / p.ice : r.unit_price * p.ev / 100;
const fmt2 = d3.format('.2f'), fmtC = d3.format(','), fmt1 = d3.format('.1f');
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)'];

const ctls = [['ice', 'in-ice', 'rg-ice'], ['ev', 'in-ev', 'rg-ev'], ['km', 'in-km', 'rg-km']];
ctls.forEach(([name, numId, rgId]) => {
  const num = document.getElementById(numId), rg = document.getElementById(rgId);
  const apply = (el) => { const v = Number(el.value); if (el.value !== '' && Number.isFinite(v) && v >= Number(num.min) && v <= Number(num.max)) setParams({ [name]: v }); };
  num.addEventListener('input', () => apply(num));
  num.addEventListener('blur', () => { num.value = P()[name]; });
  rg.addEventListener('input', () => { num.value = rg.value; apply(rg); });
});
document.getElementById('reset').addEventListener('click', () => setParams({ ...DEF }));
const syncControls = (p) => {
  const vals = { 'in-ice': p.ice, 'in-ev': p.ev, 'in-km': p.km, 'rg-ice': p.ice, 'rg-ev': p.ev, 'rg-km': p.km };
  Object.entries(vals).forEach(([id, v]) => { const el = document.getElementById(id); if (el !== document.activeElement) el.value = v; });
};

const tipEl = (box) => { let t = box.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; box.appendChild(t); } return t; };
const failOr = (el) => { if (store.status === 'error') { el.innerHTML = ''; const d = document.createElement('div'); d.className = 'fail'; d.textContent = 'โหลดข้อมูลไม่สำเร็จ'; el.appendChild(d); return true; } return false; };
const groupColor = (g) => g === 'EV ชาร์จบ้าน' ? COLORS[0] : g === 'EV สถานีสาธารณะ' ? COLORS[1] : COLORS[2];
const setAll = (cls, txt) => document.querySelectorAll('.' + cls).forEach(el => { el.textContent = txt; });
const ok = () => store.status === 'ok';

function fillAssumptions() {
  if (!ok()) { setAll('lx-ft', '—'); setAll('lx-eff', '—'); return; }
  const a = Object.fromEntries(store.data.assumptions.map(r => [r.key, Number(r.value)]));
  setAll('lx-ft', String(a.ft));
  setAll('lx-eff', d3.format('.0%')(a.ac_eff));
}

function fillHeadline(p) {
  setAll('lx-ice-kmpl', fmt1(p.ice)); setAll('lx-ev-kwh', fmt1(p.ev)); setAll('lx-km', fmtC(p.km));
  if (!ok()) { ['lx-ice-today', 'lx-ice-avg', 'lx-ev-home', 'lx-ev-pub', 'lx-save-year', 'lx-save-pct'].forEach(c => setAll(c, '—')); return; }
  const rank = store.data.ranking;
  const by = Object.fromEntries(rank.map(r => [r.key, perKm(r, p)]));
  const pubAll = store.data.ev_rates.flatMap(r => [r.offpeak, r.peak]).map(v => v * p.ev / 100);
  setAll('lx-ice-today', fmt2(by.f_95_today)); setAll('lx-ice-avg', fmt2(by.f_95_avg)); setAll('lx-ev-home', fmt2(by.h_tou_off));
  setAll('lx-ev-pub', `${fmt2(Math.min(...pubAll))}–${fmt2(Math.max(...pubAll))}`);
  setAll('lx-save-pct', String(Math.round((1 - by.h_tou_off / by.f_95_today) * 100)));
  setAll('lx-save-year', fmtC(Math.round((by.f_95_today - by.h_tou_off) * p.km)));
}

const placeTip = (tip, box, ev) => {
  const [bx, by] = d3.pointer(ev, box);
  tip.style.left = Math.max(0, Math.min(bx + 12, box.clientWidth - tip.offsetWidth - 4)) + 'px';
  tip.style.top = (by + 12) + 'px';
};

function drawRanking(p) {
  const box = document.getElementById('rank-chart');
  if (failOr(box)) return; if (!ok()) { box.innerHTML = ''; return; }
  const rows = store.data.ranking.map(r => ({ ...r, per_km: perKm(r, p) })).sort((a, b) => a.per_km - b.per_km);
  const W = box.clientWidth || 600; const rowH = 26; const top = 4, bottom = 24;
  box.innerHTML = '';
  const leg = document.getElementById('rank-legend'); leg.innerHTML = '';
  ['EV ชาร์จบ้าน', 'EV สถานีสาธารณะ', 'รถสันดาป'].forEach(g => { const s = document.createElement('span'); const sw = document.createElement('i'); sw.className = 'sw'; sw.style.background = groupColor(g); s.appendChild(sw); s.appendChild(document.createTextNode(g)); leg.appendChild(s); });
  const H = top + rows.length * rowH + bottom;
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('font-family', 'var(--font-sans)');
  const meas = svg.append('text').attr('font-size', 12);
  let lw = 0; rows.forEach(r => { meas.text(r.label); lw = Math.max(lw, meas.node().getComputedTextLength()); });
  let vw = 0; rows.forEach(r => { meas.text(`${fmt2(r.per_km)} · ${fmtC(Math.round(r.per_km * p.km))}/ปี`); vw = Math.max(vw, meas.node().getComputedTextLength()); }); meas.remove();
  lw = Math.min(lw, W * 0.42);
  const x = d3.scaleLinear([0, d3.max(rows, r => r.per_km)], [lw + 12, Math.max(lw + 60, W - vw - 10)]);
  const y = d3.scaleBand(rows.map(r => r.key), [top, top + rows.length * rowH]).padding(0.28);
  svg.append('g').selectAll('line').data(x.ticks(5)).join('line').attr('x1', v => x(v)).attr('x2', v => x(v)).attr('y1', top).attr('y2', H - bottom).style('stroke', 'var(--chart-grid)');
  svg.append('g').selectAll('text').data(x.ticks(5)).join('text').attr('x', v => x(v)).attr('y', H - 6).attr('text-anchor', 'middle').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(v => fmt2(v));
  svg.append('g').selectAll('text').data(rows).join('text').attr('x', lw + 4).attr('y', r => y(r.key) + y.bandwidth() / 2).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 12).style('fill', 'var(--color-fg)').text(r => r.label);
  const tip = tipEl(box);
  const show = (ev, r) => { tip.style.display = 'block'; tip.innerHTML = ''; const a = document.createElement('div'); a.className = 'd'; a.textContent = `${r.group} · ${fmt2(r.unit_price)} ${r.kind === 'fuel' ? 'บาท/ลิตร' : 'บาท/kWh'}`; const b = document.createElement('div'); b.textContent = `${r.label}: ${fmt2(r.per_km)} บาท/กม. · ${fmtC(Math.round(r.per_km * p.km))} บาท/ปี`; tip.append(a, b); placeTip(tip, box, ev); };
  svg.append('g').selectAll('rect').data(rows).join('rect').attr('x', x(0)).attr('y', r => y(r.key)).attr('height', y.bandwidth()).attr('width', r => Math.max(1, x(r.per_km) - x(0))).attr('rx', 4).style('fill', r => groupColor(r.group))
    .on('mousemove', show).on('click', show)
    .on('mouseleave', () => { tip.style.display = 'none'; });
  svg.append('g').selectAll('text').data(rows).join('text').attr('x', r => x(r.per_km) + 6).attr('y', r => y(r.key) + y.bandwidth() / 2).attr('dy', '0.35em').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(r => `${fmt2(r.per_km)} · ${fmtC(Math.round(r.per_km * p.km))}/ปี`);
}

const asDate = (v) => { const s = String(v); return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))); };

function drawTrend() {
  const box = document.getElementById('trend-chart');
  if (failOr(box)) return; if (!ok()) { box.innerHTML = ''; return; }
  const asOf = asDate(store.data.assumptions.find(r => r.key === 'as_of').value);
  const keys = [['GSH95', 'แก๊สโซฮอล์ 95'], ['GSH91', 'แก๊สโซฮอล์ 91'], ['E20', 'E20'], ['DieselB7', 'ดีเซล B7']];
  const rows = store.data.fuel.map(r => ({ t: new Date(String(r.date).slice(0, 10)), v: Object.fromEntries(keys.map(([k]) => [k, Number(r[k])])) })).sort((a, b) => a.t - b.t);
  const pts = rows.concat([{ t: asOf, v: rows[rows.length - 1].v }]);
  box.innerHTML = '';
  const W = box.clientWidth || 600, H = 300, m = { t: 12, r: 10, b: 26, l: 36 };
  const svg = d3.select(box).append('svg').attr('width', '100%').attr('viewBox', `0 0 ${W} ${H}`).style('font-family', 'var(--font-sans)');
  const meas = svg.append('text').attr('font-size', 11); let ew = 0; keys.forEach(([k, l]) => { meas.text(`${l} ${fmt2(pts[pts.length - 1].v[k])}`); ew = Math.max(ew, meas.node().getComputedTextLength()); }); meas.remove();
  m.r = Math.min(ew + 12, W * 0.4);
  const x = d3.scaleUtc([new Date('2026-01-01'), asOf], [m.l, W - m.r]);
  const allV = pts.flatMap(p => keys.map(([k]) => p.v[k]));
  const y = d3.scaleLinear([Math.floor(d3.min(allV) / 5) * 5, Math.ceil(d3.max(allV) / 5) * 5], [H - m.b, m.t]);
  svg.append('g').selectAll('line').data(y.ticks(5)).join('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', v => y(v)).attr('y2', v => y(v)).style('stroke', 'var(--chart-grid)');
  svg.append('g').selectAll('text').data(y.ticks(5)).join('text').attr('x', m.l - 6).attr('y', v => y(v)).attr('dy', '0.35em').attr('text-anchor', 'end').attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(v => v);
  const th = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const mt = d3.utcMonth.range(new Date('2026-01-01'), asOf).filter((_, i) => W > 500 || i % 2 === 0);
  svg.append('g').selectAll('text').data(mt).join('text').attr('x', v => x(v)).attr('y', H - 8).attr('font-size', 11).style('fill', 'var(--color-fg-muted)').text(v => th[v.getUTCMonth()]);
  const ends = keys.map(([k, l], i) => ({ k, l, i, y: y(pts[pts.length - 1].v[k]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  keys.forEach(([k], i) => {
    svg.append('path').datum(pts).attr('fill', 'none').style('stroke', COLORS[i]).attr('stroke-width', 2).attr('stroke-linejoin', 'round').attr('stroke-linecap', 'round')
      .attr('d', d3.line().curve(d3.curveStepAfter).x(p => x(p.t)).y(p => y(p.v[k])));
  });
  ends.forEach(e => svg.append('text').attr('x', W - m.r + 6).attr('y', e.y).attr('dy', '0.35em').attr('font-size', 11).style('fill', COLORS[e.i]).text(`${e.l} ${fmt2(pts[pts.length - 1].v[e.k])}`));
  const rule = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--chart-axis)').style('display', 'none');
  const tip = tipEl(box); const fd = d3.utcFormat('%d/%m/%Y');
  const show = (ev) => { const [mx] = d3.pointer(ev); const t = x.invert(mx); const i = Math.max(0, d3.bisector(p => p.t).right(rows, t) - 1); const pr = rows[i];
    rule.style('display', null).attr('x1', mx).attr('x2', mx); tip.style.display = 'block'; tip.innerHTML = '';
    const hd = document.createElement('div'); hd.className = 'd'; hd.textContent = 'ราคาตั้งแต่ ' + fd(pr.t); tip.appendChild(hd);
    keys.forEach(([k, l], j) => { const r = document.createElement('div'); const s = document.createElement('i'); s.className = 'sw'; s.style.background = COLORS[j]; r.appendChild(s); r.appendChild(document.createTextNode(`${l}: ${fmt2(pr.v[k])} บาท/ลิตร`)); tip.appendChild(r); });
    placeTip(tip, box, ev); };
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).attr('fill', 'transparent')
    .on('mousemove', show).on('touchmove', (ev) => { ev.preventDefault(); show(ev.touches[0]); }, { passive: false }).on('touchstart', (ev) => show(ev.touches[0]))
    .on('mouseleave touchend', () => { rule.style('display', 'none'); tip.style.display = 'none'; });
}

function fillTable(tableId, id, cellsOf) {
  const tb = document.getElementById(tableId).querySelector('tbody');
  tb.innerHTML = '';
  if (!ok()) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 9; td.textContent = store.status === 'error' ? 'โหลดข้อมูลไม่สำเร็จ' : '—'; tr.appendChild(td); tb.appendChild(tr); return; }
  store.data[id].forEach(r => { const tr = document.createElement('tr');
    cellsOf(r).forEach(([txt, cls]) => { const td = document.createElement('td'); if (cls) td.className = cls; td.textContent = txt; tr.appendChild(td); });
    tb.appendChild(tr); });
}

function render() {
  const p = P();
  syncControls(p); fillAssumptions(); fillHeadline(p); drawRanking(p); drawTrend();
  fillTable('fuel-table', 'fuel_stats', r => [[r.label], [fmt2(r.min)], [fmt2(r.max)], [fmt2(r.avg)], [fmt2(r.today)], [fmt2(r.min / p.ice)], [fmt2(r.avg / p.ice)], [fmt2(r.max / p.ice)], [fmt2(r.today / p.ice)]]);
  fillTable('ev-table', 'ev_rates', r => [[r.provider], [r.tier, 't'], [fmt2(r.offpeak)], [fmt2(r.peak)], [fmt2(r.offpeak * p.ev / 100)], [fmt2(r.peak * p.ev / 100)], [r.confidence, String(r.confidence).startsWith('ต่ำ') ? 't conf-low' : 't']]);
  fillTable('home-table', 'home_cost', r => [[r.meter], [r.tier, 't'], [d3.format('.4f')(r.base)], [fmt2(r.allin)], [fmt2(r.per_kwh_batt * p.ev / 100)]]);
}

// redraw charts when their width changes
let lastW = 0, rafId = 0;
new ResizeObserver(() => {
  const w = document.getElementById('rank-chart').clientWidth;
  if (w === lastW) return; lastW = w;
  cancelAnimationFrame(rafId); rafId = requestAnimationFrame(() => { const p = P(); drawRanking(p); drawTrend(); });
}).observe(document.getElementById('dash-root'));

// ----- app chrome: theme, share, install, offline -----
const toast = (msg) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2200); };

const THEME_KEY = 'ice-ev-theme';
try { const th = localStorage.getItem(THEME_KEY); if (th) document.documentElement.dataset.theme = th; } catch (e) { /* ignore */ }
document.getElementById('theme').addEventListener('click', () => {
  const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
});

document.getElementById('share').addEventListener('click', async () => {
  const p = P();
  const url = `${location.origin}${location.pathname}?ice=${p.ice}&ev=${p.ev}&km=${p.km}`;
  if (navigator.share) { try { await navigator.share({ title: document.title, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(url); toast('คัดลอกลิงก์แล้ว'); } catch (e) { prompt('คัดลอกลิงก์นี้', url); }
});

let deferredInstall = null;
const installBtn = document.getElementById('install');
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; installBtn.hidden = true; });
window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err)));
}

render();
load();
})();
