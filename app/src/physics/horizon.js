/** Distance à l'horizon (m) pour un œil à la hauteur h au-dessus d'un monde de rayon R. */
export const horizonDistance = (R, h) => Math.sqrt(2 * R * h + h * h);
/** Chute de la surface (m) à la distance r (m) de l'observateur : R − √(R² − r²). */
export const surfaceDrop = (R, r) => (r >= R ? R : R - Math.sqrt(R * R - r * r));
/** Dépression de l'horizon (°) vue de la hauteur h. */
export const horizonDip = (R, h) => Math.acos(R / (R + h)) * 180 / Math.PI;
