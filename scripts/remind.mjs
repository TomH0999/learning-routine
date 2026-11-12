// Lancé par GitHub Actions plusieurs fois par heure : envoie un rappel ntfy (au plus 1 par heure)
// tant que l'heure d'apprentissage du jour n'est pas faite, sauf les veilles de contrôles / rendus importants.
// « Fait » = message "DONE AAAA-MM-JJ" publié par l'app OU 60 min cumulées dans la synchro Supabase.
import { skipReason, parisToday } from "../skip.js";
const { SUPABASE_URL, SUPABASE_KEY, GDN_EMAIL, GDN_PASSWORD, NTFY_TOPIC, APP_URL, FORCE } = process.env;
const GOAL = 3600;
if (!NTFY_TOPIC) { console.log("Secret NTFY_TOPIC manquant : aucun rappel possible."); process.exit(0); }
const day = parisToday(), topic = `https://ntfy.sh/${encodeURIComponent(NTFY_TOPIC)}`;
const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
console.log(`Jour ${day}, ${hour}h (Paris)`);
if (!FORCE && (hour < 8 || hour > 22)) { console.log("Hors plage 8h-22h"); process.exit(0); }

// 1) historique ntfy des dernières 24 h
const lines = (await (await fetch(`${topic}/json?poll=1&since=24h`)).text()).split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return {}; } });
if (lines.some((m) => m.message === `DONE ${day}`)) { console.log("Déjà fait (signal de l'app)"); process.exit(0); }
const lastReminder = Math.max(0, ...lines.filter((m) => m.event === "message" && (m.tags || []).includes("lr-reminder")).map((m) => m.time * 1000));
if (!FORCE && Date.now() - lastReminder < 50 * 60 * 1000) { console.log("Rappel déjà envoyé il y a moins de 50 min"); process.exit(0); }

// 2) devoirs (jours sautés) + progression synchronisée
let homework = [], done = 0;
if (GDN_PASSWORD) {
  const h = { apikey: SUPABASE_KEY, "Content-Type": "application/json" };
  const a = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: h, body: JSON.stringify({ email: GDN_EMAIL, password: GDN_PASSWORD }) })).json();
  if (a.access_token) {
    const H = { ...h, Authorization: `Bearer ${a.access_token}` };
    homework = (await (await fetch(`${SUPABASE_URL}/rest/v1/items?select=data&collection=eq.homework&deleted_at=is.null`, { headers: H })).json()).map((x) => x.data);
    const prog = await (await fetch(`${SUPABASE_URL}/rest/v1/lr_items?select=data&kind=eq.progress&id=like.p-${day}-*`, { headers: H })).json();
    if (Array.isArray(prog)) done = prog.reduce((t, r) => t + (Number(r.data?.sec) || 0), 0);
  } else console.log("Connexion Supabase échouée :", a.error_description || a.msg || "?");
} else console.log("Secret GDN_PASSWORD absent : jours sautés et progression non vérifiés");
if (done >= GOAL) { console.log("Déjà fait (progression synchronisée)"); process.exit(0); }
const why = skipReason(day, homework);
if (why) { console.log("Jour sauté :", why.title); process.exit(0); }

// 3) envoi (en-têtes HTTP en ASCII uniquement : l'émoji passe par le tag "books")
const left = Math.ceil((GOAL - done) / 60);
const r = await fetch(topic, {
  method: "POST",
  body: `Il te reste ${left} min d'apprentissage aujourd'hui. Ouvre « Note du cours du jour » !`,
  headers: { Title: "1h d'apprentissage", Priority: hour >= 20 ? "urgent" : "high", Tags: "books,lr-reminder", ...(APP_URL ? { Click: APP_URL } : {}) }
});
console.log("Rappel envoyé :", r.status);
if (!r.ok) process.exit(1);
