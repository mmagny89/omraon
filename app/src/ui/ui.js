import { G, AU_KM, DAYS_PER_YEAR, DEG, R_EARTH_KM, R_JUP_KM } from '../physics/constants.js';
import { poleVector } from '../physics/system.js';
import { equilibriumTemp, insolation, starLuminosity, habitableZone, hillRadius, stableSatelliteLimit, rocheLimitKm, bulk, fmtMass } from '../physics/derived.js';
import { BELT, STAR } from '../data/omraon.js';
import { assess, distanceForTemp } from '../physics/habitability.js';
import { SITES } from '../data/sites.js';
import { EVENTS, ERAS, eraAt, fmtAn, AN_PRESENT, systemAgeGyr, LUMINOSITY_GROWTH_PER_GYR } from '../data/chronologie.js';
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
import { encoderEtat, decoderEtat } from './lien.js';
import { etapesVisite } from './visite.js';
import { lire as lireCarnet, ecrire as ecrireCarnet, nouvelleScene, versMarkdown, slug } from './carnet.js';
import { STATUTS, statutSection } from './statut.js';
import { fusionner, liaison } from './comparaison.js';
import { PERSONNAGES, VESTIGES } from '../data/lore.js';
import { GLOSSAIRE } from '../data/glossaire.js';
import { glossaireComplet, filtrer, auLieu, moisConfederal } from './lore.js';
import { indexer, versFrancais, versTyt } from './traducteur.js';
import { esc, tipAttr, tipTexte, tipJauge, tipRepartition, initTooltips } from './tooltips.js';
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
const HUM_TOT = SITES.reduce((t, x) => t + x.population, 0), TYT_TOT = SITES.reduce((t, x) => t + (x.tyts || 0), 0);
/** Infobulle de population d'un site : répartition humains / Tyts et part du total du système. */
const popTip = (x) => tipRepartition({ titre: x.name, note: auLieu(PERSONNAGES, x.body, x.id).length ? `Personnages : ${auLieu(PERSONNAGES, x.body, x.id).map((p) => p.nom).join(', ')}` : '', parts: [
  { n: x.population, label: 'Humains', cls: 'h', partTotale: (x.population / HUM_TOT) * 100 },
  { n: x.tyts || 0, label: 'Tyts', cls: 't', partTotale: TYT_TOT ? ((x.tyts || 0) / TYT_TOT) * 100 : 0 }] });
const $ = (s) => document.querySelector(s);
const mixHex = (a, b, t) => { const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',')})`; };
const f = (x, d = 3) => (d === 0 ? Math.round(x).toLocaleString('fr-FR') : Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(2) : x.toFixed(d));
const fmtDur = (d) => fmtDuree(d);
const row = (k, v, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;

export class UI {
  constructor(sim, world) {
    this.sim = sim; this.world = world;
    recalerVitesses();
    initTooltips();
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
    const pop = (n) => (n >= 1e3 ? `${Math.round(n / 1e3)} k` : String(n));
    const siteBtn = (parent, x, cls = 'site') => btn(parent, cls, `<span class="ico">${x.type === 'orbit' ? '◇' : x.type === 'floating' ? '☁' : '▪'}</span>${x.name}${auLieu(PERSONNAGES, x.body, x.id).length ? `<small class="pj" aria-label="${auLieu(PERSONNAGES, x.body, x.id).length} personnage(s)">👤${auLieu(PERSONNAGES, x.body, x.id).length}</small>` : ''}<small>${pop(x.population)}</small>`, { site: x.id, tip: popTip(x) }, () => this.selectSite(x.id));
    const bodyBtn = (parent, b, cls) => {
      const dot = `<span class="dot" style="color:${b.def.color || '#ffe2b0'};background:${b.def.color || '#ffe2b0'}"></span>`;
      const pjs = auLieu(PERSONNAGES, b.def.name);
      return btn(parent, cls || b.type, `${dot}${b.def.name}${pjs.length ? `<small class="pj" aria-label="${pjs.length} personnage(s)">👤${pjs.length}</small>` : ''}`, pjs.length ? { idx: b.idx, tip: tipTexte(b.def.name, `Personnages : ${pjs.map((p) => p.nom).join(', ')}`) } : { idx: b.idx }, () => { this.select(b.idx, true); this.closeLeftOnMobile(); this.announce(`${b.def.name} sélectionné`); });
    };
    bodyBtn(group(), bodies[0]);
    bodies.filter((b) => b.type === 'planet').forEach((p) => {
      const g = group();
      bodyBtn(g, p);
      const own = sitesOf(p.def.name);
      const nMoons = bodies.filter((m) => m.type === 'moon' && m.parent === p.idx).length;
      if (own.length || nMoons) {
        const folded = this.listFolded?.has(p.def.id);
        g.classList.toggle('folded', !!folded);
        const t = mk(g, 'button', 'tgl'); t.type = 'button'; t.setAttribute('aria-label', `Replier ${p.def.name}`); t.setAttribute('aria-expanded', String(!folded));
        t.addEventListener('click', () => { const f = g.classList.toggle('folded'); t.setAttribute('aria-expanded', String(!f)); (this.listFolded ||= new Set())[f ? 'add' : 'delete'](p.def.id); });
      }
      if (own.length) { mk(g, 'div', 'sub', 'Villes et stations'); own.forEach((x) => siteBtn(g, x)); }
      const moons = bodies.filter((m) => m.type === 'moon' && m.parent === p.idx);
      if (moons.length) {
        mk(g, 'div', 'sub', 'Lunes');
        moons.forEach((m) => { bodyBtn(g, m); sitesOf(m.def.name).forEach((x) => siteBtn(g, x, 'site deep')); });
      }
      if (p.def.id === 'naksun') {
        const gb = group();
        btn(gb, 'belt', `<span class="dot" style="color:#c8c8d0;background:#c8c8d0"></span>${BELT.name} (ceinture)`, { belt: '1' }, () => { this.selectBelt(); this.closeLeftOnMobile(); this.announce(`${BELT.name}, ceinture : sélectionnée`); });
        const bs = sitesOf('Nunzir'); if (bs.length) { mk(gb, 'div', 'sub', 'Sites'); bs.forEach((x) => siteBtn(gb, x)); }
      }
    });
    list.querySelectorAll('button:not(.tgl)').forEach((e) => { e.dataset.q = e.textContent.toLowerCase(); });
    this.filterList();
    this.markList();
  }

  /** Filtre la liste : ne garde que les entrées dont le nom contient la saisie, avec leur planète pour le contexte. */
  filterList() {
    const q = ($('#list-q')?.value || '').trim().toLowerCase(), list = $('#list');
    list.classList.toggle('searching', !!q);
    let any = false;
    list.querySelectorAll('.grp').forEach((g) => {
      const btns = [...g.querySelectorAll('button:not(.tgl)')], hit = btns.filter((b) => !q || b.dataset.q.includes(q));
      g.hidden = !!q && !hit.length;
      btns.forEach((b) => { b.hidden = !!q && !hit.includes(b) && !b.matches('.planet, .star'); });
      g.querySelectorAll('.sub').forEach((x) => { x.hidden = !!q; });
      if (hit.length) any = true;
    });
    let none = $('#list-none');
    if (!none) { none = document.createElement('p'); none.id = 'list-none'; none.className = 'note'; none.textContent = 'Aucun résultat.'; list.after(none); }
    none.hidden = any || !q;
  }

  // ---------- Chronologie ----------
  buildChrono() {
    const Y0 = -960, Y1 = 60, pct = (y) => ((y - Y0) / (Y1 - Y0)) * 100, fr = $('#frise');
    const eras = [[-960, -560, 'out', 'Voyage des arches (hors système)'], [-560, -500, 'c1', 'La cohabitation'], [-500, -300, 'c2', 'Les Siècles Sombres'], [-300, 0, 'c3', 'Ère confédérale'], [0, 60, 'c4', 'Après le présent']];
    const labels = [[-960, 'Départ'], [-560, 'Arrivée'], [-500, 'Basculement'], [-300, 'Fin des Siècles Sombres'], [0, 'Présent']];
    fr.innerHTML = `<div class="read" id="frise-read"></div>` +
      `<div class="track" id="frise-track" role="slider" tabindex="0" aria-valuemin="${Y0}" aria-valuemax="${Y1}" aria-valuenow="0" aria-label="Date en années (An 0 = début de l\'Ère confédérale ; le présent est l\'An 300) ; flèches : ±1 an, Maj : ±10 ans">` +
      eras.map(([a, b2, c, t]) => `<div class="seg ${c}" style="width:${pct(b2) - pct(a)}%" data-tip="${esc(tipTexte(t))}"></div>`).join('') + '</div>' +
      EVENTS.map((e) => `<button type="button" class="tick" data-year="${e.year}" style="left:${pct(e.year)}%" data-tip="${esc(tipTexte(`${e.label} · ${fmtAn(e.year)}`, e.note))}" aria-label="${e.label}"></button>`).join('') +
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
    this.friseDom.read.innerHTML = `<b>${fmtAn(year)}</b> — ${era.label}${ev ? ` <span>· ${ev.label}</span>` : ''}${era.outside ? ' <span>· les arches sont en route, pas encore d\'humains</span>' : ''} <span>· âge du système ${systemAgeGyr(STAR, year).toFixed(6)} Gyr</span>`;
  }

  /** Place le curseur de la frise à la date simulée (appelé à chaque image). */
  friseUpdate(yearFloat) {
    if (!this.friseDom || this.friseDragging) return;
    const { cursor, track, Y0, Y1, pct } = this.friseDom, y = Math.max(Y0, Math.min(Y1, yearFloat));
    cursor.style.left = pct(y) + '%'; track.setAttribute('aria-valuenow', Math.round(yearFloat));
    const yi = Math.floor(yearFloat);
    if (yi !== this._friseYear) { this._friseYear = yi; this.friseLabel(yi); this.popAtDate(yi); this.popCursor(yi); }
  }

  /** Va à l'année donnée (0 = présent, affiché An 300) : recalcule les positions des planètes à cette date. */
  goTo(year) { this.friseLabel(year); this._friseYear = year; this.popAtDate(year); this.popCursor(year); this.goToTime(year * DAYS_PER_YEAR); }

  /** Saute à la date t (jours depuis le présent). */
  goToTime(t, silencieux = false) {
    this.cancelVoyage();
    this.calculating = true; $('#date').textContent = 'Calcul des positions…';
    setTimeout(() => {
      this.sim.jumpTo(t);
      this.target = this.sim.t;
      this.sim.computeRender(this.target);
      this.calculating = false; if (!silencieux) this.announce(`Date : ${this.fmtT(this.sim.t)}`);
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
      knowledgeHalfLife: v(g('#pop-know'), 220), controlNeeded: v(g('#pop-ctl'), 0.6), despairHalfLife: v(g('#pop-dh'), 460), truthYear: Number.isFinite(ty) ? ty - AN_PRESENT : 1e9, truthStrength: v(g('#pop-ts'), 0.6) };
  }

  recomputePop() {
    this.pop = simulatePopulation(this.readPop()); this._popYear = null;
    const m = this.pop, s = m.summary, f = (x) => Math.round(x).toLocaleString('fr-FR'), yr = (y) => (y == null ? 'jamais' : fmtAn(y));
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
    $('#pop-at').innerHTML = !a.arrived ? `<tr><td colspan="2">${fmtAn(year)} : l'arche est en route, personne dans le système.</td></tr>` :
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
    return `${fmtAn(an)} · jour ${jour} · ${String(h).padStart(2, '0')} h`;
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

  refreshScene(force = false) {
    const site = this.currentSite(), rec = site && this.world.siteEls?.get(site.id);
    if (!rec?.st || (!force && !$('#scene-box').open)) return;
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
    this.selectedSite = id; this.belt = false; this.announce(`${site.name} sélectionné`);
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
    let h = `<header class="hero"><span class="swatch site"></span><div><h2>${site.name}</h2><div class="sub">${type}${site.body !== 'Nunzir' ? ' · ' + site.body : ''}</div></div></header><p class="lead">${site.role}</p><div class="tiles">${tl(nf(site.population), 'Humains', '', popTip(site))}${tl(nf(site.tyts || 0), 'Tyts', '', popTip(site))}${tl(site.body === 'Nunzir' ? 'Ceinture' : site.body, 'Corps')}</div>`;
    h += '\u0001'; // coupure : ce qui précède va au-dessus des outils du site
    h += this.loreHtml(site.body, site.id);
    if (site.id === 'kebet-temples') h += this.liturgieHtml();
    if (site.founded != null && p0) { // colonie récente : fondée à l'An `founded`, croît ensuite avec la population du modèle
      const g = Math.max(0, Math.min(1, (yy - site.founded) / (0 - site.founded))), m = this.pop.at(yy);
      h += yy < site.founded ? `<p class="note">À l'${fmtAn(yy)} : la colonie n'est pas encore fondée (${fmtAn(site.founded)}).</p>` : `<p class="note">À l'${fmtAn(yy)} (colonie fondée ${fmtAn(site.founded)}) : ≈ ${Math.round(site.population * g * m.H / p0.H).toLocaleString('fr-FR')} humains${site.tyts ? ' et ' + Math.round(site.tyts * g * m.T / p0.T).toLocaleString('fr-FR') + ' Tyts' : ''}.</p>`;
    } else if (pm && p0) h += pm.arrived ? `<p class="note">À l'${fmtAn(yy)} (modèle de population) : ≈ ${Math.round(site.population * pm.H / p0.H).toLocaleString('fr-FR')} humains${site.tyts ? ' et ' + Math.round(site.tyts * pm.T / p0.T).toLocaleString('fr-FR') + ' Tyts' : ''}.</p>` : `<p class="note">À l'${fmtAn(yy)} : personne n'est encore arrivé dans le système.</p>`;
    if (site.invented) h += `<p class="note">Emplacement et population proposés (le document ne les fixe pas) : à valider (données dans app/src/data/sites.js).</p>`;
    if (rec?.st) {
      const rep = siteReport({ sim: this.sim, el: (i) => this.world.bodies[i].el }, site, rec.st, this.target);
      for (const sec of rep.sections) h += this.begin(sec.title, true, statutSection(sec.title)) + `<dl>${sec.rows.map(([k, v]) => row(k, v)).join('')}</dl></details>`;
      h += rep.notes.map((t) => `<p class="note">${t}</p>`).join('');
    }
    return h + '<div class="divider">Corps d\'accueil</div>';
  }

  markList() {
    this.world.siteEls?.forEach((rec, id) => rec.el.classList.toggle('sel', id === this.selectedSite));
    document.querySelectorAll('#list button').forEach((b) => {
      b.classList.toggle('sel', b.dataset.belt ? !!this.belt : b.dataset.site ? b.dataset.site === this.selectedSite : !this.selectedSite && !this.belt && b.dataset.idx !== undefined && +b.dataset.idx === this.selected);
    });
  }

  bind() {
    const w = this.world, sim = this.sim;
    $('#play').addEventListener('click', () => { this.playing = !this.playing; this.announce(this.playing ? 'Lecture' : 'Pause'); $('#play').textContent = this.playing ? '❚❚' : '▶'; $('#play').setAttribute('aria-label', this.playing ? 'Pause' : 'Lecture'); });
    $('#speed').addEventListener('input', (e) => { this.speedIdx = +e.target.value; $('#speed-out').textContent = SPEEDS[this.speedIdx][1]; });
    $('#speed-out').textContent = SPEEDS[this.speedIdx][1];
    this.bindLink();
    this.buildCompare();
    this.buildLore();
    this.bindCarnet();
    for (const a of document.querySelectorAll('a.skip')) a.addEventListener('click', (e) => { e.preventDefault(); document.querySelector(a.getAttribute('href'))?.focus(); }); // liens d'évitement sans toucher à l'adresse (#t=…)
    this.bindTour();
    $('#info-live').addEventListener('click', (e) => { const sb = e.target.closest?.('[data-site-open]'); if (sb) this.selectSite(sb.dataset.siteOpen); if (e.target.closest?.('[data-eclipse-vivre]') && this.selectedSite) this.vivreEclipse(this.selectedSite); });
    $('#info-live').addEventListener('click', (e) => { const t = e.target.closest?.('.evts button[data-t]'); if (t) this.goToTime(+t.dataset.t); });
    $('#list-q').addEventListener('input', () => this.filterList());
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
      if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) this.photo();
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
    this.selected = idx; this.belt = false;
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
      const demo = `<h3>Démographie des sites</h3><dl>${row('Humains', `${hum.toLocaleString('fr-FR')} (canon : 300 000 – 800 000)`, hum >= 3e5 && hum <= 8e5 ? 'ok' : 'warn')}${row('Tyts', tyt.toLocaleString('fr-FR'), tyt > hum * 0.3 ? 'ok' : 'warn')}${row('Haut (Kebet)', `${kebet.toLocaleString('fr-FR')} (canon : dizaines de milliers)`, kebet >= 1e4 && kebet <= 1e5 ? 'ok' : 'warn')}</dl><p class="note">Voyage des arches : 0,35 c × ~400 ans ≈ 140 années-lumière depuis la Terre.</p><h3>Âge du système</h3><dl>${row('Âge de l\'étoile', `${(STAR.ageGyr ?? 3).toFixed(2)} Gyr (An 0)`)}${row('Comparaison', `Soleil ≈ 4,6 Gyr : ${(STAR.ageGyr ?? 3) > 4.6 ? 'système plus vieux de ' + ((STAR.ageGyr ?? 3) - 4.6).toFixed(1) + ' Gyr (canon)' : 'système plus jeune'}`, (STAR.ageGyr ?? 3) > 4.6 ? 'ok' : 'warn')}${row('Fin de séquence principale', `dans ${remain.toFixed(1)} Gyr`)}${row('Zirkan quitte la zone habitable', exitGyr > remain ? 'jamais avant la fin de l\'étoile' : `dans ${exitGyr.toFixed(1)} Gyr`, exitGyr > remain ? 'ok' : 'warn')}</dl><p class="note">L'étoile s'éclaircit avec l'âge (estimation +${(LUMINOSITY_GROWTH_PER_GYR * 100).toFixed(0)} % par Gyr). Sur le temps du roman (quelques siècles), l'effet est nul.</p>`;
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

  // ---------- Lore : personnages, vestiges, glossaire ----------
  /** Lieu lisible d'une entrée de lore (nom du site s'il existe, sinon du corps). */
  lieuLore(o) { const s = o.site && SITES.find((x) => x.id === o.site); return s ? s.name : o.corps; }
  /** Va au lieu d'une entrée : le site si elle en a un, sinon le corps (la ceinture a sa fiche). */
  allerAuLieu(o) {
    if (o.site) this.selectSite(o.site); else if (o.corps === BELT.name) this.selectBelt(); else { const b = this.world.bodies.find((x) => x.name === o.corps); if (b) this.select(b.idx, true); }
    this.closeLeftOnMobile();
  }
  /** Sections « Personnages d'ici » et « Vestiges » d'une fiche de corps (siteId null) ou de site. */
  loreHtml(corps, siteId = null, sansSites = false) {
    // sansSites : sur la fiche d'un corps affichée sous celle d'un site, on ne répète pas ce que la fiche du site montre déjà
    const pj = auLieu(PERSONNAGES, corps, siteId).filter((p) => !sansSites || !p.origine.site), ve = auLieu(VESTIGES, corps, siteId, 'direct').filter((v) => (this.loreIceberg !== false || v.niveau !== 'iceberg') && (!sansSites || !v.site));
    let h = '';
    if (pj.length) h += this.begin('Personnages d\'ici', true, 'canon') + `<ul class="lore-l">${pj.map((p) => `<li><b>${esc(p.nom)}</b>${p.vivant === false ? ' <small>(décédée)</small>' : ''}<small>${esc(p.role)}${!siteId && p.origine.site ? ' · ' + esc(this.lieuLore(p.origine)) : ''}</small>${p.origine.statut === 'provisoire' ? '<em class="pill provisoire">lieu provisoire</em>' : ''}<span>${esc(p.resume)}</span></li>`).join('')}</ul></details>`;
    if (ve.length) h += this.begin('Vestiges des Anciens', true, 'canon') + `<ul class="lore-l">${ve.map((v) => `<li><b>${esc(v.titre)}</b><em class="pill ${v.niveau}">${v.niveau === 'iceberg' ? 'iceberg' : v.niveau === 'ouvert' ? 'fil ouvert' : 'canon'}</em><span>${esc(v.texte)}</span></li>`).join('')}</ul></details>`;
    return h;
  }
  buildLore() {
    const mondes = [{ tyt: STAR.names.tyt, courant: STAR.names.tytCourant, sens: STAR.names.sens, humain: STAR.name }, { tyt: BELT.names.tyt, courant: BELT.names.tytCourant, sens: BELT.names.sens, humain: BELT.name }];
    for (const b of this.sim.bodies.slice(1)) mondes.push({ tyt: b.def.names?.tyt, courant: b.def.names?.tytCourant, sens: b.def.names?.sens, humain: b.def.name });
    this.glossaire = glossaireComplet(GLOSSAIRE, mondes);
    const cats = [...new Set(this.glossaire.map((e) => e.cat))];
    $('#lore-cat').innerHTML = '<option value="">Toutes les catégories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
    const rendreGl = () => {
      const l = filtrer(this.glossaire, $('#lore-q').value, $('#lore-cat').value);
      $('#lore-gl-n').textContent = `${l.length} entrée${l.length > 1 ? 's' : ''}`;
      $('#lore-gl-l').innerHTML = l.map((e) => `<li><b>${esc(e.mot)}</b><span>${esc(e.sens)}</span>${e.note ? `<small>${esc(e.note)}</small>` : ''}</li>`).join('');
    };
    $('#lore-q').addEventListener('input', rendreGl); $('#lore-cat').addEventListener('change', rendreGl); rendreGl();
    const lieuBtn = (o, html, cle) => `<li><button type="button" data-lieu="${cle}">${html}</button></li>`;
    const rendrePj = () => { $('#lore-pj-l').innerHTML = PERSONNAGES.map((p, i) => lieuBtn(p.origine, `<b>${esc(p.nom)}</b>${p.vivant === false ? ' <small>(décédée)</small>' : ''}<small>${esc(p.role)} · ${esc(this.lieuLore(p.origine))}</small>${p.origine.statut === 'provisoire' ? '<em class="pill provisoire">lieu provisoire</em>' : ''}`, 'p' + i)).join(''); };
    const rendreVs = () => { $('#lore-vs-l').innerHTML = VESTIGES.filter((v) => this.loreIceberg !== false || v.niveau !== 'iceberg').map((v) => { const i = VESTIGES.indexOf(v); const h = `<b>${esc(v.titre)}</b><em class="pill ${v.niveau}">${v.niveau === 'iceberg' ? 'iceberg' : v.niveau === 'ouvert' ? 'fil ouvert' : 'canon'}</em><small>${v.horsSysteme ? 'hors du système' : esc(this.lieuLore(v))}</small><span>${esc(v.texte)}</span>`; return v.horsSysteme ? `<li>${h}</li>` : lieuBtn(v, h, 'v' + i); }).join(''); };
    rendrePj(); rendreVs();
    $('#lore-iceberg').addEventListener('change', (e) => { this.loreIceberg = e.target.checked; rendreVs(); this.renderInfo(true); });
    $('#lore').addEventListener('click', (e) => { const b = e.target.closest('[data-lieu]'); if (!b) return; const k = b.dataset.lieu, o = k[0] === 'p' ? PERSONNAGES[+k.slice(1)].origine : VESTIGES[+k.slice(1)]; this.allerAuLieu(o); });
    const idx = indexer(this.glossaire), rendreTr = () => {
      const t = $('#tr-in').value, ft = $('#tr-sens').value === 'ft', r = ft ? versTyt(t, idx) : versFrancais(t, idx);
      $('#tl-out').textContent = t.trim() ? r.resultat : '';
      $('#tr-l').innerHTML = r.lignes.map((l) => ft
        ? `<li><b>${esc(l.src)}</b><span>${l.tyt ? esc(l.tyt) + ' — ' + esc(l.sens) : 'absent du glossaire'}</span>${l.alt.length ? `<small>autres : ${l.alt.map(esc).join(', ')}</small>` : ''}</li>`
        : `<li><b>${esc(l.src)}</b><span>${l.trouve ? esc(l.sens) : 'absent du glossaire'}</span></li>`).join('');
    };
    $('#tr-in').addEventListener('input', rendreTr); $('#tr-sens').addEventListener('change', rendreTr);
    const tabs = ['gl', 'pj', 'vs', 'tr'], sel = (t) => { for (const x of tabs) { $('#lt-' + x).setAttribute('aria-selected', x === t); $('#lt-' + x).tabIndex = x === t ? 0 : -1; $('#lore-' + x).hidden = x !== t; } };
    $('#lore-tabs').addEventListener('click', (e) => { const b = e.target.closest('[role=tab]'); if (b) sel(b.id.slice(3)); });
    $('#lore-tabs').addEventListener('keydown', (e) => { const i = tabs.findIndex((x) => $('#lt-' + x).getAttribute('aria-selected') === 'true'); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]; sel(n); $('#lt-' + n).focus(); } });
  }

  // ---------- Temples solaires d'Osaon : liturgie, éclipses, calendrier ----------
  /** Prochaines éclipses d'un corps (début, durée), en cache par tranche de date. */
  eclipsesProches(corps, n = 3) {
    const key = `${corps}:${Math.floor(this.target / 0.4)}`;
    if (this._ecKey !== key || this._ecSim !== this.sim || (this._ec?.[0] && this._ec[0].t <= this.target)) {
      this._ec = runEphemeris(this.sim, 12, { rot: this.rotParams(), kinds: { eclipses: true, alignments: false, apsides: false, sun: false }, max: 200 }).filter((e) => e.who === corps && e.t > this.target).slice(0, n);
      this._ecKey = key; this._ecSim = this.sim;
    }
    return this._ec;
  }
  liturgieHtml() {
    const ec = this.eclipsesProches('Kebet'), cm = moisConfederal(this.target, jourKebet());
    const items = ec.map((e) => `<li><button type="button" data-t="${e.t}"><b>${e.type}</b><span>Zirkan masque l'étoile ${fmtDuree(e.duration, { minutes: true })}</span><small>${this.fmtT(e.t)} · dans ${fmtDuree(e.t - this.target)}</small></button></li>`).join('');
    return this.begin('Liturgie solaire', true, 'canon') + `<p class="note">Temples solaires immenses, ouverts sur le ciel pour capter Omraon : disques d'or, lumière en nappes, le sommet du blanc-et-doré (doc 13, Quotidien sensoriel — Kebet).</p>`
      + (ec.length ? `<ul class="evts">${items}</ul><button type="button" class="wide-btn" data-eclipse-vivre>☀ Vivre la prochaine éclipse depuis les temples</button>` : '<p class="note">Aucune éclipse proche.</p>') + '</details>'
      + this.begin('Calendrier confédéral', false, 'conception') + `<dl>${row('Aujourd\'hui', `${cm.mois} (mois ${cm.rang} sur 13)`)}${row('Jour du mois', `${cm.jour} sur ${cm.nbJours}`)}</dl><p class="note">Le lore donne 13 mois aux noms tyts fossilisés (doc 03) mais pas leur durée : l'année est ici partagée en 13 mois égaux, l'An 0 commençant au premier jour d'Aset. Pas de fêtes définies : « fête de l'Arrivée », cycle solaire (pistes du lore).</p></details>`;
  }
  /** Saute au milieu de la prochaine éclipse de Kebet, ouvre la vue à hauteur d'yeux au site et regarde l'étoile. */
  vivreEclipse(siteId) {
    const site = SITES.find((x) => x.id === siteId), ev = this.eclipsesProches(site.body, 1)[0]; if (!ev) return;
    this.restoreState({ t: ev.t + (ev.duration || 0) / 2, s: siteId, p: true });
    setTimeout(() => {
      this.enterGround(); const g = this.world.ground; g?.lookAt('star'); if (g) g.fov = 75;
      setTimeout(() => { const sk = this.world.groundInfo?.sky; if (g && sk) g.pitch = Math.min(1.45, Math.max(-0.2, sk.sunEl)); }, 250); // l'étoile (cachée par Zirkan) au centre de l'image
      this.announce(`Éclipse vue depuis ${site.name}`);
    }, 700);
  }

  // ---------- Ceinture Nunzir ----------
  /** Sélectionne la ceinture : caméra cadrée sur son anneau (centré sur l'étoile, à ~4 UA) et fiche propre. */
  selectBelt() {
    this.belt = true; this.selected = 0; this.selectedSite = null;
    this.world.focusOn(0, 4.2 * UNIT); this.world.rig.el = 0.8;
    this.markList(); $('#transfer').hidden = true; $('#site-tools').hidden = true;
    this.renderInfo(true);
  }
  /** Fiche de la ceinture : étendue, traceurs, résonances avec Zirkan (lacunes de Kirkwood), sites. */
  beltHtml() {
    const sim = this.sim, zi = sim.bodies.find((b) => b.def.id === 'zirkan'), aZ = this.world.bodies[zi.idx].el?.a ?? zi.def.orbit.a, nf = (n) => n.toLocaleString('fr-FR');
    const tile = (...a) => this.tile(...a), width = BELT.aMax - BELT.aMin;
    const tiles = tile(`${BELT.aMin}–${BELT.aMax} UA`, 'Étendue') + tile(`${f(width * AU_KM / 1e6, 0)} M km`, 'Largeur', `${f(width, 2)} UA`) + tile(nf(sim.pN), 'Traceurs simulés', 'sans masse, sans collisions entre eux') + tile(`${f(aZ, 2)} UA`, 'Zirkan voisine', `limite instable ≈ ${f(aZ - 0.33, 2)} UA (conception)`);
    let h = `<header class="hero"><span class="swatch" style="background:#c8c8d0"></span><div><h2>${BELT.name}</h2><div class="sub">Ceinture d'astéroïdes</div></div></header><p class="lead">${BELT.role}</p><div class="tiles">${tiles}</div>`;
    h += this.begin('Noms', false, 'canon') + `<dl>${row('Nom tyt sacré', BELT.names.tyt)}${row('Courant', BELT.names.tytCourant)}${row('Sens', `« ${BELT.names.sens} »`)}</dl></details>`;
    const res = [[2, 1], [5, 2], [3, 1]].map(([p, q]) => ({ p, q, a: aZ * (q / p) ** (2 / 3) }));
    h += this.begin('Résonances avec Zirkan', true, 'calcule') + `<dl>${res.map((r) => row(`${r.p}:${r.q}`, `${f(r.a, 3)} UA`, r.a >= BELT.aMin && r.a <= BELT.aMax ? 'warn' : '')).join('')}</dl><p class="note">En orange : dans la ceinture, où ces résonances creusent des lacunes (comme les lacunes de Kirkwood autour de Jupiter).</p></details>`;
    const sites = SITES.filter((x) => x.body === 'Nunzir');
    if (sites.length) h += this.begin('Sites', true, 'conception') + `<ul class="evts">${sites.map((x) => `<li><button type="button" data-site-open="${esc(x.id)}"><b>${esc(x.name)}</b><small>${nf(x.population)} humains${x.tyts ? ' · ' + nf(x.tyts) + ' Tyts' : ''}</small></button></li>`).join('')}</ul></details>`;
    h += this.loreHtml(BELT.name);
    return h + '<p class="note">Les traceurs sont des points sans masse : ils figurent la densité de la ceinture, ils ne se heurtent pas entre eux.</p>';
  }

  // ---------- Comparateur de lieux ----------
  buildCompare() {
    const opts = SITES.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}${x.body && x.body !== 'Nunzir' ? ' (' + esc(x.body) + ')' : ''}</option>`).join('');
    $('#cmp-a').innerHTML = opts; $('#cmp-b').innerHTML = opts;
    $('#cmp-a').value = 'kebet-quartiers'; $('#cmp-b').value = 'sethis-cite-a';
    for (const id of ['#cmp-a', '#cmp-b']) $(id).addEventListener('change', () => this.renderCompare());
    $('#compare').addEventListener('toggle', () => { if ($('#compare').open) this.renderCompare(); });
  }
  renderCompare() {
    const out = $('#cmp-out'), w = this.world, ids = [$('#cmp-a').value, $('#cmp-b').value], sites = ids.map((id) => SITES.find((x) => x.id === id));
    const recs = ids.map((id) => w.siteEls?.get(id)?.st); if (!recs[0] || !recs[1]) { out.textContent = 'Positions non disponibles.'; return; }
    const ctx = { sim: this.sim, el: (i) => w.bodies[i].el };
    const rep = recs.map((st, k) => siteReport(ctx, sites[k], st, this.target));
    const nf = (n) => n.toLocaleString('fr-FR'), L = liaison(recs[0].pos, recs[1].pos);
    const haut = [{ title: 'Population', rows: [['Humains', nf(sites[0].population)], ['Tyts', nf(sites[0].tyts || 0)]] }], hb = [{ title: 'Population', rows: [['Humains', nf(sites[1].population)], ['Tyts', nf(sites[1].tyts || 0)]] }];
    const tab = fusionner([...haut, ...rep[0].sections], [...hb, ...rep[1].sections]);
    const lien = `<h3>Entre les deux (à cet instant)</h3><dl>${row('Distance', `${f(L.km / 1e6, 1)} M km`)}${row('Message à la lumière', fmtSecondes(L.lumiereS))}${row('Trajet en hyperpropulsion (8 g, hypothèse)', fmtSecondes(L.volS))}</dl>`;
    out.innerHTML = `<table class="cmp"><caption class="sr-only">Comparaison de ${esc(sites[0].name)} et ${esc(sites[1].name)}</caption><thead><tr><td></td><th scope="col">${esc(sites[0].name)}</th><th scope="col">${esc(sites[1].name)}</th></tr></thead>`
      + tab.map((s) => `<tbody><tr class="cmp-h"><th colspan="3" scope="colgroup">${esc(s.titre)}</th></tr>${s.lignes.map(([k, a, b, d]) => `<tr${d ? ' class="diff"' : ''}><th scope="row">${esc(k)}</th><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody>`).join('') + `</table>${lien}`;
  }

  // ---------- Photo et carnet de scènes ----------
  lieuCourant() { return this.currentSite()?.name || this.world.bodies[this.selected]?.name || 'Omraon'; }
  /** Date lisible : horloge de Kebet, puis jour terrestre entre parenthèses. */
  dateTexte() {
    const t = this.sim.t, y = Math.floor(t / DAYS_PER_YEAR), dd = t - y * DAYS_PER_YEAR;
    return `${this.fmtT(t)} (${fmtAn(y)}, jour terrestre ${Math.floor(dd)})`;
  }
  telecharger(nom, contenu, type) {
    const url = URL.createObjectURL(contenu instanceof Blob ? contenu : new Blob([contenu], { type }));
    const a = document.createElement('a'); a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  /** Photo de la vue (sans interface) avec bandeau de légende : lieu, date, mention du projet. */
  photo() {
    const cv = this.world.capture(), bar = Math.max(56, Math.round(cv.width / 22)), out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height + bar;
    const g = out.getContext('2d'); g.drawImage(cv, 0, 0); g.fillStyle = '#04060d'; g.fillRect(0, cv.height, out.width, bar);
    const fs = Math.round(bar * 0.3), pad = Math.round(bar * 0.35);
    g.fillStyle = '#e6ecf8'; g.font = `600 ${fs}px system-ui, sans-serif`; g.textBaseline = 'middle'; g.fillText(`${this.lieuCourant()} · ${this.fmtT(this.sim.t)}`, pad, cv.height + bar * 0.34);
    g.fillStyle = '#8d9bb8'; g.font = `${Math.round(fs * 0.78)}px system-ui, sans-serif`; g.fillText(`Système d'Omraon (simulation) · ${this.dateTexte().replace(/^.*?\(/, '(')}`, pad, cv.height + bar * 0.73);
    g.textAlign = 'right'; g.fillText('© 2026 Magny · Tous droits réservés', out.width - pad, cv.height + bar * 0.73); g.textAlign = 'left';
    out.toBlob((b) => { if (b) { this.telecharger(`${slug(this.lieuCourant())}-${slug(this.fmtT(this.sim.t))}.png`, b); this.announce('Photo enregistrée'); } }, 'image/png');
  }
  carnetStock() { try { return window.localStorage; } catch { return null; } }
  carnetRendre() {
    const l = $('#carnet-list'); l.innerHTML = (this.carnet || []).map((s) => `<li data-id="${esc(s.id)}">${s.vignette ? `<img src="${s.vignette}" alt="" width="64" height="36">` : '<span class="noimg"></span>'}<div><b>${esc(s.nom)}</b><small>${esc(s.lieu)} · ${esc(s.date)}</small></div><button type="button" data-open>Ouvrir</button><button type="button" data-del aria-label="Supprimer la scène ${esc(s.nom)}">✕</button></li>`).join('');
    $('#carnet-vide').hidden = !!(this.carnet || []).length;
  }
  carnetAjouter() {
    const st = this.carnetStock(), site = this.currentSite(); if (!this.carnet) this.carnet = st ? lireCarnet(st) : [];
    let texte = ''; if (site) { try { this.refreshScene(true); texte = this.sceneText || ''; } catch { texte = ''; } }
    let vignette = ''; try { vignette = this.world.capture(240).toDataURL('image/jpeg', 0.6); } catch { vignette = ''; }
    const s = nouvelleScene({ nom: $('#carnet-nom').value.trim() || `${this.lieuCourant()} · ${this.fmtT(this.sim.t)}`, hash: '#' + encoderEtat(this.etatCourant()), lieu: this.lieuCourant(), date: this.dateTexte(), texte, vignette });
    const next = [s, ...this.carnet];
    if (!st || !ecrireCarnet(st, next)) { this.announce('Carnet plein ou indisponible : scène non gardée'); return; }
    this.carnet = next; $('#carnet-nom').value = ''; this.carnetRendre(); this.announce('Scène gardée');
  }
  bindCarnet() {
    const st = this.carnetStock(); this.carnet = st ? lireCarnet(st) : []; this.carnetRendre();
    $('#carnet-add').addEventListener('click', () => this.carnetAjouter());
    for (const b of document.querySelectorAll('#carnet-photo, #btn-photo, #btn-photo2')) b.addEventListener('click', () => this.photo());
    $('#carnet-list').addEventListener('click', (e) => {
      const li = e.target.closest('li'), s = li && this.carnet.find((x) => x.id === li.dataset.id); if (!s) return;
      if (e.target.closest('[data-open]')) { this.restoreState(decoderEtat(s.hash)); this.announce(`Scène ouverte : ${s.nom}`); }
      else if (e.target.closest('[data-del]')) { this.carnet = this.carnet.filter((x) => x.id !== s.id); if (st) ecrireCarnet(st, this.carnet); this.carnetRendre(); this.announce('Scène supprimée'); }
    });
    $('#carnet-export').addEventListener('click', () => {
      if (!this.carnet.length) { this.announce('Le carnet est vide'); return; }
      this.telecharger('carnet-omraon.md', versMarkdown(this.carnet, location.origin + location.pathname), 'text/markdown'); this.announce('Carnet exporté');
    });
  }

  /** Annonce un changement d'état aux lecteurs d'écran (zone `role=status`, hors écran). */
  announce(msg) {
    const el = $('#sr-status'); if (!el) return;
    el.textContent = ''; clearTimeout(this._ann); this._ann = setTimeout(() => { el.textContent = msg; }, 60);
  }

  // ---------- Visite guidée ----------
  startTour() {
    if (this.touring) return;
    this.touring = true; this.tourSteps = etapesVisite(this); this.tourSaved = this.etatCourant(); this.tourOpener = document.activeElement;
    const cl = document.body.classList; this.tourHadLeft = cl.contains('hide-left'); cl.add('hide-left', 'touring');
    document.body.classList.remove('options-open'); // le panneau Options ne doit pas recouvrir la visite
    $('#tour').hidden = false; this.tourGo(0);
  }
  tourGo(i) {
    const st = this.tourSteps, n = st.length; if (!st) return;
    this.tourIdx = Math.max(0, Math.min(n - 1, i)); const s = st[this.tourIdx];
    if (s.vue) this.view(s.vue);
    this.restoreState({ v: 0, ...s.etat });
    if (s.ceinture) { this.selectBelt(); this.world.rig.az = 0.6; this.world.rig.el = 0.8; }
    const dots = st.map((_, k) => `<button type="button" class="pip${k === this.tourIdx ? ' on' : ''}" data-go="${k}" aria-label="Étape ${k + 1} : ${esc(st[k].titre)}"${k === this.tourIdx ? ' aria-current="step"' : ''}></button>`).join('');
    $('#tour').innerHTML = `<div class="t-n">Étape ${this.tourIdx + 1} / ${n}</div><h2>${s.titre}</h2><div class="t-body">${s.texte()}</div>`
      + `<div class="t-dots">${dots}</div><div class="t-act"><button type="button" data-tour="prev"${this.tourIdx === 0 ? ' disabled' : ''}>◀ Précédent</button>`
      + `<button type="button" data-tour="${this.tourIdx === n - 1 ? 'end' : 'next'}" class="main">${this.tourIdx === n - 1 ? 'Terminer' : 'Suivant ▶'}</button><button type="button" data-tour="end" class="quit" aria-label="Quitter la visite">✕</button></div>`;
    $('#tour').querySelector('.main').focus({ preventScroll: true });
    this.announce(`Étape ${this.tourIdx + 1} sur ${n} : ${s.titre}`);
  }
  endTour() {
    if (!this.touring) return;
    this.touring = false; $('#tour').hidden = true;
    const cl = document.body.classList; cl.remove('touring'); if (!this.tourHadLeft) cl.remove('hide-left');
    this.restoreState(this.tourSaved); // retour à la vue d'avant la visite
    this.tourOpener?.focus?.({ preventScroll: true }); this.announce('Visite terminée');
  }
  bindTour() {
    for (const b of document.querySelectorAll('#btn-tour, #btn-tour2')) b.addEventListener('click', () => (this.touring ? this.endTour() : this.startTour()));
    $('#tour').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.go != null) this.tourGo(+b.dataset.go);
      else if (b.dataset.tour === 'next') this.tourGo(this.tourIdx + 1); else if (b.dataset.tour === 'prev') this.tourGo(this.tourIdx - 1); else if (b.dataset.tour === 'end') this.endTour();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.touring || e.target.closest?.('input, select, textarea, #frise-track')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this.tourGo(this.tourIdx + 1); } else if (e.key === 'ArrowLeft') { e.preventDefault(); this.tourGo(this.tourIdx - 1); } else if (e.key === 'Escape') this.endTour();
    });
  }

  // ---------- Lien partageable ----------
  /** État de la vue courante (date, corps, site, caméra, vitesse). */
  etatCourant() {
    const w = this.world, rig = w.rig;
    return { t: this.target, b: this.belt ? BELT.name : w.bodies[this.selected]?.name, s: this.selectedSite || undefined, az: rig.az, el: rig.el, d: rig.logTarget, v: this.speedIdx, p: !this.playing };
  }
  /** Applique un état décodé (valeurs déjà validées par decoderEtat ; un site ou un corps inconnu est ignoré). */
  restoreState(e) {
    const w = this.world, rig = w.rig;
    if (e.v != null && SPEEDS[e.v]) { this.speedIdx = e.v; $('#speed').value = e.v; $('#speed-out').textContent = SPEEDS[e.v][1]; }
    if (e.t != null) this.goToTime(e.t, true);
    if (e.s && SITES.some((x) => x.id === e.s)) this.selectSite(e.s);
    else if (e.b === BELT.name) this.selectBelt();
    else if (e.b) { const o = w.bodies.find((x) => x.name === e.b); if (o) this.select(o.idx, true); }
    if (e.az != null) rig.az = e.az;
    if (e.el != null) rig.el = e.el;
    if (e.d != null) { rig.logTarget = e.d; rig.logD = e.d; }
    this.playing = !e.p; $('#play').textContent = this.playing ? '❚❚' : '▶';
  }
  /** Écrit l'état dans l'adresse (sans empiler l'historique) ; appelé quelques fois par seconde. */
  syncHash() {
    const h = '#' + encoderEtat(this.etatCourant());
    if (h !== this._hash) { this._hash = h; try { history.replaceState(null, '', h); } catch { /* contexte sans historique (cadre, mode privé) : le lien se copie quand même */ } }
  }
  bindLink() {
    for (const b of document.querySelectorAll('#btn-link, #btn-link2')) b.addEventListener('click', async () => {
      const t = b.querySelector('.t'), orig = b.dataset.orig ??= b.textContent;
      this.syncHash();
      let ok = false;
      try { await Promise.race([navigator.clipboard.writeText(location.href), new Promise((_, no) => setTimeout(no, 900))]); ok = true; } catch { /* repli ci-dessous */ }
      if (!ok) { const a = document.createElement('textarea'); a.value = location.href; document.body.appendChild(a); a.select(); try { ok = document.execCommand('copy'); } catch { /* sans effet */ } a.remove(); }
      const msg = ok ? 'Copié' : 'Adresse'; this.announce(ok ? 'Lien copié dans le presse-papiers' : 'Copie impossible : l\'adresse est dans la barre du navigateur');
      if (t) { t.textContent = msg; setTimeout(() => { t.textContent = 'Lien'; }, 1600); } else { b.textContent = '✓ ' + msg; setTimeout(() => { b.textContent = orig; }, 1600); }
    });
    window.addEventListener('hashchange', () => { if (location.hash !== this._hash) { this._hash = location.hash; this.restoreState(decoderEtat(location.hash)); } });
  }

  /** Prochains événements du corps (éclipses pour une lune ; alignements et apsides pour une planète), cliquables. Calcul mis en cache par tranche de date. */
  prochainsEvenements(b) {
    if (b.type === 'star') return '';
    const key = `${b.idx}:${Math.floor(this.target / (b.type === 'moon' ? 0.4 : 20))}`;
    if (this._evKey !== key || this._evSim !== this.sim || (this._ev?.[0] && this._ev[0].t <= this.target)) { // nouvelle tranche de date, ou le premier événement vient de passer
      const ev = runEphemeris(this.sim, b.type === 'moon' ? 12 : 900, { rot: this.rotParams(), kinds: { eclipses: true, alignments: true, apsides: true, sun: false }, max: 800 });
      this._ev = ev.filter((e) => (e.who === b.def.name || e.by === b.def.name) && e.t > this.target).slice(0, 4); this._evKey = key; this._evSim = this.sim;
    }
    if (!this._ev.length) return '';
    const items = this._ev.map((e) => {
      const detail = e.duration != null ? `${e.who} ← ${e.by}, ${fmtDuree(e.duration, { minutes: true })}` : e.by ? `${e.who} – ${e.by}` : e.who;
      return `<li><button type="button" data-t="${e.t}"><b>${e.type}</b><span>${detail}</span><small>${this.fmtT(e.t)} · dans ${fmtDuree(e.t - this.target)}</small></button></li>`;
    }).join('');
    return `${this.begin('Prochains événements', true, 'calcule')}<ul class="evts">${items}</ul><p class="note">Cliquer saute à la date.</p></details>`;
  }

  /** Ouvre une section repliable de la fiche ; l'état ouvert/fermé choisi par l'utilisateur survit aux rafraîchissements. */
  begin(titre, ouvert, statut = null) {
    const o = this.secState?.[titre] ?? ouvert, st = statut && STATUTS[statut];
    return `<details class="sec" data-sec="${titre}"${o ? ' open' : ''}><summary${st ? ` data-tip="${esc(st.tip)}"` : ''}><span>${titre}</span>${st ? `<em class="pill ${statut}">${st.label}</em>` : ''}</summary>`;
  }
  tile(valeur, libelle, sous = '', info = '') { return `<div class="tile"${info ? tipAttr(info) : ''}><b>${valeur}</b><span>${libelle}</span>${sous ? `<small>${sous}</small>` : ''}</div>`; }
  jourCourt(d) { const k = d / jourKebet(); return k * HEURES_PAR_JOUR < 48 ? `${f(k * HEURES_PAR_JOUR, 1)} h` : `${f(k, 2)} j`; }

  // Valeurs physiques dérivées en direct ; appelé ~4 fois par seconde.
  renderInfo() {
    if (this.belt) { // ceinture : fiche propre (l'en-tête réservé aux sites est vidé)
      const hd = $('#info-head'); if (hd.dataset.h) { hd.innerHTML = ''; hd.dataset.h = ''; }
      const h = this.beltHtml(), el = $('#info-live'); this.info = h;
      if (el.dataset.h !== h) { const sc = el.scrollTop; el.innerHTML = h; el.dataset.h = h; el.scrollTop = sc; }
      return;
    }
    const w = this.world, sim = this.sim, o = w.bodies[this.selected], b = o.b, d = b.def, star = sim.bodies[0];
    const rp = sim.rPos;
    const dStar = (i) => Math.hypot(rp[3 * i] - rp[0], rp[3 * i + 1] - rp[1], rp[3 * i + 2] - rp[2]);
    const names = d.names || {};
    let h = this.selectedSite ? this.siteHtml() : '';
    const kind = b.type === 'star' ? 'Étoile (G0V)' : b.type === 'planet' ? (d.kind === 'gas' ? 'Planète gazeuse' : 'Planète tellurique') : 'Lune de ' + sim.bodies[b.parent].def.name;
    const bk = bulk(b.mass, b.radiusKm), hab = b.type === 'star' ? null : assess(this.ctx(), b.idx);
    const sid = b.type === 'moon' ? o.el?.period : o.protDays, tile = (...a) => this.tile(...a);
    const di0 = b.type === 'star' ? 0 : dStar(b.type === 'planet' ? b.idx : b.parent);
    const gG = bk.gSurf / 9.80665, tEq = equilibriumTemp(star.def, di0, d.albedo ?? 0.3) - 273.15;
    const tipR = tipJauge({ titre: 'Rayon', texte: `${f(b.radiusKm, 0)} km`, v: b.radiusKm, min: 500, max: 1e6, log: true, marques: [{ v: 1737, label: 'Lune' }, { v: 6371, label: 'Terre' }, { v: 71492, label: 'Jupiter' }, { v: 695700, label: 'Soleil' }], note: 'Échelle logarithmique.' });
    const tiles = b.type === 'star'
      ? tile(`${f(b.radiusKm / 1e3, 0)} k km`, 'Rayon', '', tipR) + tile(`${d.teff} K`, 'Température', '', tipTexte('Température de surface', `${d.teff} K · Soleil : 5 772 K`)) + tile(`${f(this.L, 2)} L☉`, 'Luminosité', '', tipTexte('Luminosité', `${f(this.L, 2)} × le Soleil`)) + tile(fmtMass(b.mass), 'Masse', '', tipTexte('Masse', `${fmtMass(b.mass)} · Soleil = 1 M☉`))
      : tile(`${f(gG, 2)} g`, 'Gravité', '', tipJauge({ titre: 'Gravité de surface', texte: `${f(gG, 2)} g · ${f(bk.gSurf, 2)} m/s²`, v: gG, min: 0, max: 3, marques: [{ v: 0.38, label: 'Mars' }, { v: 1, label: 'Terre' }, { v: 2.53, label: 'Jupiter' }] }))
        + tile(sid ? this.jourCourt(sid) : '—', 'Jour', sid ? `${fmtTerre(sid)} Terre` : '', sid ? tipJauge({ titre: 'Jour sidéral', texte: `${this.jourCourt(sid)} de Kebet · ${fmtTerre(sid)} Terre`, v: sid, min: 0.1, max: 100, log: true, marques: [{ v: jourKebet(), label: 'Kebet' }], note: 'Jours terrestres, échelle logarithmique. Un jour de Kebet vaut 24 h de Kebet.' }) : '')
        + tile(`${f(b.radiusKm, 0)} km`, 'Rayon', '', tipR)
        + tile(`${f(tEq, 0)} °C`, 'T équilibre', '', tipJauge({ titre: 'Température d\'équilibre', texte: `${f(tEq, 0)} °C · ${f(tEq + 273.15, 0)} K`, v: tEq, min: -250, max: 500, bandes: [{ de: 0, a: 100, cls: 'ok', label: 'eau liquide à 1 bar' }], marques: [{ v: 15, label: 'Terre (moy.)' }], note: 'Sans effet de serre ni chaleur interne.' }));
    h += `<header class="hero"><span class="swatch" style="background:${d.color || '#9fb4d8'}"></span><div><h2>${d.name}</h2><div class="sub">${kind}</div></div>${hab ? `<span class="chip ${hab.level}">${hab.label}</span>` : ''}</header><p class="lead">${d.role}</p><div class="tiles">${tiles}</div>`;
    h += this.begin('Noms', false, d.provisional ? 'provisoire' : 'canon') + `<dl>${row('Nom tyt sacré', names.tyt || '—')}${names.tytCourant && names.tytCourant !== names.tyt ? row('Courant', names.tytCourant) : ''}${names.sens ? row('Sens', `« ${names.sens} »`) : ''}</dl></details>`;
    h += this.begin('Physique', true, 'conception') + `<dl>${row('Masse', fmtMass(b.mass))}${row('Rayon', `${f(b.radiusKm, 0)} km`)}${row('Densité', `${f(bk.rho, 2)} g/cm³`)}${row('Gravité de surface', `${f(bk.gSurf, 2)} m/s² (${f(bk.gSurf / 9.80665, 2)} g)`)}${row('Vitesse de libération', `${f(bk.vEsc, 2)} km/s`)}`;
    h += this.dayRows(o, b);
    if (o.protDays && b.type === 'planet' && o.flat > 1e-4) h += row('Aplatissement', f(o.flat, 4));
    if (b.type !== 'star') h += row('Inclinaison de l\'axe', `${f(b.tilt / DEG, 1)}°`);
    if (b.type === 'star') h += row('Température', `${d.teff} K`) + row('Luminosité', `${f(this.L, 2)} L☉`);
    h += '</dl></details>';
    if (b.type === 'star') {
      const hz = this.hz;
      h += this.begin('Zone habitable (Kopparapu 2013)', true, 'calcule') + `<dl>${row('Conservative', `${f(hz.conservative[0], 2)} – ${f(hz.conservative[1], 2)} UA`)}${row('Optimiste', `${f(hz.optimistic[0], 2)} – ${f(hz.optimistic[1], 2)} UA`)}${row('Ceinture Nunzir', `${BELT.aMin} – ${BELT.aMax} UA`)}</dl><p class="note">${BELT.role}</p></details>`;
    } else if (o.el) {
      const e = o.el, par = sim.bodies[b.parent];
      h += this.begin('Orbite (en direct)', true, 'calcule') + '<dl>';
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
        h += this.begin('Dynamique', false, 'calcule') + `<dl>${row('Rayon de Hill', `${f(rh, 4)} UA (${f(rh * AU_KM / 1e6, 2)} M km)`)}</dl></details>`;
        void pa;
      } else {
        const pi = par.idx, pe = o && w.bodies[pi].el;
        const rh = hillRadius(pe.a, pe.e, sim.mEff[pi], star.mass), lim = stableSatelliteLimit(rh, pe.e, o.el.e);
        const rho = bulk(b.mass, b.radiusKm).rho, rhoP = bulk(par.mass, par.radiusKm).rho;
        const roche = rocheLimitKm(par.radiusKm, rhoP, rho), ratio = (o.el.a / rh);
        h += this.begin('Dynamique', false, 'calcule') + `<dl>${row('a / rayon de Hill', `${f(ratio, 3)} (limite ${f(lim / rh, 2)})`, o.el.a < lim ? 'ok' : 'warn')}${row('Limite de Roche', `${f(roche, 0)} km`, o.el.a * AU_KM > roche ? 'ok' : 'warn')}</dl></details>`;
      }
      // thermique
      const di = b.type === 'planet' ? dStar(b.idx) : dStar(b.parent);
      const Teq = equilibriumTemp(star.def, di, d.albedo ?? 0.3), S = insolation(this.L, di);
      const [hi, ho] = this.hz.conservative, [oi, oo] = this.hz.optimistic;
      const zone = di >= hi && di <= ho ? ['dans la zone habitable', 'ok'] : di >= oi && di <= oo ? ['zone habitable optimiste', 'ok'] : di < oi ? ['trop proche', 'warn'] : ['trop loin', 'warn'];
      h += this.begin('Thermique', false, 'calcule') + `<dl>${row('Éclairement', `${f(S, 3)} × Terre`)}${row('T équilibre (A=' + (d.albedo ?? 0.3) + ')', `${f(Teq, 0)} K (${f(Teq - 273.15, 0)} °C)`)}${row('Position', zone[0], zone[1])}</dl>`;
      if (d.id === 'kebet') h += `<p class="note">Kebet reçoit l'éclairement d'une planète en bordure de zone habitable ; la rotation synchrone et l'effet de serre de son atmosphère décident du reste.</p>`;
      h += '</details>';
    }
    h += this.loreHtml(b.def.name, null, !!this.selectedSite);
    h += this.prochainsEvenements(b);
    h += this.begin('Habitabilité', true, 'conception') + this.habitabilityHtml(b) + '</details>';
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
      $('#date').textContent = `${fmtAn(an)} · jour ${jour} · ${clock}`;
      const cm = moisConfederal(t, jourKebet()), tip = tipTexte('Calendrier confédéral', `${cm.mois} · mois ${cm.rang} sur 13<br>jour ${cm.jour} sur ${cm.nbJours}<br><small>13 mois égaux : leur durée et le début de l\'année sont de conception</small>`);
      if ($('#date').dataset.tip !== tip) $('#date').dataset.tip = tip;
    }
    this.friseUpdate(t / DAYS_PER_YEAR);
    if (this.voyage) { this.voyageAcc = (this.voyageAcc || 0) + dt; if (this.voyageAcc > 0.15) { this.voyageAcc = 0; this.updateVoyage(); } }
    if (this.world.ground?.active) this.updateGround(dt);
    this.netAcc = (this.netAcc || 0) + dt; if (this.net && this.netAcc > 0.2) { this.netAcc = 0; this.updateNetMarkers(); }
    const pb = $('#play'), ptxt = this.playing ? '❚❚' : '▶', plab = this.playing ? 'Pause' : 'Lecture'; if (pb.textContent !== ptxt || pb.getAttribute('aria-label') !== plab) { pb.textContent = ptxt; pb.setAttribute('aria-label', plab); } // le bouton reflète toujours l'état réel
    this.cmpAcc = (this.cmpAcc || 0) + dt; if (this.cmpAcc > 1 && $('#compare').open) { this.cmpAcc = 0; this.renderCompare(); }
    this.hashAcc = (this.hashAcc || 0) + dt; if (this.hashAcc > 1 && !this.calculating) { this.hashAcc = 0; this.syncHash(); }
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
