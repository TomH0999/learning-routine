// Règle partagée (app + GitHub Action) : un jour est sauté s'il est la veille d'un
// contrôle/test ou d'un rendu important (SAÉ, ou importance >= 3), non terminé.
export const IMPORTANT_TYPES = ["controle", "test", "sae"];
export function isImportant(hw) {
  return hw && hw.status !== "done" && hw.dueDate && (IMPORTANT_TYPES.includes(hw.type) || Number(hw.importance) >= 3);
}
export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function parisToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(now);
}
/** Renvoie l'entrée qui fait sauter `day`, ou null. */
export function skipReason(day, homework) {
  const tomorrow = addDays(day, 1);
  return homework.find((h) => isImportant(h) && h.dueDate === tomorrow) || null;
}
