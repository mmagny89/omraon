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
import { planVoyage } from '../physics/flight.js';
import { makeSnapshot, ctxAt } from '../physics/ephem.js';
import { siteState } from '../physics/sites.js';
import { UNIT } from '../render/world.js';

const SPEEDS = [
  [1 / 86400, 'temps réel'], [1 / 1440, '1 min/s'], [1 / 24, '1 h/s'], [1, '1 j/s'], [10, '10 j/s'], [30.4375, '1 mois/s'],
  [DAYS_PER_YEAR, '1 an/s'], [DAYS_PER_YEAR * 10, '10 ans/s'], [DAYS_PER_YEAR * 100, '100 ans/s'], [DAYS_PER_YEAR * 1000, '1000 ans/s'],
];
const $ = (s) => document.querySelector(s);
const f = (x, d = 3) => (d === 0 ? Math.round(x).toLocaleString('fr-FR') : Math.abs(x) >= 1e5 || (Math.abs(x) < 1e-2 && x !== 0) ? x.toExponential(2) : x.toFixed(d));
const fmtDur = (d) => (d < 2 ? `${(d * 24).toFixed(1)} h` : d < 400 ? `${d.toFixed(2)} j` : `${(d / DAYS_PER_YEAR).toFixed(2)} ans`);
const row = (k, v, cls = '') => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`;

export class UI {
  constructor(sim, world) {
    this.sim = sim; this.world = world;
    this.playing = true; this.speedIdx = 0; this.target = 0; this.selected = 0; this.selectedSite = null;
    this.hz = habitableZone(sim.bodies[0].def);
    this.L = starLuminosity(sim.bodies[0].def);
    this.buildList();
    this.buildChrono();
    this.buildEphem();
    this.bindSiteTools();
    this.bindVoyage();
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
      return btn(parent, cls || b.type, `${dot}${b.def.name}`, { idx: b.idx }, () => { this.select(b.idx, true); document.body.classList.remove('show-bodies'); });
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
    const box = $('#chrono-body');
    box.innerHTML = `<div class="chips">${EVENTS.map((e) => `<button type="button" data-year="${e.year}" title="${e.note}">${e.year === 0 ? 'Présent' : 'An ' + String(e.year).replace('-', '−')} · ${e.label}</button>`).join('')}</div>` +
      `<input id="chrono-range" type="range" min="-960" max="60" step="1" value="0" aria-label="Date en années (An 0 = présent du roman)">` +
      `<div id="chrono-read"></div>`;
    box.querySelectorAll('[data-year]').forEach((b) => b.addEventListener('click', () => this.goTo(+b.dataset.year)));
    const r = $('#chrono-range');
    r.addEventListener('input', () => this.chronoLabel(+r.value));
    r.addEventListener('change', () => this.goTo(+r.value));
    this.chronoLabel(0);
  }

  chronoLabel(year) {
    const era = eraAt(year), ev = EVENTS.filter((e) => Math.abs(e.year - year) <= 8).sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
    $('#chrono-read').innerHTML = `<b>An ${String(year).replace('-', '−')}</b> — ${era.label}${ev ? `<br><span class="note">${ev.label} : ${ev.note}</span>` : ''}${era.outside ? '<br><span class="note">Les arches sont encore en route : les positions affichées sont celles du système, sans humains.</span>' : ''}<br><span class="note">Âge du système : ${systemAgeGyr(STAR, year).toFixed(6)} Gyr</span>`;
  }

  /** Va à l'année donnée (An 0 = présent) : recalcule les positions des planètes à cette date. */
  goTo(year) { $('#chrono-range').value = year; this.chronoLabel(year); this.goToTime(year * DAYS_PER_YEAR); }

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
    const dur = (s) => (s < 7200 ? `${(s / 60).toFixed(0)} min` : s < 172800 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(2)} j`);
    const maxB = (vy.prop.maxDays || 6) * 86400, burnPct = Math.min(100, st.burn / maxB * 100);
    const min = (m) => (m < 1 ? `${(m * 60).toFixed(0)} s` : m < 120 ? `${m.toFixed(1)} min` : `${(m / 60).toFixed(1)} h`);
    $('#voy-body').innerHTML = `<p><b>${vy.site.name}</b> → <b>${vy.dest.name}</b></p><div class="bar"><i style="width:${(st.progress * 100).toFixed(1)}%"></i></div><dl>` +
      row('Phase', phases[st.phase] || st.phase, st.phase === 'rest' ? 'warn' : '') + row('Écoulé / total', `${dur(st.elapsed)} / ${dur(v.plan.total)}`) +
      row('Vitesse', `${(st.speed / 1000).toFixed(0)} km/s (${(st.speed / 299792458 * 100).toFixed(2)} % de c)`) + row('Accélération', `${vy.accG} g`) +
      row('Distance restante', `${((1 - st.progress) * d / 1e6).toFixed(1)} M km`) +
      row('Poussée continue', `${dur(st.burn)} / ${vy.prop.maxDays || 6} j max`, burnPct > 85 ? 'warn' : '') +
      (o ? row('Délai de message → ' + vy.site.name, min(dist(sh.pos, o))) : '') + (de ? row('Délai de message → ' + vy.dest.name, min(dist(sh.pos, de))) : '') + '</dl>' +
      (v.plan.hasRest ? '<p class="note">Plus de 6 jours de poussée : le moteur est coupé au milieu du trajet (repos supposé d\'un jour) pour éviter la surchauffe.</p>' : '');
  }

  // ---------- Ciel, fiche de scène, éphémérides ----------
  fmtT(t) {
    const y = Math.floor(t / DAYS_PER_YEAR), d = t - y * DAYS_PER_YEAR;
    return `An ${String(y).replace('-', '−')} · jour ${Math.floor(d)} · ${String(Math.floor((d % 1) * 24)).padStart(2, '0')} h`;
  }
  rotParams() { return this.world.bodies.map((o) => ({ phase0: o.phase0, protDays: o.protDays })); }

  bindSiteTools() {
    $('#sky-center').addEventListener('change', () => this.drawSkyNow());
    $('#sky-fov').addEventListener('change', () => this.drawSkyNow());
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
    drawSky($('#sky'), sky, { center: $('#sky-center').value, fov: +$('#sky-fov').value, atm, surface: site.type === 'surface' || site.type === 'floating', parentName });
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
        const detail = e.duration != null ? `${e.who} ← ${e.by}, ${e.duration < 1 / 12 ? (e.duration * 1440).toFixed(0) + ' min' : (e.duration * 24).toFixed(1) + ' h'}` : e.by ? `${e.who} – ${e.by}` : e.who;
        const dt = e.t - now;
        return `<li><button type="button" data-t="${e.t}"><span><b>${e.type}</b> · ${detail}</span><small>${this.fmtT(e.t)} · dans ${dt < 2 ? (dt * 24).toFixed(1) + ' h' : dt < 400 ? dt.toFixed(1) + ' j' : (dt / DAYS_PER_YEAR).toFixed(2) + ' ans'}</small></button></li>`;
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
    if (window.innerWidth <= 860) document.body.classList.remove('show-bodies');
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
      h += `<h3>${r.prop.label}</h3><dl>${row('Durée (retournement à mi-course)', c.days < 2 ? `${nf(c.days * 24, 1)} h` : fmtDur(c.days))}${row('Vitesse de pointe', `${nf(c.peakBeta, c.peakBeta < 0.01 ? 4 : 3)} c${c.cruised ? ' (croisière atteinte)' : ''}`)}${row('Accélération', `${nf(c.accG, 1)} g`)}`;
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
    let h = `<h2>${site.name}</h2><div class="sub">${type}${site.body !== 'Nunzir' ? ' · ' + site.body : ''} · ${site.population.toLocaleString('fr-FR')} humains${site.tyts ? ' + ' + site.tyts.toLocaleString('fr-FR') + ' Tyts' : ''}</div><p>${site.role}</p>`;
    if (site.invented) h += `<p class="note">Emplacement et population proposés (le document ne les fixe pas) : à valider (données dans app/src/data/sites.js).</p>`;
    if (rec?.st) {
      const rep = siteReport({ sim: this.sim, el: (i) => this.world.bodies[i].el }, site, rec.st, this.target);
      for (const sec of rep.sections) h += `<h3>${sec.title}</h3><dl>${sec.rows.map(([k, v]) => row(k, v)).join('')}</dl>`;
      h += rep.notes.map((t) => `<p class="note">${t}</p>`).join('');
    }
    return h + '<h3 style="margin-top:18px">Corps</h3>';
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
    $('#btn-bodies').addEventListener('click', () => { document.body.classList.toggle('show-bodies'); document.body.classList.remove('show-info'); this.aria(); });
    $('#btn-info').addEventListener('click', () => { document.body.classList.toggle('show-info'); document.body.classList.remove('show-bodies'); this.aria(); });
    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
      if (e.code === 'Space') { e.preventDefault(); $('#play').click(); }
    });
  }
  aria() {
    $('#btn-bodies').setAttribute('aria-expanded', document.body.classList.contains('show-bodies'));
    $('#btn-info').setAttribute('aria-expanded', document.body.classList.contains('show-info'));
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
    if (fly && window.innerWidth <= 860) document.body.classList.remove('show-bodies');
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
    const hours = (d) => (d * 24 < 48 ? `${f(d * 24, 1)} h` : `${f(d, 2)} j (${f(d * 24, 0)} h)`);
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

  // Valeurs physiques dérivées en direct ; appelé ~4 fois par seconde.
  renderInfo() {
    const w = this.world, sim = this.sim, o = w.bodies[this.selected], b = o.b, d = b.def, star = sim.bodies[0];
    const rp = sim.rPos;
    const dStar = (i) => Math.hypot(rp[3 * i] - rp[0], rp[3 * i + 1] - rp[1], rp[3 * i + 2] - rp[2]);
    const names = d.names || {};
    let h = this.selectedSite ? this.siteHtml() : '';
    h += `<h2>${d.name}</h2><div class="sub">${b.type === 'star' ? 'Étoile (F6V)' : b.type === 'planet' ? (d.kind === 'gas' ? 'Planète gazeuse' : 'Planète tellurique') : 'Lune de ' + sim.bodies[b.parent].def.name}</div>`;
    h += `<h3>Noms</h3><dl>${row('Nom tyt sacré', names.tyt || '—')}${names.tytCourant && names.tytCourant !== names.tyt ? row('Courant', names.tytCourant) : ''}${names.sens ? row('Sens', `« ${names.sens} »`) : ''}</dl>`;
    h += `<p>${d.role}</p>`;
    const bk = bulk(b.mass, b.radiusKm);
    h += `<h3>Physique</h3><dl>${row('Masse', fmtMass(b.mass))}${row('Rayon', `${f(b.radiusKm, 0)} km`)}${row('Densité', `${f(bk.rho, 2)} g/cm³`)}${row('Gravité de surface', `${f(bk.gSurf, 2)} m/s² (${f(bk.gSurf / 9.80665, 2)} g)`)}${row('Vitesse de libération', `${f(bk.vEsc, 2)} km/s`)}`;
    h += this.dayRows(o, b);
    if (o.protDays && b.type === 'planet' && o.flat > 1e-4) h += row('Aplatissement', f(o.flat, 4));
    if (b.type !== 'star') h += row('Inclinaison de l\'axe', `${f(b.tilt / DEG, 1)}°`);
    if (b.type === 'star') h += row('Température', `${d.teff} K`) + row('Luminosité', `${f(this.L, 2)} L☉`);
    h += '</dl>';
    if (b.type === 'star') {
      const hz = this.hz;
      h += `<h3>Zone habitable (Kopparapu 2013)</h3><dl>${row('Conservative', `${f(hz.conservative[0], 2)} – ${f(hz.conservative[1], 2)} UA`)}${row('Optimiste', `${f(hz.optimistic[0], 2)} – ${f(hz.optimistic[1], 2)} UA`)}${row('Ceinture Nunzir', `${BELT.aMin} – ${BELT.aMax} UA`)}</dl>`;
      h += `<p class="note">${BELT.role}</p>`;
    } else if (o.el) {
      const e = o.el, par = sim.bodies[b.parent];
      h += `<h3>Orbite (osculatrice, en direct)</h3><dl>`;
      if (b.type === 'planet') {
        h += row('Demi-grand axe', `${f(e.a, 4)} UA`) + row('Distance actuelle', `${f(dStar(b.idx), 4)} UA`) + row('Périhélie / aphélie', `${f(e.rp, 3)} / ${f(e.ra, 3)} UA`);
        h += row('Période', fmtDur(e.period)) + row('Excentricité', f(e.e, 4)) + row('Inclinaison (écliptique)', `${f(e.i / DEG, 2)}°`) + row('Longitude du périhélie ϖ', `${f(((e.varpi / DEG) % 360 + 360) % 360, 3)}°`);
      } else {
        const pole = poleVector(par.tilt, par.node), hm = Math.hypot(...e.h);
        const inc = Math.acos((e.h[0] * pole[0] + e.h[1] * pole[1] + e.h[2] * pole[2]) / hm) / DEG;
        h += row('Demi-grand axe', `${f(e.a * AU_KM, 0)} km (${f(e.a * AU_KM / par.radiusKm, 1)} R)`) + row('Période', fmtDur(e.period)) + row('Excentricité', f(e.e, 4)) + row('Inclinaison (équateur)', `${f(inc, 2)}°`);
      }
      h += '</dl>';
      // dynamique
      if (b.type === 'planet') {
        const pa = par.def.orbit, rh = hillRadius(e.a, e.e, sim.mEff[b.idx], star.mass);
        h += `<h3>Dynamique</h3><dl>${row('Rayon de Hill', `${f(rh, 4)} UA (${f(rh * AU_KM / 1e6, 2)} M km)`)}</dl>`;
        void pa;
      } else {
        const pi = par.idx, pe = o && w.bodies[pi].el;
        const rh = hillRadius(pe.a, pe.e, sim.mEff[pi], star.mass), lim = stableSatelliteLimit(rh, pe.e, o.el.e);
        const rho = bulk(b.mass, b.radiusKm).rho, rhoP = bulk(par.mass, par.radiusKm).rho;
        const roche = rocheLimitKm(par.radiusKm, rhoP, rho), ratio = (o.el.a / rh);
        h += `<h3>Dynamique</h3><dl>${row('a / rayon de Hill', `${f(ratio, 3)} (limite ${f(lim / rh, 2)})`, o.el.a < lim ? 'ok' : 'warn')}${row('Limite de Roche', `${f(roche, 0)} km`, o.el.a * AU_KM > roche ? 'ok' : 'warn')}</dl>`;
      }
      // thermique
      const di = b.type === 'planet' ? dStar(b.idx) : dStar(b.parent);
      const Teq = equilibriumTemp(star.def, di, d.albedo ?? 0.3), S = insolation(this.L, di);
      const [hi, ho] = this.hz.conservative, [oi, oo] = this.hz.optimistic;
      const zone = di >= hi && di <= ho ? ['dans la zone habitable', 'ok'] : di >= oi && di <= oo ? ['zone habitable optimiste', 'ok'] : di < oi ? ['trop proche', 'warn'] : ['trop loin', 'warn'];
      h += `<h3>Thermique</h3><dl>${row('Éclairement', `${f(S, 3)} × Terre`)}${row('T équilibre (A=' + (d.albedo ?? 0.3) + ')', `${f(Teq, 0)} K (${f(Teq - 273.15, 0)} °C)`)}${row('Position', zone[0], zone[1])}</dl>`;
      if (d.id === 'kebet') h += `<p class="note">Kebet reçoit l'éclairement d'une planète en bordure de zone habitable ; la rotation synchrone et l'effet de serre de son atmosphère décident du reste.</p>`;
    }
    h += this.habitabilityHtml(b);
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
    const y = Math.floor(t / DAYS_PER_YEAR), dd = t - y * DAYS_PER_YEAR;
    if (!this.calculating) {
      const fr = dd % 1, p2 = (n) => String(Math.floor(n)).padStart(2, '0');
      const clock = this.speedIdx <= 2 ? `${p2(fr * 24)}:${p2((fr * 1440) % 60)}:${p2((fr * 86400) % 60)}` : `${p2(fr * 24)} h`; // secondes seulement aux vitesses lisibles
      $('#date').textContent = `An ${String(y).replace('-', '−')} · jour ${Math.floor(dd)} · ${clock}`;
    }
    if (y !== this.lastYear) { this.lastYear = y; const r = $('#chrono-range'); if (r && document.activeElement !== r) { r.value = Math.max(-960, Math.min(60, y)); this.chronoLabel(y); } }
    if (this.voyage) { this.voyageAcc = (this.voyageAcc || 0) + dt; if (this.voyageAcc > 0.15) { this.voyageAcc = 0; this.updateVoyage(); } }
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
