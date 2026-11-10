// Lancé chaque heure par GitHub Actions : envoie un rappel ntfy tant que l'heure
// d'apprentissage du jour n'est pas faite (message "DONE AAAA-MM-JJ" publié par l'app),
// sauf les veilles de contrôles / rendus importants.
import { skipReason, parisToday } from "../skip.js";
const { SUPABASE_URL, SUPABASE_KEY, GDN_EMAIL, GDN_PASSWORD, NTFY_TOPIC } = process.env;
if (!NTFY_TOPIC) { console.log("NTFY_TOPIC manquant"); process.exit(0); }
const day = parisToday(), topic = `https://ntfy.sh/${encodeURIComponent(NTFY_TOPIC)}`;
const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric" }).format(new Date()));
if (hour < 8 || hour > 22) process.exit(0);

const msgs = await (await fetch(`${topic}/json?poll=1&since=24h`)).text();
if (msgs.split("\n").some((l) => l && JSON.parse(l).message === `DONE ${day}`)) { console.log("Déjà fait"); process.exit(0); }

let homework = [];
if (GDN_PASSWORD) {
  const h = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
  const a = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: h, body: JSON.stringify({ email: GDN_EMAIL, password: GDN_PASSWORD }) })).json();
  if (a.access_token) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/items?select=data&collection=eq.homework&deleted_at=is.null`, { headers: { ...h, Authorization: `Bearer ${a.access_token}` } });
    homework = (await r.json()).map((x) => x.data);
  } else console.log("Connexion Supabase échouée");
}
const why = skipReason(day, homework);
if (why) { console.log("Jour sauté :", why.title); process.exit(0); }
await fetch(topic, { method: "POST", body: "Tu n'as pas encore fait ton heure d'apprentissage aujourd'hui. Ouvre « Note du cours du jour » !",
  headers: { Title: "📚 1h d'apprentissage", Priority: hour >= 20 ? "urgent" : "high", Tags: "books", Click: process.env.APP_URL || "" } });
console.log("Rappel envoyé");
