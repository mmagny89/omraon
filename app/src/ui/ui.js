import { G, AU_KM, DAYS_PER_YEAR, DEG, R_EARTH_KM, R_JUP_KM } from '../physics/constants.js';
import { poleVector } from '../physics/system.js';
import { equilibriumTemp, insolation, starLuminosity, habitableZone, hillRadius, stableSatelliteLimit, rocheLimitKm, bulk, fmtMass } from '../physics/derived.js';
import { BELT, STAR } from '../data/omraon.js';
import { assess, distanceForTemp } from '../physics/habitability.js';
import { SITES } from '../data/sites.js';
import { EVENTS, ERAS, eraAt, systemAgeGyr, LUMINOSITY_GROWTH_PER_GYR } from '../data/chronologie.js';
import { siteReport } from '../physics/habitat.js';
import { transfer, PROPULSION } from '../physics/transfers.js';
import { computeSky } from '../physics/sky.js';
import { drawSky } from '../render/skyView.js';
import { runEphemeris } from '../physics/ephemeris.js';
import { buildScene } from '../physics/scene.js';
import { habitabilityScan } from '../physics/habscan.js';
import { simulateSpread } from '../physics/network.js';
import { simulatePopulation, DEFAULTS as POP_DEFAULTS } from '../physics/population.js';
import { planVoyage } from '../physics/flight.js';
import { makeSnapshot, ctxAt } from '../physics/ephem.js';
import { siteState } from '../physics/sites.js';
import { UNIT } from '../render/world.js';
import { jourKebet, decouperDate, fmtDuree, fmtSecondes, fmtTerre, enSecondesKebet, HEURES_PAR_JOUR } from '../physics/calendrier.js';

// Vitesses : jour, heure, minute et seconde sont ceux de Kebet (facteur en jours de Kebet) ; mois et années restent terrestres (flag T).
const SPEEDS_BASE = [
  [1 / 86400, 'temps réel'], [1 / 1440, '1 min/s'], [1 / 24, '1 h/s'], [1, '1 j/s'], [10, '10 j/s'], [30.4375, '1 mois/s', true],
  [DAYS_PER_YEAR, '1 an/s', true], [DAYS_PER_YEAR * 10, '10 ans/s', true], [DAYS_PER_YEAR * 100, '100 ans/s', true], [DAYS_PER_YEAR * 1000, '1000 ans/s', true],
];
const SPEEDS = SPEEDS_BASE.map(([b, l]) => [b, l]); // [jours terrestres par seconde réelle, libellé] — recalé sur Kebet par recalerVitesses()
const recalerVitesses = () => SPEEDS_BASE.forEach(([b, l, T], i) => {
  SPEEDS[i][0] = T ? b : b * jourKebet();
  SPEEDS[i][1] = /j\/s$/.test(l) ? `${l} (${fmtTerre(SPEEDS[i][0])} Terre/s)` : l;
});
const $ = (s) => document.querySelector(s);
const mixHex = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const f = (x, d = 3) => (d === 0 ? Math.round(x).toLocaleString('fr-FR') : Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(2) : x.toFixed(d));
const fmtDur = (d) => fmtDuree(d);
const row = (k, v, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;

export class UI {
  constructor(sim, world) {
    this.sim = sim; this.world = world;
    recalerVitesses();
    document.querySelectorAll('option[data-jk]').forEach((o) => { o.value = String(+o.dataset.jk * jourKebet()); o.textContent = `${o.dataset.jk} jour${+o.dataset.jk > 1 ? "s" : ""} (${fmtTerre(+o.value)} Terre)`; }); // horizons en jours de Kebet
    this.playing = true; this.speedIdx = 0; this.target = 0; this.selected = 0; this.selectedSite = null;
    this.hz = habitableZone(sim.bodies[0].def);
    this.L = starLuminosity(sim.bodies[0].def);
    this.buildList();
    this.buildChrono();
    this.buildEphem();
    this.bindSiteTools();
    this.bindVoyage();
    this.bindGround();
    this.buildNet();
    this.buildPop();
    this.bind();
    world.onSelect = (i) => this.select(i, true);
    this.select(0, false);
  }

  // Liste hiérarchique : chaque planète forme un groupe — ses villes et stations, puis ses lunes (avec leurs propres sites).
  buildList() {
    const list = $('#list'); list.innerHTML = '';
    const bodies = this.sim.bodies;
    const mk = (parent, tag, cls, html) => { const e = document.createElement(tag); e.className = cls; if (html) e.innerHTML = html; parent.appendChild(e); return e; };
    const btn = (parent, cls, html, attrs, onClick) => { const e = mk(parent, 'button', cls, html); Object.assign(e.dataset, attrs); e.addEventListener('click', onClick); return e; };
    const group = () => mk(list, 'div', 'grp');
    const sitesOf = (name) => SITES.filter((x) => x.body === name);
    const siteBtn = (parent, x, cls = 'site') => btn(parent, cls, `<span class="ico">${x.type === 'orbit' ? '◇' : x.type === 'floating' ? '☁' : '▪'}</span>${x.name}`, { site: x.id }, () => this.selectSite(x.id));
    const bodyBtn = (parent, b, cls) => {
      const dot = `<span class="dot" style="color:${b.def.color || '#ffe2b0'};background:${b.def.color || '#ffe2b0'}"></span>`;
      return btn(parent, cls || b.type, `${dot}${b.def.name}`, { idx: b.idx }, () => { this.select(b.idx, true); this.closeLeftOnMobile(); });
    };
    bodyBtn(group(), bodies[0]);
    bodies.filter((b) => b.type === 'planet').forEach((p) => {
      const g = group();
      bodyBtn(g, p);
      const own = sitesOf(p.def.name);
      if (own.length) { mk(g, 'div', 'sub', 'Villes et stations'); own.forEach((x) => siteBtn(g, x)); }
      const moons = bodies.filter((m) => m.type === 'moon' && m.parent === p.idx);
      if (moons.length) {
        mk(g, 'div', 'sub', 'Lunes');
        moons.forEach((m) => { bodyBtn(g, m); sitesOf(m.def.name).forEach((x) => siteBtn(g, x, 'site deep')); });
      }
      if (p.def.id === 'naksun') {
        const gb = group();
        btn(gb, 'belt', `<span class="dot" style="color:#c8c8d0;background:#c8c8d0"></span>${BELT.name} (ceinture)`, {}, () => this.select(0, true));
        const bs = sitesOf('Nunzir'); if (bs.length) { mk(gb, 'div', 'sub', 'Sites'); bs.forEach((x) => siteBtn(gb, x)); }
      }
    });
    this.markList();
  }

  // ---------- Chronologie ----------
  buildChrono() {
    const Y0 = -960, Y1 = 60, pct = (y) => ((y - Y0) / (Y1 - Y0)) * 100, fr = $('#frise');
    const eras = [[-960, -560, 'out', 'Voyage des arches (hors système)'], [-560, -500, 'c1', 'La cohabitation'], [-500, -300, 'c2', 'Les Siècles Sombres'], [-300, 0, 'c3', 'Ère confédérale'], [0, 60, 'c4', 'Après le présent']];
    const labels = [[-960, 'Départ'], [-560, 'Arrivée'], [-500, 'Basculement'], [-300, 'Fin des Siècles Sombres'], [0, 'Présent']];
    fr.innerHTML = `<div class="read" id="frise-read"></div>` +
      `<div class="track" id="frise-track" role="slider" tabindex="0" aria-valuemin="${Y0}" aria-valuemax="${Y1}" aria-valuenow="0" aria-label="Date en années (An 0 = présent du roman) ; flèches : ±1 an, Maj : ±10 ans">` +
      eras.map(([a, b2, c, t]) => `<div class="seg ${c}" style="width:${pct(b2) - pct(a)}%" title="${t}"></div>`).join('') + '</div>' +
      EVENTS.map((e) => `<button type="button" class="tick" data-year="${e.year}" style="left:${pct(e.year)}%" title="${e.label} (An ${String(e.year).replace('-', '−')}) : ${e.note}" aria-label="${e.label}"></button>`).join('') +
      labels.map(([y, t]) => `<span class="lab" style="left:${Math.min(94, Math.max(6, pct(y)))}%">${t}</span>`).join('') + '<div class="cursor" id="frise-cursor"></div>';
    this.friseDom = { track: $('#frise-track'), cursor: $('#frise-cursor'), read: $('#frise-read'), Y0, Y1, pct };
    const yearAt = (e) => { const r = this.friseDom.track.getBoundingClientRect(); return Y0 + Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * (Y1 - Y0); };
    let drag = false;
    this.friseDom.track.addEventListener('pointerdown', (e) => { drag = true; this.friseDragging = true; this.friseDom.track.setPointerCapture(e.pointerId); const y = yearAt(e); this.friseLabel(Math.round(y)); this.friseDom.cursor.style.left = pct(y) + '%'; });
    this.friseDom.track.addEventListener('pointermove', (e) => { if (!drag) return; const y = yearAt(e); this.friseLabel(Math.round(y)); this.friseDom.cursor.style.left = pct(y) + '%'; });
    const end = (e) => { if (!drag) return; drag = false; this.friseDragging = false; this.goTo(Math.round(yearAt(e))); };
    this.friseDom.track.addEventListener('pointerup', end); this.friseDom.track.addEventListener('pointercancel', () => { drag = false; this.friseDragging = false; });
    this.friseDom.track.addEventListener('keydown', (e) => {
      const step = e.shiftKey ? 10 : 1, cur = Math.round(this.target / DAYS_PER_YEAR); let y = null;
      if (e.key === 'ArrowLeft') y = cur - step; else if (e.key === 'ArrowRight') y = cur + step; else if (e.key === 'Home') y = Y0; else if (e.key === 'End') y = Y1;
      if (y == null) return; e.preventDefault(); y = Math.max(Y0, Math.min(Y1, y)); this.friseLabel(y); clearTimeout(this._friseT); this._friseT = setTimeout(() => this.goTo(y), 350);
    });
    fr.querySelectorAll('.tick').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); this.goTo(+b.dataset.year); }));
    this.friseLabel(0);
  }

  friseLabel(year) {
    const era = eraAt(year), ev = EVENTS.filter((e) => Math.abs(e.year - year) <= 8).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
    this.friseDom.read.innerHTML = `<b>An ${String(year).replace('-', '−')}</b> — ${era.label}${ev ? ` <span>· ${ev.label}</span>` : ''}${era.outside ? ' <span>· les arches sont en route, pas encore d\'humains</span>' : ''} <span>· âge du système ${systemAgeGyr(STAR, year).toFixed(6)} Gyr</span>`;
  }

  /** Place le curseur de la frise à la date simulée (appelé à chaque image). */
  friseUpdate(yearFloat) {
    if (!this.friseDom || this.friseDragging) return;
    const { cursor, track, Y0, Y1, pct } = this.friseDom, y = Math.max(Y0, Math.min(Y1, yearFloat));
    cursor.style.left = pct(y) + '%'; track.setAttribute('aria-valuenow', Math.round(yearFloat));
    const yi = Math.floor(yearFloat);
    if (yi !== this._friseYear) { this._friseYear = yi; this.friseLabel(yi); this.popAtDate(yi); this.popCursor(yi); }
  }

  /** Va à l'année donnée (An 0 = présent) : recalcule les positions des planètes à cette date. */
  goTo(year) { this.friseLabel(year); this._friseYear = year; this.popAtDate(year); this.popCursor(year); this.goToTime(year * DAYS_PER_YEAR); }

  /** Saute à la date t (jours depuis l'An 0). */
  goToTime(t) {
    this.cancelVoyage();
    this.calculating = true; $('#date').textContent = 'Calcul des positions…';
    setTimeout(() => {
      this.sim.jumpTo(t);
      this.target = this.sim.t;
      this.sim.computeRender(this.target);
      this.calculating = false;
    }, 30);
  }

  // ---------- Population et dégel ----------
  buildPop() {
    const ids = { n0: 'N0', h: 'humansNow', t0: 'T0', ratio: 'tytRatio', know: 'knowledgeHalfLife', ctl: 'controlNeeded', dh: 'despairHalfLife', ts: 'truthStrength' };
    const setInputs = () => { for (const [k, p] of Object.entries(ids)) $('#pop-' + k).value = POP_DEFAULTS[p]; $('#pop-growth').value = POP_DEFAULTS.tytGrowth * 100; $('#pop-mode').value = POP_DEFAULTS.tytMode; $('#pop-ty').value = ''; };
    let t = null; const again = () => { clearTimeout(t); t = setTimeout(() => this.recomputePop(), 120); };
    document.querySelectorAll('#pop input, #pop select').forEach((el) => el.addEventListener('input', again));
    $('#pop-reset').addEventListener('click', () => { setInputs(); this.recomputePop(); });
    this.recomputePop();
  }

  readPop() {
    const g = (id) => parseFloat($(id).value), ty = g('#pop-ty'), v = (x, d) => (Number.isFinite(x) ? x : d);
    return { N0: v(g('#pop-n0'), 10000), humansNow: v(g('#pop-h'), 500000), T0: v(g('#pop-t0'), 4000), tytMode: $('#pop-mode').value, tytRatio: v(g('#pop-ratio'), 1.2), tytGrowth: v(g('#pop-growth'), 0.8) / 100,
      knowledgeHalfLife: v(g('#pop-know'), 220), controlNeeded: v(g('#pop-ctl'), 0.6), despairHalfLife: v(g('#pop-dh'), 460), truthYear: Number.isFinite(ty) ? ty : 1e9, truthStrength: v(g('#pop-ts'), 0.6) };
  }

  recomputePop() {
    this.pop = simulatePopulation(this.readPop()); this._popYear = null;
    const m = this.pop, s = m.summary, f = (x) => Math.round(x).toLocaleString('fr-FR'), yr = (y) => (y == null ? 'jamais' : 'An ' + String(Math.round(y)).replace('-', '−'));
    $('#pop-sum').innerHTML = `Croissance humaine ≈ <b>${(m.growth * 100).toFixed(2)} %/an</b> (canon : 0,6–0,8). Au présent : <b>${f(s.humansNow)}</b> humains ${s.canonHumans ? '✓ (300 000–800 000)' : '✗ hors canon'}, <b>${f(s.tytsNow)}</b> Tyts (${s.ratioNow.toFixed(2)} Tyts par humain ${s.canonRatio ? '✓' : '✗'}).<br>` +
      `Le contrôle se délite dès <b>${yr(s.thawYear)}</b>, tombe à 50 % en <b>${yr(s.thawHalf)}</b> ; point de bascule (combattants éveillés > gardes) : <b>${yr(s.tippingYear)}</b>.`;
    this.drawPopCharts(); const yy = Math.floor(this.target / DAYS_PER_YEAR); this.popAtDate(yy); this.popCursor(yy, false);
  }

  drawPopCharts() {
    const m = this.pop, S = m.series, y0 = S.year[0], y1 = S.year[S.year.length - 1];
    const setup = (id) => { const cv = $(id), dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth || 320, H = 130; cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); return { g, W, H }; };
    const X = (W, y) => 34 + ((y - y0) / (y1 - y0)) * (W - 42);
    const frame = (g, W, H, ticks) => { g.strokeStyle = 'rgba(160,185,230,.2)'; g.fillStyle = '#8d9bb8'; g.font = '10px system-ui'; g.lineWidth = 1; for (const [y, lab] of [[-500, '−500'], [-300, '−300'], [0, '0'], [60, '60']]) if (y >= y0 && y <= y1) { g.beginPath(); g.moveTo(X(W, y), 6); g.lineTo(X(W, y), H - 16); g.stroke(); g.fillText(lab, X(W, y) - 8, H - 4); } ticks(); };
    // 1) populations (échelle logarithmique)
    { const { g, W, H } = setup('#pop-c1'), lo = Math.log10(2000), hi = Math.log10(Math.max(2e6, ...S.H, ...S.T)), Y = (v) => 6 + (1 - (Math.log10(Math.max(v, 2000)) - lo) / (hi - lo)) * (H - 22);
      frame(g, W, H, () => { for (const v of [1e4, 1e5, 1e6]) { g.beginPath(); g.moveTo(34, Y(v)); g.lineTo(W - 8, Y(v)); g.stroke(); g.fillText(v >= 1e6 ? '1 M' : v >= 1e5 ? '100 k' : '10 k', 2, Y(v) + 3); } });
      for (const [arr, col] of [[S.H, '#ffbf6b'], [S.T, '#6fd3a0']]) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); S.year.forEach((y, i) => { const px = X(W, y), py = Y(arr[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); }
      g.fillStyle = '#ffbf6b'; g.fillText('humains', W - 90, 16); g.fillStyle = '#6fd3a0'; g.fillText('Tyts', W - 90, 28); this._pc1 = { W, H, X }; }
    // 2) dynamique (0–1)
    { const { g, W, H } = setup('#pop-c2'), Y = (v) => 6 + (1 - v) * (H - 22);
      frame(g, W, H, () => { for (const v of [0, 0.5, 1]) { g.beginPath(); g.moveTo(34, Y(v)); g.lineTo(W - 8, Y(v)); g.stroke(); g.fillText(`${v * 100}%`, 2, Y(v) + 3); } });
      for (const [arr, col, lab, dy] of [[S.C, '#6fb4ff', 'contrôle', 16], [S.D, '#ff6b7a', 'désespoir', 28], [S.A, '#6fd3a0', 'Tyts éveillés', 40]]) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); S.year.forEach((y, i) => { const px = X(W, y), py = Y(arr[i]); i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.stroke(); g.fillStyle = col; g.fillText(lab, W - 90, dy); }
      this._pc2 = { W, H, X }; }
  }

  popCursor(year, redraw = true) {
    if (!this.pop) return;
    if (redraw) this.drawPopCharts();
    for (const [id, key] of [['#pop-c1', '_pc1'], ['#pop-c2', '_pc2']]) {
      const o = this[key]; if (!o) continue; const cv = $(id), g = cv.getContext('2d'), dpr = cv.width / o.W, ys = this.pop.series.year;
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.strokeStyle = '#fff'; g.lineWidth = 1.5; const x = o.X(o.W, Math.max(ys[0], Math.min(ys[ys.length - 1], year))); g.beginPath(); g.moveTo(x, 4); g.lineTo(x, o.H - 16); g.stroke();
    }
  }

  /** Valeurs du modèle à la date de la frise + curseur sur les courbes. */
  popAtDate(year) {
    if (!this.pop) return;
    const a = this.pop.at(year), f = (x) => Math.round(x).toLocaleString('fr-FR'), pc = (x) => (x * 100).toFixed(x < 0.1 ? 1 : 0) + ' %', cl = (c) => (c > 0.8 ? 'ok' : c > 0.4 ? 'warn' : 'bad');
    $('#pop-at').innerHTML = !a.arrived ? `<tr><td colspan="2">An ${String(year).replace('-', '−')} : l'arche est en route, personne dans le système.</td></tr>` :
      [['Humains', f(a.H)], ['Tyts', f(a.T)], ['Tyts par humain', a.ratio.toFixed(2)], ['Savoir de contrôle', pc(a.K)], ['Contrôle effectif', `<span class="${cl(a.C)}">${pc(a.C)}</span>`], ['Désespoir des Tyts', pc(a.D)], ['Tyts éveillés', pc(a.A)], ['Révoltes par an', a.revolts.toFixed(2)], ['Rapport de force (combattants / gardes)', `<span class="${a.bascule >= 1 ? 'bad' : a.bascule > 0.5 ? 'warn' : 'ok'}">${a.bascule.toFixed(2)}</span>`]].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
    this._popYear = year;
  }

  // ---------- Réseau de communication ----------
  buildNet() {
    $('#net-origin').innerHTML = SITES.map((x) => `<option value="${x.id}" ${x.id === 'roushan-cites' ? 'selected' : ''}>${x.name}</option>`).join('');
    $('#net-go').addEventListener('click', () => this.runNet());
    $('#net-stop').addEventListener('click', () => this.stopNet());
  }

  stopNet() { this.net = null; $('#net-stop').hidden = true; this.world.siteEls?.forEach((r) => r.el.style.removeProperty('--c')); }

  runNet() {
    const w = this.world, pos = new Map(); this.sim.computeRender(this.target);
    const sctx = w.siteCtx(); for (const x of SITES) pos.set(x.id, (w.siteEls.get(x.id)?.st || siteState(sctx, x, this.target)).pos.slice());
    const horizon = +$('#net-h').value, mode = $('#net-mode').value;
    const res = simulateSpread({ sites: SITES, pos, origin: $('#net-origin').value, mode, topology: $('#net-topo').value, hopMin: +$('#net-hop').value || 0, detectMin: +$('#net-det').value || 0, horizonDays: horizon });
    this.net = { res, t0: this.target, horizon };
    $('#net-stop').hidden = false;
    this.renderNet(res);
    // lecture : l'horizon défile en ~30 s
    const need = horizon / 30; let best = 0, gap = Infinity; SPEEDS.forEach(([d], i) => { const g = Math.abs(Math.log(d / need)); if (g < gap) { gap = g; best = i; } });
    this.speedIdx = best; $('#speed').value = best; $('#speed-out').textContent = SPEEDS[best][1]; this.playing = true; $('#play').textContent = '❚❚';
  }

  renderNet(res) {
    const dur = (d) => fmtDuree(d, { minutes: true }), pc = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0)} %`, sm = res.summary;
    const hubName = SITES.find((x) => x.id === res.hub).name;
    $('#net-sum').innerHTML = `Le Consortium (${hubName}) reçoit le message ${dur(res.tHub)} après l'envoi et ordonne la coupure ${dur(res.killAtHub - res.tHub)} plus tard ; l'ordre voyage à la lumière.<br>` +
      `<b>${sm.reached}/${sm.total}</b> sites reçoivent le message avant l'ordre de coupure. Humains informés : ${sm.h10 != null ? '10 % en ' + dur(sm.h10) : '10 % jamais'}, ${sm.h50 != null ? '50 % en ' + dur(sm.h50) : '50 % jamais'} ; à l'horizon <b>${pc(sm.finalH)}</b> des humains et <b>${pc(sm.finalT)}</b> des Tyts.`;
    const rows = [...res.nodes].sort((a, b) => a.tReceive - b.tReceive).map((n) => `<tr><td>${n.name}</td><td>${dur(n.tReceive)}</td><td>${dur(n.tKill)}</td><td class="${n.beforeKill ? 'ok' : 'warn'}">${n.beforeKill ? 'avant' : 'après'}</td><td>${pc(n.finalH)}</td><td>${n.tyts ? pc(n.finalT) : '—'}</td></tr>`).join('');
    $('#net-tab').innerHTML = `<tr><th>Site</th><th>Reçu</th><th>Coupure</th><th>Msg/coupure</th><th>Humains</th><th>Tyts</th></tr>${rows}`;
    this.drawNetChart(res);
  }

  drawNetChart(res) {
    const cv = $('#net-chart'), dpr = Math.min(window.devicePixelRatio || 1, 2), W = cv.clientWidth || 320, H = 150;
    cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const L = 34, R = 8, T = 8, B = 20, tmin = Math.log10(1 / 1440), tmax = Math.log10(res.horizonDays), X = (t) => L + (Math.log10(Math.max(t, 1 / 1440)) - tmin) / (tmax - tmin) * (W - L - R), Y = (f) => T + (1 - f) * (H - T - B);
    g.strokeStyle = 'rgba(160,185,230,.2)'; g.fillStyle = '#8d9bb8'; g.font = '10px system-ui'; g.lineWidth = 1;
    for (const f of [0, 0.5, 1]) { g.beginPath(); g.moveTo(L, Y(f)); g.lineTo(W - R, Y(f)); g.stroke(); g.fillText(`${f * 100}%`, 2, Y(f) + 3); }
    for (const [t, lab] of [[1 / 1440, '1 min'], [1 / 24, '1 h'], [1, '1 j'], [7, '7 j'], [30, '30 j'], [365, '1 an']]) if (t <= res.horizonDays) { g.beginPath(); g.moveTo(X(t), T); g.lineTo(X(t), H - B); g.stroke(); g.fillText(lab, X(t) - 8, H - 6); }
    g.strokeStyle = '#ff6b7a'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(res.killAtHub), T); g.lineTo(X(res.killAtHub), H - B); g.stroke(); g.setLineDash([]); g.fillStyle = '#ff6b7a'; g.fillText('ordre de coupure', Math.min(W - 80, X(res.killAtHub) + 3), T + 9);
    for (const [key, col] of [['humans', '#ffbf6b'], ['tyts', '#6fd3a0']]) { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); res.curve.forEach((c, i) => { const x = X(c.t), y = Y(c[key]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
    g.fillStyle = '#ffbf6b'; g.fillText('humains', W - 90, T + 22); g.fillStyle = '#6fd3a0'; g.fillText('Tyts', W - 90, T + 34);
  }

  updateNetMarkers() {
    const n = this.net; if (!n) return; const tau = this.target - n.t0;
    for (const node of n.res.nodes) {
      const rec = this.world.siteEls.get(node.id); if (!rec) continue;
      let c;
      if (tau < node.tReceive) c = '#5a6070'; // pas encore atteint
      else { const f = node.f(tau); c = node.beforeKill || tau < node.tKill ? mixHex('#ffd27a', '#9ff0ff', Math.min(1, f * 2)) : f < 0.05 ? '#ff6b7a' : mixHex('#ff9a6b', '#9ff0ff', Math.min(1, f * 1.5)); }
      rec.el.style.setProperty('--c', c);
    }
  }

  // ---------- Vue à hauteur d'yeux ----------
  bindGround() {
    $('#ground-btn').addEventListener('click', () => this.enterGround());
    $('#gh-exit').addEventListener('click', () => this.exitGround());
    document.querySelectorAll('#ground-hud [data-look]').forEach((b) => b.addEventListener('click', () => this.world.ground?.lookAt(b.dataset.look)));
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.world.ground?.active) this.exitGround(); });
  }

  enterGround() {
    const site = this.currentSite(); if (!site || !this.world.enterGround(site)) return;
    document.body.classList.add('ground'); $('#ground-hud').hidden = false; $('#ground-hud').classList.toggle('porthole', site.type === 'orbit');
    $('#gh-site').textContent = site.name + (site.type === 'orbit' ? ' — hublot' : ' — à hauteur d\'yeux'); this.ghAcc = 1;
    $('#ground-hud [data-look="parent"]').hidden = !(site.type !== 'heliocentric' && this.sim.bodies[this.world.siteEls.get(site.id).st.idx]?.type === 'moon');
    this.ghAcc = 1;
  }

  exitGround() { this.world.exitGround(); document.body.classList.remove('ground'); $('#ground-hud').hidden = true; }

  updateGround(dt) {
    this.ghAcc = (this.ghAcc || 0) + dt; if (this.ghAcc < 0.1) return; this.ghAcc = 0;
    const gi = this.world.groundInfo; if (!gi) return;
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'], az = gi.azimuth;
    $('#gh-heading').textContent = `CAP ${az.toFixed(0).padStart(3, '0')}° ${dirs[Math.round(az / 45) % 8]}`;
    const g = this.world.ground, site = g.site, parts = [`Étoile à ${gi.sunDeg.toFixed(0)}°`];
    g.showNames = $('#gh-names').checked; g.showCards = $('#gh-cards').checked;
    if (g.horizon) parts.push(`horizon à ${(g.horizon / 1000).toFixed(g.horizon > 10000 ? 0 : 1)} km`);
    if (gi.eclipse) parts.push(`éclipse : ${gi.eclipse.by} masque ${(gi.eclipse.fraction * 100).toFixed(0)} %`);
    parts.push(`champ ${g.fov.toFixed(0)}°`); $('#gh-info').textContent = parts.join(' · ');
    void site;
  }

  // ---------- Voyage animé du Mai ----------
  bindVoyage() {
    $('#tr-launch').addEventListener('click', () => this.startVoyage());
    $('#voy-follow').addEventListener('click', () => { this.world.focusOnShip(); this.selected = this.selected; });
    $('#voy-cancel').addEventListener('click', () => this.cancelVoyage());
    this.world.onShipClick = () => this.world.focusOnShip();
  }

  startVoyage() {
    const site = this.currentSite(), dest = SITES.find((x) => x.id === $('#tr-dest').value), key = $('#tr-prop').value, prop = PROPULSION[key];
    if (!site || !dest || prop.mode !== 'cruise') return;
    const w = this.world, t0 = this.target, accG = parseFloat($('#tr-acc').value) > 0 ? parseFloat($('#tr-acc').value) : prop.acc;
    this.sim.computeRender(t0);
    const snap = makeSnapshot(this.sim, t0, this.rotParams());
    const A0 = w.siteEls.get(site.id).st.pos.slice();
    const v = planVoyage({ A0, tDep: t0, destPosAt: (t) => siteState(ctxAt(snap, t), dest, t).pos, aG: accG, vmax: prop.vmax, opts: { maxBurnDays: prop.maxDays || 6, restDays: 1 } });
    w.setShip(v, () => w.siteEls.get(dest.id)?.st?.pos || null);
    this.voyage = { v, site, dest, key, accG, prop };
    // vitesse de lecture : le trajet dure ~30 s à l'écran
    const need = (v.tArr - v.tDep) / 30; let best = 0, gap = Infinity;
    SPEEDS.forEach(([d], i) => { const g = Math.abs(Math.log(d / need)); if (g < gap) { gap = g; best = i; } });
    this.speedIdx = best; $('#speed').value = best; $('#speed-out').textContent = SPEEDS[best][1];
    this.playing = true; $('#play').textContent = '❚❚';
    $('#voyage').hidden = false; w.focusOnShip(); this.voyageAcc = 1;
  }

  cancelVoyage(arrived = false) {
    if (!this.voyage) return;
    const dest = this.voyage.dest; this.world.setShip(null); this.voyage = null; $('#voyage').hidden = true;
    if (arrived) this.selectSite(dest.id); else if (this.world.rig.focusIdx < 0) this.select(this.selected, true);
  }

  updateVoyage() {
    const vy = this.voyage, sh = this.world.ship; if (!vy || !sh?.state) return;
    const st = sh.state, v = vy.v, d = v.dMeters / 1000;
    if (st.done) { this.cancelVoyage(true); return; }
    const phases = { accel: 'Accélération', rest: 'Repos moteur (refroidissement)', decel: 'Freinage', cruise: 'Croisière', arrivee: 'Arrivée' };
    const o = this.world.siteEls.get(vy.site.id)?.st?.pos, de = this.world.siteEls.get(vy.dest.id)?.st?.pos, dist = (a, b) => Math.hypot(...[0, 1, 2].map((k) => a[k] - b[k])) * 8.3167;
    const dur = fmtSecondes;
    const maxB = (vy.prop.maxDays || 6) * 86400, burnPct = Math.min(100, st.burn / maxB * 100);
    const min = (mt) => { const m = enSecondesKebet(mt * 60) / 60; return (m < 1 ? `${(m * 60).toFixed(0)} s` : m < 120 ? `${m.toFixed(1)} min` : `${(m / 60).toFixed(1)} h`) + ` (${fmtTerre(mt / 1440)} Terre)`; };
    $('#voy-body').innerHTML = `<p><b>${vy.site.name}</b> → <b>${vy.dest.name}</b></p><div class="bar"><i style="width:${(st.progress * 100).toFixed(1)}%"></i></div><dl>` +
      row('Phase', phases[st.phase] || st.phase, st.phase === 'rest' ? 'warn' : '') + row('Écoulé / total', `${dur(st.elapsed)} / ${dur(v.plan.total)}`) +
      row('Vitesse', `${(st.speed / 1000).toFixed(0)} km/s (${(st.speed / 299792458 * 100).toFixed(2)} % de c)`) + row('Accélération', `${vy.accG} g`) +
      row('Distance restante', `${((1 - st.progress) * d / 1e6).toFixed(1)} M km`) +
      row('Poussée continue', `${dur(st.burn)} / ${dur(maxB)} max`, burnPct > 85 ? 'warn' : '') +
      (o ? row('Délai de message → ' + vy.site.name, min(dist(sh.pos, o))) : '') + (de ? row('Délai de message → ' + vy.dest.name, min(dist(sh.pos, de))) : '') + '</dl>' +
      (v.plan.hasRest ? `<p class="note">Plus de ${dur(maxB)} de poussée : le moteur est coupé au milieu du trajet (repos supposé de ${dur(86400)}) pour éviter la surchauffe.</p>` : '');
  }

  // ---------- Ciel, fiche de scène, éphémérides ----------
  fmtT(t) {
    const { an, jour, h } = decouperDate(t);
    return `An ${String(an).replace('-', '−')} · jour ${jour} · ${String(h).padStart(2, '0')} h`;
  }
  rotParams() { return this.world.bodies.map((o) => ({ phase0: o.phase0, protDays: o.protDays })); }

  bindSiteTools() {
    // vue du ciel interactive : glisser = tourner/incliner, molette ou pincement = champ ; « Libre » prend le relais des centrages
    this.skyOpt = { center: 'star', fov: 180, az: 0, el: null };
    $('#sky-center').addEventListener('change', () => { this.skyOpt.center = $('#sky-center').value; this.skyOpt.el = null; this.drawSkyNow(); });
    $('#sky-fov').addEventListener('change', () => { if ($('#sky-fov').value !== 'custom') this.skyOpt.fov = +$('#sky-fov').value; this.drawSkyNow(); });
    const cv = $('#sky'), ptrs = new Map(); let pinch = 0;
    const setFov = (f) => {
      this.skyOpt.fov = Math.max(20, Math.min(360, f)); const sel = $('#sky-fov'), o = sel.querySelector('option[value="custom"]');
      o.textContent = `${this.skyOpt.fov.toFixed(0)}°`; o.hidden = false; sel.value = Object.values(sel.options).some((x) => x.value === String(Math.round(this.skyOpt.fov)) && x.value !== 'custom') ? String(Math.round(this.skyOpt.fov)) : 'custom';
    };
    const toFree = () => { if (this.skyOpt.center !== 'free') { this.skyOpt.center = 'free'; this.skyOpt.az = this._skyLast?.center ?? 0; $('#sky-center').value = 'free'; } if (this.skyOpt.el == null) this.skyOpt.el = this._skyLast?.elC ?? 0; };
    cv.style.touchAction = 'none'; cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    cv.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      const ppr = this._skyLast?.ppr || 100;
      if (ptrs.size === 1) { toFree(); this.skyOpt.az -= dx / ppr; this.skyOpt.el = Math.max(-1.4, Math.min(1.4, this.skyOpt.el + dy / ppr)); }
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) setFov(this.skyOpt.fov * pinch / d); pinch = d; }
      this.drawSkyNow();
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = 0; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); setFov(this.skyOpt.fov * Math.exp(e.deltaY * 0.001)); this.drawSkyNow(); }, { passive: false });
    cv.addEventListener('dblclick', () => { this.skyOpt = { center: 'star', fov: 180, az: 0, el: null }; $('#sky-center').value = 'star'; $('#sky-fov').value = '180'; this.drawSkyNow(); });
    $('#scene-box').addEventListener('toggle', () => { if ($('#scene-box').open) this.refreshScene(); });
    $('#scene-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(this.sceneText || ''); $('#scene-copy').textContent = 'Copié ✓'; } catch { $('#scene-copy').textContent = 'Copie impossible'; }
      setTimeout(() => ($('#scene-copy').textContent = 'Copier le texte'), 1800);
    });
  }

  drawSkyNow() {
    const site = this.currentSite(), rec = site && this.world.siteEls?.get(site.id);
    if (!rec?.st || !$('#sky-box').open) return;
    const sky = computeSky(this.sim, site, rec.st), body = site.type === 'heliocentric' ? null : this.sim.bodies[rec.st.idx];
    const P = body?.def.habitat?.pressureBar ?? 0, atm = body?.def.kind === 'gas' ? 'gas' : P >= 0.3 ? 'earth' : P > 0 ? 'thin' : 'none';
    const parentName = body ? (body.type === 'moon' ? this.sim.bodies[body.parent].def.name : body.def.name) : null;
    this._skyLast = drawSky($('#sky'), sky, { center: this.skyOpt.center, centerAz: this.skyOpt.az, elCenter: this.skyOpt.el ?? undefined, fov: this.skyOpt.fov, atm, surface: site.type === 'surface' || site.type === 'floating', parentName });
    const el = sky.sunEl * 180 / Math.PI;
    $('#sky-info').innerHTML = `Étoile à ${el.toFixed(0)}°${sky.eclipse ? ` — <b>éclipse : ${sky.eclipse.by} masque ${(sky.eclipse.fraction * 100).toFixed(0)} % de l'étoile</b>` : ''}`;
  }

  refreshScene() {
    const site = this.currentSite(), rec = site && this.world.siteEls?.get(site.id);
    if (!rec?.st || !$('#scene-box').open) return;
    const sim = this.sim, w = this.world, body = site.type === 'heliocentric' ? null : sim.bodies[rec.st.idx];
    const report = siteReport({ sim, el: (i) => w.bodies[i].el }, site, rec.st, this.target), sky = computeSky(sim, site, rec.st);
    const dayD = !body ? 1 : body.type === 'moon' ? (w.bodies[body.idx].el?.period || 1) : site.type === 'orbit' ? 1 : (w.bodies[body.idx].protDays || 1);
    const horizon = Math.min(130, Math.max(3, dayD * 1.2 + 0.3));
    let events = [];
    if (body) events = runEphemeris(sim, horizon, { rot: this.rotParams(), site, kinds: { eclipses: true, sun: true, alignments: false, apsides: false }, max: 80 })
      .filter((e) => (/étoile/.test(e.type) ? e.who === site.name : e.who === body.def.name)).map((e) => ({ ...e, t: e.t }));
    const refs = ['kebet-orbite', 'roushan-cites', 'sethis-cite-a', 'naksun-octroi', 'roukir-poste'].filter((id) => id !== site.id);
    const comms = refs.map((id) => { const o = w.siteEls.get(id)?.st; if (!o) return null; return { name: SITES.find((x) => x.id === id).name, minutes: Math.hypot(...[0, 1, 2].map((k) => o.pos[k] - rec.st.pos[k])) * 8.3167 }; }).filter(Boolean);
    const title = `${site.name} — ${body ? body.def.name : 'ceinture'} · ${this.fmtT(this.sim.t)}`;
    const sc = buildScene({ site, sky, report, events, t: this.sim.t, comms, title });
    this.sceneText = sc.text;
    $('#scene-out').innerHTML = `<p><b>${sc.title}</b></p>` + sc.blocks.map((b) => `<h4>${b.h}</h4><ul>${b.lines.map((l) => `<li>${l}</li>`).join('')}</ul>`).join('');
  }

  buildEphem() {
    const names = this.sim.bodies.slice(1).map((b) => b.def.name);
    $('#eph-body').innerHTML = '<option value="*">Tous</option>' + names.map((n) => `<option ${n === 'Kebet' ? 'selected' : ''}>${n}</option>`).join('');
    $('#eph-go').addEventListener('click', () => this.computeEphem());
  }

  computeEphem() {
    const note = $('#eph-note'), list = $('#eph-list'); note.textContent = 'Calcul…'; list.innerHTML = '';
    setTimeout(() => {
      const site = this.currentSite(), t0 = performance.now();
      const kinds = { eclipses: $('#eph-ecl').checked, sun: $('#eph-sun').checked && !!site, alignments: $('#eph-ali').checked, apsides: $('#eph-aps').checked };
      const sel = $('#eph-body').value;
      let ev = runEphemeris(this.sim, +$('#eph-h').value, { rot: this.rotParams(), site, kinds, max: 8000 });
      if (sel !== '*') ev = ev.filter((e) => e.who === sel || e.by === sel || (/étoile/.test(e.type) && site && this.sim.bodies.find((b) => b.def.name === sel)?.def.name === site.body));
      const now = this.sim.t, more = ev.length > 150;
      note.textContent = `${ev.length} événement(s) en ${((performance.now() - t0) / 1000).toFixed(1)} s${more ? ' (150 premiers affichés)' : ''}.${$('#eph-sun').checked && !site ? ' Choisis un site au sol pour les levers et couchers.' : ''} Cliquer saute à la date (la ceinture est regénérée).`;
      list.innerHTML = ev.slice(0, 150).map((e) => {
        const detail = e.duration != null ? `${e.who} ← ${e.by}, ${fmtDuree(e.duration, { minutes: true })}` : e.by ? `${e.who} – ${e.by}` : e.who;
        const dt = e.t - now;
        return `<li><button type="button" data-t="${e.t}"><span><b>${e.type}</b> · ${detail}</span><small>${this.fmtT(e.t)} · dans ${fmtDuree(dt)}</small></button></li>`;
      }).join('');
      list.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.goToTime(+b.dataset.t)));
    }, 30);
  }

  // ---------- Sites ----------
  currentSite() { return SITES.find((x) => x.id === this.selectedSite); }

  selectSite(id) {
    const site = SITES.find((x) => x.id === id), w = this.world;
    this.selectedSite = id;
    if (site.type === 'heliocentric') { this.selected = 0; w.focusOn(0, 3 * UNIT); } else { this.selected = w.bodies.find((o) => o.name === site.body).idx; w.focusOn(this.selected); }
    this.markList(); this.buildTransfer(); this.renderInfo();
    $('#site-tools').hidden = false; this.skyAcc = 1; this.sceneAcc = 9;
    this.closeLeftOnMobile();
  }

  buildTransfer() {
    const site = this.currentSite(), box = $('#transfer');
    box.hidden = !site;
    if (!site) return;
    $('#tr-dest').innerHTML = SITES.filter((x) => x.id !== site.id).map((x) => `<option value="${x.id}">${x.name}</option>`).join('');
    $('#tr-prop').innerHTML = Object.entries(PROPULSION).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('');
    if (!this._trBound) {
      this._trBound = true;
      $('#tr-dest').addEventListener('change', () => this.updateTransfer());
      $('#tr-prop').addEventListener('change', () => { const p = PROPULSION[$('#tr-prop').value]; $('#tr-acc').value = p.acc ?? ''; $('#tr-acc').disabled = p.mode !== 'cruise'; this.updateTransfer(); });
      $('#tr-acc').addEventListener('input', () => this.updateTransfer());
    }
    { const p = PROPULSION[$('#tr-prop').value]; if (!$('#tr-acc').value) $('#tr-acc').value = p.acc ?? ''; $('#tr-acc').disabled = p.mode !== 'cruise'; }
    this.updateTransfer();
  }

  updateTransfer() {
    const site = this.currentSite(); if (!site || !this.world.siteEls) return;
    const dest = SITES.find((x) => x.id === $('#tr-dest').value), key = $('#tr-prop').value;
    const a = this.world.siteEls.get(site.id)?.st, b = this.world.siteEls.get(dest?.id)?.st;
    if (!a || !b) return;
    $('#tr-launch').disabled = PROPULSION[key].mode !== 'cruise';
    const accIn = parseFloat($('#tr-acc').value);
    const r = transfer({ sim: this.sim }, site, a, dest, b, key, PROPULSION[key].mode === 'cruise' ? accIn : undefined), nf = (x, d = 1) => (Math.abs(x) >= 1e5 ? x.toExponential(2) : x.toFixed(d));
    const au = r.distKm / AU_KM;
    let h = `<dl>${row('Distance actuelle', au >= 0.01 ? `${nf(au, 3)} UA (${nf(r.distKm / 1e6, 1)} M km)` : `${nf(r.distKm, 0)} km`)}${row('Délai lumière (communications)', r.lightMin < 1 ? `${nf(r.lightMin * 60, 1)} s` : r.lightMin < 120 ? `${nf(r.lightMin, 1)} min` : `${nf(r.lightMin / 60, 1)} h`)}${row('Parcours', r.scope)}</dl>`;
    if (r.cruise) {
      const c = r.cruise;
      h += `<h3>${r.prop.label}</h3><dl>${row('Durée (retournement à mi-course)', fmtDur(c.days))}${row('Vitesse de pointe', `${nf(c.peakBeta, c.peakBeta < 0.01 ? 4 : 3)} c${c.cruised ? ' (croisière atteinte)' : ''}`)}${row('Accélération', `${nf(c.accG, 1)} g`)}`;
      if (r.prop.maxDays) h += row('Limite moteur (6 j continus)', c.overLimit ? `dépassée : ${c.restStops} arrêt(s) de refroidissement` : 'respectée', c.overLimit ? 'warn' : 'ok');
      h += `</dl><p class="note">Distance actuelle, sans courbure ni puits de gravité. Accélération supposée (le document fixe seulement les vitesses 0,1 c / 0,95 c et la limite de 6 jours). Navettes de montée/descente : ${nf(r.shuttle.dv, 2)} km/s, chimiques.</p>`;
    }
    const hh = r.hohmann;
    h += `<h3>${r.prop.mode === 'hohmann' ? r.prop.label : 'Référence chimique (Hohmann)'}</h3><dl>${row('Δv total', `${nf(hh.dv, 2)} km/s`)}${row('Durée', fmtDur(hh.days))}${row('Rapport de masse (Isp 450 s)', nf(hh.ratio, hh.ratio > 1e3 ? 0 : 1))}${r.windowDays != null ? row('Prochaine fenêtre', `dans ${fmtDur(r.windowDays)}`) + row('Période synodique', fmtDur(r.synodicDays)) : ''}</dl>`;
    h += `<ul class="sugg">${r.parts.map(([n, v]) => `<li>${n} : ${nf(v, 2)} km/s</li>`).join('')}</ul>`;
    const out = $('#tr-out'); if (out.dataset.h !== h) { out.innerHTML = h; out.dataset.h = h; }
  }

  siteHtml() {
    const site = this.currentSite(), rec = this.world.siteEls?.get(site.id);
    const type = { surface: 'Base au sol', orbit: 'Station orbitale', floating: 'Cité flottante', heliocentric: 'Repaire en orbite autour de l\'étoile' }[site.type];
    const yy = Math.floor(this.target / DAYS_PER_YEAR), pm = this.pop && yy !== 0 ? this.pop.at(yy) : null, p0 = this.pop?.at(0);
    const nf = (n) => n.toLocaleString('fr-FR'), tl = (...a) => this.tile(...a);
    let h = `<header class="hero"><span class="swatch site"></span><div><h2>${site.name}</h2><div class="sub">${type}${site.body !== 'Nunzir' ? ' · ' + site.body : ''}</div></div></header><p class="lead">${site.role}</p><div class="tiles">${tl(nf(site.population), 'Humains')}${site.tyts ? tl(nf(site.tyts), 'Tyts') : ''}${tl(site.body === 'Nunzir' ? 'Ceinture' : site.body, 'Corps')}</div>`;
    h += '\u0001'; // coupure : ce qui précède va au-dessus des outils du site
    if (site.founded != null && p0) { // colonie récente : fondée à l'An `founded`, croît ensuite avec la population du modèle
      const g = Math.max(0, Math.min(1, (yy - site.founded) / (0 - site.founded))), m = this.pop.at(yy);
      h += yy < site.founded ? `<p class="note">À l'An ${String(yy).replace('-', '−')} : la colonie n'est pas encore fondée (An ${String(site.founded).replace('-', '−')}).</p>` : `<p class="note">À l'An ${String(yy).replace('-', '−')} (colonie fondée An ${String(site.founded).replace('-', '−')}) : ≈ ${Math.round(site.population * g * m.H / p0.H).toLocaleString('fr-FR')} humains${site.tyts ? ' et ' + Math.round(site.tyts * g * m.T / p0.T).toLocaleString('fr-FR') + ' Tyts' : ''}.</p>`;
    } else if (pm && p0) h += pm.arrived ? `<p class="note">À l'An ${String(yy).replace('-', '−')} (modèle de population) : ≈ ${Math.round(site.population * pm.H / p0.H).toLocaleString('fr-FR')} humains${site.tyts ? ' et ' + Math.round(site.tyts * pm.T / p0.T).toLocaleString('fr-FR') + ' Tyts' : ''}.</p>` : `<p class="note">À l'An ${String(yy).replace('-', '−')} : personne n'est encore arrivé dans le système.</p>`;
    if (site.invented) h += `<p class="note">Emplacement et population proposés (le document ne les fixe pas) : à valider (données dans app/src/data/sites.js).</p>`;
    if (rec?.st) {
      const rep = siteReport({ sim: this.sim, el: (i) => this.world.bodies[i].el }, site, rec.st, this.target);
      for (const sec of rep.sections) h += this.begin(sec.title, true) + `<dl>${sec.rows.map(([k, v]) => row(k, v)).join('')}</dl></details>`;
      h += rep.notes.map((t) => `<p class="note">${t}</p>`).join('');
    }
    return h + '<div class="divider">Corps d\'accueil</div>';
  }

  markList() {
    this.world.siteEls?.forEach((rec, id) => rec.el.classList.toggle('sel', id === this.selectedSite));
    document.querySelectorAll('#list button').forEach((b) => {
      b.classList.toggle('sel', b.dataset.site ? b.dataset.site === this.selectedSite : !this.selectedSite && b.dataset.idx !== undefined && +b.dataset.idx === this.selected);
    });
  }

  bind() {
    const w = this.world, sim = this.sim;
    $('#play').addEventListener('click', () => { this.playing = !this.playing; $('#play').textContent = this.playing ? '❚❚' : '▶'; $('#play').setAttribute('aria-label', this.playing ? 'Pause' : 'Lecture'); });
    $('#speed').addEventListener('input', (e) => { this.speedIdx = +e.target.value; $('#speed-out').textContent = SPEEDS[this.speedIdx][1]; });
    $('#speed-out').textContent = SPEEDS[this.speedIdx][1];
    $('#info-live').addEventListener('toggle', (e) => { const t = e.target; if (t.dataset?.sec) (this.secState ||= {})[t.dataset.sec] = t.open; }, true);
    const tog = (id, fn) => $(id).addEventListener('change', (e) => fn(e.target.checked));
    tog('#t-orbits', (v) => (w.opts.orbits = v)); tog('#t-labels', (v) => (w.opts.labels = v));
    tog('#t-belt', (v) => (w.opts.belt = v)); tog('#t-edge', (v) => (w.opts.edge = v));
    tog('#t-gr', (v) => (this.sim.gr = v));
    const regen = () => { this.sim.makeParticles(+$('#n-ast').value, $('#t-trojans').checked, 1 + Math.floor(Math.random() * 1e6)); };
    tog('#t-trojans', regen);
    $('#n-ast').addEventListener('input', (e) => { $('#n-out').textContent = e.target.value; });
    $('#n-ast').addEventListener('change', regen);
    $('#reset').addEventListener('click', () => this.onReset && this.onReset());
    document.querySelectorAll('#views button').forEach((b) => b.addEventListener('click', () => this.view(b.dataset.view)));
    this.bindPanels();
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      if (e.code === 'Space') { e.preventDefault(); $('#play').click(); }
    });
  }
  // ---------- Panneaux repliables, options, interface masquable ----------
  closeLeftOnMobile() { if (window.innerWidth <= 860) { document.body.classList.add('hide-left'); this.syncPanels?.(); } }

  bindPanels() {
    const cl = document.body.classList, mobile = () => window.innerWidth <= 860;
    this.syncPanels = () => {
      $('#btn-bodies').setAttribute('aria-pressed', !cl.contains('hide-left')); $('#btn-info').setAttribute('aria-pressed', !cl.contains('hide-right'));
      const o = cl.contains('options-open'); $('#btn-options').setAttribute('aria-pressed', o); $('#btn-options-bar').setAttribute('aria-pressed', o);
    };
    if (mobile()) cl.add('hide-left', 'hide-right'); // sur téléphone : carte seule au départ, panneaux à la demande
    const toggle = (name) => {
      if (name === 'left') { cl.toggle('hide-left'); if (mobile() && !cl.contains('hide-left')) { cl.add('hide-right'); cl.remove('options-open'); } }
      else if (name === 'right') { cl.toggle('hide-right'); if (mobile() && !cl.contains('hide-right')) { cl.add('hide-left'); cl.remove('options-open'); } }
      else { cl.toggle('options-open'); if (mobile() && cl.contains('options-open')) cl.add('hide-left', 'hide-right'); }
      this.syncPanels();
    };
    $('#btn-bodies').addEventListener('click', () => toggle('left')); $('#btn-info').addEventListener('click', () => toggle('right'));
    $('#btn-options').addEventListener('click', () => toggle('options')); $('#btn-options-bar').addEventListener('click', () => toggle('options'));
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { const n = b.dataset.close; if (n === 'left') cl.add('hide-left'); else if (n === 'right') cl.add('hide-right'); else cl.remove('options-open'); this.syncPanels(); }));
    $('#btn-hide').addEventListener('click', () => { cl.add('ui-hidden'); }); $('#ui-show').addEventListener('click', () => cl.remove('ui-hidden'));
    addEventListener('keydown', (e) => {
      if (e.target.matches?.('input:not([type=range]), textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'h' || e.key === 'H') { cl.toggle('ui-hidden'); }
    });
    this.syncPanels();
  }

  view(name) {
    const w = this.world, rig = w.rig;
    if (name === 'system') { this.select(0, false); rig.focus(0, w.absPos(0), w.bodies[0].rUnits, 48 * UNIT); rig.el = 1.0; }
    else if (name === 'inner') { this.select(0, false); rig.focus(0, w.absPos(0), w.bodies[0].rUnits, 3.6 * UNIT); rig.el = 0.9; }
    else { const k = w.bodies.find((o) => o.name === 'Kebet').idx; this.select(k, true); }
  }

  select(idx, fly) {
    this.selected = idx;
    if (fly) this.world.focusOn(idx);
    this.selectedSite = null;
    this.markList();
    $('#transfer').hidden = true; $('#site-tools').hidden = true;
    this.renderInfo(true);
    if (fly) this.closeLeftOnMobile();
  }

  ctx() {
    const w = this.world, sim = this.sim;
    return { star: STAR, L: starLuminosity(STAR), hz: habitableZone(STAR), bodies: sim.bodies, mEff: sim.mEff, prot: (i) => w.bodies[i].protDays || 0, el: (i) => w.bodies[i].el };
  }

  habitabilityHtml(b) {
    const ctx = this.ctx(), lvl = { ok: 'ok', warn: 'warn', bad: 'bad', info: 'info' };
    if (b.type === 'star') {
      const rows = this.sim.bodies.slice(1).map((x) => { const a = assess(ctx, x.idx); return `<tr><td>${x.def.name}</td><td class="${lvl[a.level]}">${a.label}</td></tr>`; }).join('');
      const life = 10 * STAR.massMsun ** -2.5, zi = this.sim.bodies.find((x) => x.def.id === 'zirkan'), aZ = this.world.bodies[zi.idx].el?.a ?? zi.def.orbit.a;
      const exitGyr = (this.hz.seff.runaway * aZ * aZ / this.L - 1) / LUMINOSITY_GROWTH_PER_GYR, remain = life - (STAR.ageGyr ?? 3);
      const hum = SITES.reduce((t, x) => t + x.population, 0), tyt = SITES.reduce((t, x) => t + (x.tyts || 0), 0), kebet = SITES.filter((x) => x.body === 'Kebet').reduce((t, x) => t + x.population, 0);
      const demo = `<h3>Démographie des sites</h3><dl>${row('Humains', `${hum.toLocaleString('fr-FR')} (canon : 300 000 – 800 000)`, hum >= 3e5 && hum <= 8e5 ? 'ok' : 'warn')}${row('Tyts', tyt.toLocaleString('fr-FR'), tyt > hum * 0.3 ? 'ok' : 'warn')}${row('Haut (Kebet)', `${kebet.toLocaleString('fr-FR')} (canon : dizaines de milliers)`, kebet >= 1e4 && kebet <= 1e5 ? 'ok' : 'warn')}</dl><p class="note">Voyage des arches : 0,35 c × ~400 ans ≈ 140 années-lumière depuis la Terre.</p><h3>Âge du système</h3><dl>${row('Âge de l\'étoile', `${(STAR.ageGyr ?? 3).toFixed(2)} Gyr (An 0)`)}${row('Fin de séquence principale', `dans ${remain.toFixed(1)} Gyr`)}${row('Zirkan quitte la zone habitable', exitGyr > remain ? 'jamais avant la fin de l\'étoile' : `dans ${exitGyr.toFixed(1)} Gyr`, exitGyr > remain ? 'ok' : 'warn')}</dl><p class="note">L'étoile s'éclaircit avec l'âge (estimation +17,5 % par Gyr). Sur le temps du roman (quelques siècles), l'effet est nul.</p>`;
      return demo + `<h3>Habitabilité — synthèse</h3><table class="sum">${rows}</table><p class="note">Durée de vie de l'étoile ≈ ${life.toFixed(1)} Gyr, âge ${(STAR.ageGyr ?? 3).toFixed(1)} Gyr. Choisis un corps pour le détail et les ajustements.</p>`;
    }
    const a = assess(ctx, b.idx);
    let h = `<h3>Habitabilité humaine</h3><div class="hab ${a.level}">${a.label}</div><ul class="crit">`;
    for (const c of a.criteria) h += `<li><span class="s ${c.status}"></span><span>${c.label}</span><span class="v">${c.value}</span>${c.note ? `<small>${c.note}</small>` : ''}</li>`;
    h += '</ul>';
    if (a.mode === 'surface') {
      const key = `${b.idx}:${Math.round(this.sim.t / 365.25)}`;
      if (!this._scan || this._scan.key !== key || this._scan.sim !== this.sim) this._scan = { key, sim: this.sim, res: habitabilityScan(this.sim, b.idx, 5) };
      const r = this._scan.res, cl = { ok: 'ok', warn: 'warn', bad: 'bad' };
      h += `<h3>Habitable en permanence ? (${r.years} ans simulés)</h3><dl>${row('Température', `${r.T[0].toFixed(0)} – ${r.T[1].toFixed(0)} K`, cl[r.status.T])}${row('Flux stellaire', `${r.S[0].toFixed(2)} – ${r.S[1].toFixed(2)} × Terre`)}${row('Excentricité', `${r.e[0].toExponential(1)} – ${r.e[1].toExponential(1)}`)}${row('Chauffage de marée', `${r.heat[0].toFixed(2)} – ${r.heat[1].toFixed(2)} W/m²`, cl[r.status.heat])}${row('Verdict', r.always ? 'habitable en permanence' : 'pas toujours habitable', r.always ? 'ok' : 'warn')}</dl>`;
      h += `<p class="note">Le chauffage de marée varie comme e² : à e = 5·10⁻⁴ il atteindrait ~4 W/m² (volcanisme intense), à 3·10⁻³ ~150 W/m² (Io ≈ 2,4). Les marées amortissent e en ~16 000 ans ; sans résonance avec les autres lunes, e reste bas.${r.greenhouseNeeded > 0 ? ` Il manque ${r.greenhouseNeeded.toFixed(1)} K d'effet de serre pour que le minimum reste ≥ 278 K.` : r.T[0] < 280 ? ` Marge faible côté froid : minimum ${r.T[0].toFixed(1)} K pour un seuil de 278 K.` : ''}</p>`;
    }
    if (a.suggestions.length) h += `<h3>Pour ajuster</h3><ul class="sugg">${a.suggestions.map((t) => `<li>${t}</li>`).join('')}</ul>`;
    if (a.notes?.length) h += a.notes.map((t) => `<p class="note">${t}</p>`).join('');
    h += `<p class="note">Estimations de conception (analogies Terre/Jupiter/Io), pas un modèle climatique 3D.</p>`;
    return h;
  }

  // Durée du jour : sidéral (rotation propre) et solaire (d'un lever de l'étoile au suivant).
  dayRows(o, b) {
    const hours = (d) => { const k = d / jourKebet(); return (k * HEURES_PAR_JOUR < 48 ? `${f(k * HEURES_PAR_JOUR, 1)} h` : `${f(k, 2)} j (${f(k * HEURES_PAR_JOUR, 0)} h)`) + ` (${fmtTerre(d)} Terre)`; };
    const sid = b.type === 'moon' ? o.el?.period : o.protDays;
    if (!sid) return '';
    let year = null, rows = '';
    if (b.type === 'planet') year = o.el?.period;
    else if (b.type === 'moon') year = this.world.bodies[b.parent].el?.period;
    rows += row(b.type === 'moon' ? 'Rotation (synchrone, = orbite)' : 'Jour sidéral', hours(sid));
    if (b.type === 'star') return rows;
    if (year) {
      const solar = 1 / (1 / sid - 1 / year);
      rows += row('Jour solaire (lever à lever de l\'étoile)', hours(Math.abs(solar)) + (solar < 0 ? ' (rétrograde)' : ''));
      rows += row(b.type === 'moon' ? 'Année autour de l\'étoile' : 'Année', fmtDur(year));
      rows += row('Jours solaires par année', f(year / Math.abs(solar), 1));
    }
    if (b.type === 'planet' && b.def.rotation?.spinOrbitRatio) rows += row('Résonance spin-orbite', `${b.def.rotation.spinOrbitRatio}:1 (comme Mercure)`);
    if (b.type === 'moon') {
      const p = this.sim.bodies[b.parent];
      rows += row(`Jour vu depuis ${p.def.name}`, 'infini : ' + p.def.name + ' est fixe dans le ciel');
    }
    return rows;
  }

  /** Ouvre une section repliable de la fiche ; l'état ouvert/fermé choisi par l'utilisateur survit aux rafraîchissements. */
  begin(titre, ouvert) {
    const o = this.secState?.[titre] ?? ouvert;
    return `<details class="sec" data-sec="${titre}"${o ? ' open' : ''}><summary>${titre}</summary>`;
  }
  tile(valeur, libelle, sous = '') { return `<div class="tile"><b>${valeur}</b><span>${libelle}</span>${sous ? `<small>${sous}</small>` : ''}</div>`; }
  jourCourt(d) { const k = d / jourKebet(); return k * HEURES_PAR_JOUR < 48 ? `${f(k * HEURES_PAR_JOUR, 1)} h` : `${f(k, 2)} j`; }

  // Valeurs physiques dérivées en direct ; appelé ~4 fois par seconde.
  renderInfo() {
    const w = this.world, sim = this.sim, o = w.bodies[this.selected], b = o.b, d = b.def, star = sim.bodies[0];
    const rp = sim.rPos;
    const dStar = (i) => Math.hypot(rp[3 * i] - rp[0], rp[3 * i + 1] - rp[1], rp[3 * i + 2] - rp[2]);
    const names = d.names || {};
    let h = this.selectedSite ? this.siteHtml() : '';
    const kind = b.type === 'star' ? 'Étoile (F6V)' : b.type === 'planet' ? (d.kind === 'gas' ? 'Planète gazeuse' : 'Planète tellurique') : 'Lune de ' + sim.bodies[b.parent].def.name;
    const bk = bulk(b.mass, b.radiusKm), hab = b.type === 'star' ? null : assess(this.ctx(), b.idx);
    const sid = b.type === 'moon' ? o.el?.period : o.protDays, tile = (...a) => this.tile(...a);
    const di0 = b.type === 'star' ? 0 : dStar(b.type === 'planet' ? b.idx : b.parent);
    const tiles = b.type === 'star'
      ? tile(`${f(b.radiusKm / 1e3, 0)} k km`, 'Rayon') + tile(`${d.teff} K`, 'Température') + tile(`${f(this.L, 2)} L☉`, 'Luminosité') + tile(fmtMass(b.mass), 'Masse')
      : tile(`${f(bk.gSurf / 9.80665, 2)} g`, 'Gravité') + tile(sid ? this.jourCourt(sid) : '—', 'Jour', sid ? `${fmtTerre(sid)} Terre` : '') + tile(`${f(b.radiusKm, 0)} km`, 'Rayon') + tile(`${f(equilibriumTemp(star.def, di0, d.albedo ?? 0.3) - 273.15, 0)} °C`, 'T équilibre');
    h += `<header class="hero"><span class="swatch" style="background:${d.color || '#9fb4d8'}"></span><div><h2>${d.name}</h2><div class="sub">${kind}</div></div>${hab ? `<span class="chip ${hab.level}">${hab.label}</span>` : ''}</header><p class="lead">${d.role}</p><div class="tiles">${tiles}</div>`;
    h += this.begin('Noms', false) + `<dl>${row('Nom tyt sacré', names.tyt || '—')}${names.tytCourant && names.tytCourant !== names.tyt ? row('Courant', names.tytCourant) : ''}${names.sens ? row('Sens', `« ${names.sens} »`) : ''}</dl></details>`;
    h += this.begin('Physique', true) + `<dl>${row('Masse', fmtMass(b.mass))}${row('Rayon', `${f(b.radiusKm, 0)} km`)}${row('Densité', `${f(bk.rho, 2)} g/cm³`)}${row('Gravité de surface', `${f(bk.gSurf, 2)} m/s² (${f(bk.gSurf / 9.80665, 2)} g)`)}${row('Vitesse de libération', `${f(bk.vEsc, 2)} km/s`)}`;
    h += this.dayRows(o, b);
    if (o.protDays && b.type === 'planet' && o.flat > 1e-4) h += row('Aplatissement', f(o.flat, 4));
    if (b.type !== 'star') h += row('Inclinaison de l\'axe', `${f(b.tilt / DEG, 1)}°`);
    if (b.type === 'star') h += row('Température', `${d.teff} K`) + row('Luminosité', `${f(this.L, 2)} L☉`);
    h += '</dl></details>';
    if (b.type === 'star') {
      const hz = this.hz;
      h += this.begin('Zone habitable (Kopparapu 2013)', true) + `<dl>${row('Conservative', `${f(hz.conservative[0], 2)} – ${f(hz.conservative[1], 2)} UA`)}${row('Optimiste', `${f(hz.optimistic[0], 2)} – ${f(hz.optimistic[1], 2)} UA`)}${row('Ceinture Nunzir', `${BELT.aMin} – ${BELT.aMax} UA`)}</dl><p class="note">${BELT.role}</p></details>`;
    } else if (o.el) {
      const e = o.el, par = sim.bodies[b.parent];
      h += this.begin('Orbite (en direct)', true) + '<dl>';
      if (b.type === 'planet') {
        h += row('Demi-grand axe', `${f(e.a, 4)} UA`) + row('Distance actuelle', `${f(dStar(b.idx), 4)} UA`) + row('Périhélie / aphélie', `${f(e.rp, 3)} / ${f(e.ra, 3)} UA`);
        h += row('Période', fmtDur(e.period)) + row('Excentricité', f(e.e, 4)) + row('Inclinaison (écliptique)', `${f(e.i / DEG, 2)}°`) + row('Longitude du périhélie ϖ', `${f(((e.varpi / DEG) % 360 + 360) % 360, 3)}°`);
      } else {
        const pole = poleVector(par.tilt, par.node), hm = Math.hypot(...e.h);
        const inc = Math.acos((e.h[0] * pole[0] + e.h[1] * pole[1] + e.h[2] * pole[2]) / hm) / DEG;
        h += row('Demi-grand axe', `${f(e.a * AU_KM, 0)} km (${f(e.a * AU_KM / par.radiusKm, 1)} R)`) + row('Période', fmtDur(e.period)) + row('Excentricité', f(e.e, 4)) + row('Inclinaison (équateur)', `${f(inc, 2)}°`);
      }
      h += '</dl></details>';
      // dynamique
      if (b.type === 'planet') {
        const pa = par.def.orbit, rh = hillRadius(e.a, e.e, sim.mEff[b.idx], star.mass);
        h += this.begin('Dynamique', false) + `<dl>${row('Rayon de Hill', `${f(rh, 4)} UA (${f(rh * AU_KM / 1e6, 2)} M km)`)}</dl></details>`;
        void pa;
      } else {
        const pi = par.idx, pe = o && w.bodies[pi].el;
        const rh = hillRadius(pe.a, pe.e, sim.mEff[pi], star.mass), lim = stableSatelliteLimit(rh, pe.e, o.el.e);
        const rho = bulk(b.mass, b.radiusKm).rho, rhoP = bulk(par.mass, par.radiusKm).rho;
        const roche = rocheLimitKm(par.radiusKm, rhoP, rho), ratio = (o.el.a / rh);
        h += this.begin('Dynamique', false) + `<dl>${row('a / rayon de Hill', `${f(ratio, 3)} (limite ${f(lim / rh, 2)})`, o.el.a < lim ? 'ok' : 'warn')}${row('Limite de Roche', `${f(roche, 0)} km`, o.el.a * AU_KM > roche ? 'ok' : 'warn')}</dl></details>`;
      }
      // thermique
      const di = b.type === 'planet' ? dStar(b.idx) : dStar(b.parent);
      const Teq = equilibriumTemp(star.def, di, d.albedo ?? 0.3), S = insolation(this.L, di);
      const [hi, ho] = this.hz.conservative, [oi, oo] = this.hz.optimistic;
      const zone = di >= hi && di <= ho ? ['dans la zone habitable', 'ok'] : di >= oi && di <= oo ? ['zone habitable optimiste', 'ok'] : di < oi ? ['trop proche', 'warn'] : ['trop loin', 'warn'];
      h += this.begin('Thermique', false) + `<dl>${row('Éclairement', `${f(S, 3)} × Terre`)}${row('T équilibre (A=' + (d.albedo ?? 0.3) + ')', `${f(Teq, 0)} K (${f(Teq - 273.15, 0)} °C)`)}${row('Position', zone[0], zone[1])}</dl>`;
      if (d.id === 'kebet') h += `<p class="note">Kebet reçoit l'éclairement d'une planète en bordure de zone habitable ; la rotation synchrone et l'effet de serre de son atmosphère décident du reste.</p>`;
      h += '</details>';
    }
    h += this.begin('Habitabilité', true) + this.habitabilityHtml(b) + '</details>';
    let head = '';
    if (h.includes('\u0001')) [head, h] = h.split('\u0001');
    const hd = $('#info-head');
    if (hd.dataset.h !== head) { hd.innerHTML = head; hd.dataset.h = head; }
    this.info = h;
    const el = $('#info-live');
    if (el.dataset.h !== h) { const sc = el.scrollTop; el.innerHTML = h; el.dataset.h = h; el.scrollTop = sc; }
  }

  update(dt) {
    const sim = this.sim;
    if (this.playing) {
      this.target += SPEEDS[this.speedIdx][0] * dt;
      const limited = sim.advance(this.target, 9);
      if (limited) this.target = sim.t;
    }
    const t = this.target;
    if (!this.calculating) {
      const { an, jour, h, min, s } = decouperDate(t), p2 = (n) => String(n).padStart(2, '0');
      const clock = this.speedIdx <= 2 ? `${p2(h)}:${p2(min)}:${p2(s)}` : `${p2(h)} h`; // secondes seulement aux vitesses lisibles
      $('#date').textContent = `An ${String(an).replace('-', '−')} · jour ${jour} · ${clock}`;
    }
    this.friseUpdate(t / DAYS_PER_YEAR);
    if (this.voyage) { this.voyageAcc = (this.voyageAcc || 0) + dt; if (this.voyageAcc > 0.15) { this.voyageAcc = 0; this.updateVoyage(); } }
    if (this.world.ground?.active) this.updateGround(dt);
    this.netAcc = (this.netAcc || 0) + dt; if (this.net && this.netAcc > 0.2) { this.netAcc = 0; this.updateNetMarkers(); }
    this.skyAcc = (this.skyAcc || 0) + dt; this.sceneAcc = (this.sceneAcc || 0) + dt;
    if (this.selectedSite && this.skyAcc > 0.12) { this.skyAcc = 0; this.drawSkyNow(); }
    if (this.selectedSite && this.sceneAcc > 2.5) { this.sceneAcc = 0; this.refreshScene(); }
    this.sinceInfo = (this.sinceInfo || 0) + dt;
    if (this.sinceInfo > 0.25) {
      this.sinceInfo = 0;
      this.renderInfo(); this.updateTransfer();
      const dr = sim.drift(), spd = sim.measuredSpeed;
      $('#diag').innerHTML = `ΔE/E : ${dr.dE.toExponential(1)} · ΔL/L : ${dr.dL.toExponential(1)}<br>` +
        `Intégrateur : leapfrog symplectique, ${sim.tier === 1 ? 'N-corps complet (lunes incluses), pas ' + sim.h1.toFixed(3) + ' j' : 'planètes N-corps, lunes sur rails (Kepler), pas ' + sim.h2.toFixed(2) + ' j'}<br>` +
        `Vitesse calculée : ${spd > 0 ? (spd / DAYS_PER_YEAR).toFixed(1) + ' ans/s' : '—'}${sim.limited ? ' (limitée par le CPU)' : ''} · astéroïdes : ${sim.pN} · impacts : ${sim.impacts}`;
    }
    return t;
  }
}
