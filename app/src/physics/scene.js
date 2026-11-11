import { AU_KM } from './constants.js';
import { ambianceFor } from '../data/ambiances.js';

const f = (x, d = 1) => (Math.abs(x) >= 1e5 ? x.toExponential(1) : x.toFixed(d));
const deg = (r) => r * 180 / Math.PI;
const dur = (d) => (d < 1 / 24 ? `${f(d * 1440, 0)} min` : d < 2 ? `${f(d * 24, 1)} h` : `${f(d, 1)} j`);
const MOON_DEG = 0.52;

/**
 * Fiche de scène : conditions réelles d'un site à un instant (lumière, ciel, corps, communications) + banque d'images.
 * in : { site, sky, report, events (levers/couchers/éclipses à venir, t en jours), t, comms [{name, minutes}] }
 */
export function buildScene({ site, sky, report, events, t, comms, title }) {
  const amb = ambianceFor(site), blocks = [], el = deg(sky.sunEl);
  const star = sky.objs.find((o) => o.type === 'star');
  const sunEv = events.filter((e) => /étoile/.test(e.type) && e.t > t).sort((a, b) => a.t - b.t)[0];
  const next = (re) => events.filter((e) => re.test(e.type) && e.t > t).sort((a, b) => a.t - b.t)[0];
  const surface = site.type === 'surface' || site.type === 'floating';

  // --- Lumière et heure du jour ---
  const light = [];
  if (surface) {
    const rising = sunEv && /Lever/.test(sunEv.type);
    let phase = el < -12 ? 'nuit profonde' : el < -4 ? (rising ? 'avant l\'aube' : 'crépuscule avancé') : el < 6 ? (rising ? 'aube' : 'crépuscule') : el < 25 ? (rising ? 'matin' : 'fin d\'après-midi') : el < 55 ? 'plein jour' : 'midi';
    light.push(`${phase} — l'étoile est à ${f(el, 0)}° ${el >= 0 ? 'au-dessus' : 'sous'} l'horizon.`);
    if (sunEv) light.push(`${sunEv.type.replace('de l\'étoile', '')} dans ${dur(sunEv.t - t)}.`);
  } else light.push(`Étoile à ${f(el, 0)}° de hauteur ; pas d'horizon : ${sky.eclipse ? 'éclipse en cours' : 'lumière directe'}.`);
  if (star) light.push(`Omraon mesure ${f(deg(star.angR) * 2, 2)}° de diamètre (${f(deg(star.angR) * 2 / MOON_DEG, 2)} × la Lune vue de la Terre).`);
  if (sky.eclipse) light.push(`ÉCLIPSE : ${sky.eclipse.by} masque ${f(sky.eclipse.fraction * 100, 0)} % de l'étoile${sky.eclipse.total ? ' (totale)' : ''}.`);
  const ecl = next(/Éclipse/);
  if (ecl) light.push(`Prochaine éclipse (${ecl.by} devant l'étoile) dans ${dur(ecl.t - t)}, durée ${dur(ecl.duration)}${/totale/.test(ecl.type) ? ', totale' : ''}.`);
  blocks.push({ h: 'Lumière et heure du jour', lines: light });

  // --- Ciel ---
  const sk = [];
  for (const o of sky.objs.filter((x) => x.type !== 'star' && (!surface || x.el > -x.angR)).sort((a, b) => b.angR - a.angR)) {
    const d = deg(o.angR) * 2;
    if (d >= 0.05) sk.push(`${o.name} : ${f(d, d > 1 ? 1 : 2)}° de diamètre (${f(d / MOON_DEG, 1)} × la Lune), ${f(o.frac * 100, 0)} % éclairé, hauteur ${f(deg(o.el), 0)}°.`);
    else if (o.type === 'planet') sk.push(`${o.name} : simple point lumineux (${f(o.frac * 100, 0)} % éclairé), hauteur ${f(deg(o.el), 0)}°.`);
  }
  blocks.push({ h: 'Ciel', lines: sk.length ? sk : ['Rien de remarquable à l\'œil nu hormis l\'étoile et les étoiles lointaines.'] });

  // --- Conditions physiques ---
  const cond = [];
  for (const sec of report.sections) if (['Environnement', 'Thermique', 'Rayonnement'].includes(sec.title)) for (const [k, v] of sec.rows) if (!/Distance|Éclairement|Soleil|Éclipse/.test(k)) cond.push(`${k} : ${v}`);
  blocks.push({ h: 'Conditions physiques', lines: cond });

  // --- Communications ---
  blocks.push({ h: 'Communications (délai lumière actuel)', lines: comms.map((c) => `Vers ${c.name} : ${c.minutes < 1 ? f(c.minutes * 60, 0) + ' s' : c.minutes < 120 ? f(c.minutes, 1) + ' min' : f(c.minutes / 60, 1) + ' h'}.`) });

  // --- Banque d'images ---
  const bank = [];
  const add = (h, arr) => arr?.length && bank.push(`${h} : ${arr.join(' ')}`);
  add('Voir', [...amb.voir, ...amb.extra]); add('Entendre', amb.entendre); add('Sentir', amb.sentir); add('Toucher', amb.toucher); add('Les corps', amb.corps);
  if (amb.faussenote) bank.push(`La fausse note : ${amb.faussenote}`);
  blocks.push({ h: amb.titre + (amb.canon ? '' : ' — non canon'), lines: bank });

  const text = `${title}\n\n` + blocks.map((b) => `${b.h.toUpperCase()}\n${b.lines.map((l) => '- ' + l).join('\n')}`).join('\n\n');
  return { title, blocks, text };
}
