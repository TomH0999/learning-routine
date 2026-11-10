import { skipReason, parisToday, isImportant } from "./skip.js";
const C = window.LR_CONFIG, GOAL = C.goalMinutes * 60;
const $ = (s) => document.querySelector(s);
const K = { notes: "lr_notes", prog: "lr_progress", auth: "lr_auth", hw: "lr_homework", topic: "lr_topic", done: "lr_done_sent", remote: "lr_progress_remote", dev: "lr_device", cur: "lr_sync_cursor" };
const DEV = localStorage.getItem(K.dev) || (localStorage.setItem(K.dev, crypto.randomUUID().slice(0, 8)), localStorage.getItem(K.dev));
const liveNotes = () => load(K.notes, []).filter((n) => !n.deleted);
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const today = () => parisToday();
let current = null; // id de la note en cours d'édition

// ---------- Navigation ----------
function show(v) {
  for (const s of document.querySelectorAll("main>section")) s.hidden = s.id !== v;
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  $("nav").hidden = v === "note";
  if (v === "today") renderToday(); if (v === "notes") renderList(); if (v === "settings") renderSettings();
}
document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => show(b.dataset.v)));

// ---------- Chrono ----------
const progress = (d = today()) => (load(K.prog, {})[d] || 0) + Object.entries(load(K.remote, {})[d] || {}).reduce((t, [dev, v]) => t + (dev === DEV ? 0 : v), 0);
function addProgress(sec) { const p = load(K.prog, {}); p[today()] = (p[today()] || 0) + sec; save(K.prog, p); }
let last = null;
setInterval(() => {
  const active = !$("#note").hidden && document.visibilityState === "visible";
  const now = Date.now();
  if (active && last) addProgress(Math.min(5, (now - last) / 1000));
  last = active ? now : null;
  const rest = GOAL - progress();
  $("#noteTimer").textContent = rest > 0 ? fmt(rest) : "✅ 1h faite";
  if (rest <= 0) markDone();
}, 1000);
document.addEventListener("visibilitychange", () => { last = null; });

async function markDone() {
  const sent = load(K.done, ""); if (sent === today()) return;
  const topic = load(K.topic, ""); if (!topic) return;
  try { await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: "POST", body: `DONE ${today()}`, headers: { Tags: "white_check_mark" } }); save(K.done, today()); } catch {}
}

// ---------- Aujourd'hui ----------
function renderToday() {
  const hw = load(K.hw, { items: [] }).items, d = today(), why = skipReason(d, hw), p = progress();
  $("#timer").textContent = p >= GOAL ? "✅ Objectif atteint" : fmt(GOAL - p);
  $("#prog").style.width = Math.min(100, (p / GOAL) * 100) + "%";
  $("#dayStatus").innerHTML = why
    ? `🛌 <b>Jour sauté</b> : veille de « ${esc(why.title)} » (${esc(why.type)}). Révise plutôt ça !`
    : p >= GOAL ? "🎉 Apprentissage du jour terminé." : "🎯 Objectif : 1h d'apprentissage aujourd'hui.";
  const up = hw.filter((h) => isImportant(h) && h.dueDate >= d).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  $("#upcoming").innerHTML = "<h3>Prochaines échéances importantes</h3>" + (up.length ? up.map((h) => `<div>📌 ${esc(h.dueDate)} — ${esc(h.title)} <span class="hint">(${esc(h.type)})</span></div>`).join("") : '<p class="hint">Aucune (ou non synchronisé : voir Réglages).</p>');
}
$("#startNote").onclick = () => {
  const notes = load(K.notes, []);
  let n = notes.find((x) => x.date === today() && !x.deleted);
  if (!n) { n = { id: crypto.randomUUID(), date: today(), title: "", subject: "", content: "", createdAt: Date.now(), updatedAt: Date.now() }; notes.push(n); save(K.notes, notes); }
  openEditor(n.id);
};
function openEditor(id) {
  const n = load(K.notes, []).find((x) => x.id === id); if (!n) return;
  current = id; $("#nTitle").value = n.title; $("#nSubject").value = n.subject; $("#nContent").value = n.content; $("#saved").textContent = `Leçon du ${n.date}`;
  $("#modal").hidden = true; show("note");
}
function saveNote() {
  const notes = load(K.notes, []), n = notes.find((x) => x.id === current); if (!n) return;
  Object.assign(n, { title: $("#nTitle").value, subject: $("#nSubject").value, content: $("#nContent").value, updatedAt: Date.now() });
  save(K.notes, notes); queueSync(); $("#saved").textContent = `Enregistré à ${new Date().toLocaleTimeString("fr-FR")}`;
}
["#nTitle", "#nSubject", "#nContent"].forEach((s) => $(s).addEventListener("input", saveNote));
$("#closeNote").onclick = () => { saveNote(); current = null; show("today"); };

// ---------- Leçons ----------
function renderList() {
  const q = $("#q").value.toLowerCase().trim(), d = $("#qDate").value, s = $("#sort").value;
  let notes = liveNotes().filter((n) => (!d || n.date === d) && (!q || `${n.title} ${n.subject} ${n.content}`.toLowerCase().includes(q)));
  const cmp = { "date-desc": (a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt, "date-asc": (a, b) => a.date.localeCompare(b.date), title: (a, b) => (a.title || "").localeCompare(b.title || "", "fr"), subject: (a, b) => (a.subject || "").localeCompare(b.subject || "", "fr") || b.date.localeCompare(a.date), len: (a, b) => b.content.length - a.content.length };
  notes.sort(cmp[s]);
  $("#list").innerHTML = notes.length ? notes.map((n) => `<div class="card item" data-id="${n.id}"><b>${esc(n.title || "(sans titre)")}</b><div class="hint">${esc(n.date)} · ${esc(n.subject || "—")}</div><div class="excerpt">${esc(n.content.slice(0, 120))}</div></div>`).join("") : '<p class="hint">Aucune leçon.</p>';
  document.querySelectorAll(".item").forEach((el) => (el.onclick = () => openModal(el.dataset.id)));
}
["#q", "#qDate", "#sort"].forEach((s) => $(s).addEventListener("input", renderList));
function openModal(id) {
  const n = load(K.notes, []).find((x) => x.id === id);
  $("#mTitle").textContent = n.title || "(sans titre)"; $("#mMeta").textContent = `${n.date} · ${n.subject || "—"}`; $("#mBody").textContent = n.content;
  $("#mEdit").onclick = () => openEditor(id);
  $("#mDel").onclick = () => { if (confirm("Supprimer cette leçon ?")) { save(K.notes, load(K.notes, []).map((x) => x.id === id ? { id, date: x.date, deleted: true, updatedAt: Date.now() } : x)); queueSync(); $("#modal").hidden = true; renderList(); } };
  $("#modal").hidden = false;
}
$("#mClose").onclick = () => ($("#modal").hidden = true);

// ---------- Supabase (lecture seule des devoirs) ----------
const H = (tok) => ({ apikey: C.supabaseKey, Authorization: `Bearer ${tok || C.supabaseKey}`, "Content-Type": "application/json" });
async function auth(body, grant) {
  const r = await fetch(`${C.supabaseUrl}/auth/v1/token?grant_type=${grant}`, { method: "POST", headers: H(), body: JSON.stringify(body) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.msg || "Échec de connexion");
  save(K.auth, { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000 }); return j.access_token;
}
async function token() {
  const a = load(K.auth, null); if (!a) return null;
  if (Date.now() < a.exp - 60000) return a.access;
  return auth({ refresh_token: a.refresh }, "refresh_token");
}
async function syncHomework() {
  const t = await token(); if (!t) return;
  const r = await fetch(`${C.supabaseUrl}/rest/v1/items?select=data&collection=eq.homework&deleted_at=is.null`, { headers: H(t) });
  if (!r.ok) throw new Error("Lecture des devoirs impossible");
  save(K.hw, { items: (await r.json()).map((x) => x.data), at: Date.now() });
}
function renderSettings() {
  const hw = load(K.hw, null);
  $("#authState").textContent = load(K.auth, null) ? `Connecté. ${hw ? hw.items.length + " devoirs, synchro " + new Date(hw.at).toLocaleString("fr-FR") : ""}` : "Non connecté.";
  $("#topic").value = load(K.topic, "");
}
$("#login").onclick = async () => { try { await auth({ email: C.email, password: $("#pwd").value }, "password"); $("#pwd").value = ""; await syncHomework(); await syncAll(true); } catch (e) { alert(e.message); } renderSettings(); };
$("#sync").onclick = async () => { try { await syncHomework(); await syncAll(true); } catch (e) { alert(e.message); } renderSettings(); };
$("#saveTopic").onclick = () => { save(K.topic, $("#topic").value.trim()); alert("Enregistré"); };
$("#testNtfy").onclick = () => fetch(`https://ntfy.sh/${encodeURIComponent($("#topic").value.trim())}`, { method: "POST", body: "Test de la routine d'apprentissage ✅" });

// ---------- Synchronisation entre appareils (table lr_items) ----------
let syncTimer = null, syncing = false;
function queueSync() { clearTimeout(syncTimer); syncTimer = setTimeout(syncAll, 1500); }
async function syncAll(full = false) {
  if (syncing) return; const t = await token().catch(() => null); if (!t) return setSync("Hors ligne / non connecté");
  syncing = true;
  try {
    const cur = full ? 0 : load(K.cur, 0), start = Date.now();
    const rows = await (await fetch(`${C.supabaseUrl}/rest/v1/lr_items?select=id,kind,data,deleted,updated_at`, { headers: H(t) })).json();
    if (!Array.isArray(rows)) throw new Error(rows.message || "synchro");
    const notes = load(K.notes, []), byId = new Map(notes.map((n) => [n.id, n])), remote = {}, push = [];
    for (const r of rows) {
      if (r.kind === "note") {
        const l = byId.get(r.id);
        if (!l || l.updatedAt < r.updated_at) { const n = r.deleted ? { id: r.id, date: r.data.date, deleted: true, updatedAt: r.updated_at } : { ...r.data, id: r.id, updatedAt: r.updated_at }; byId.set(r.id, n); }
        else if (l.updatedAt > r.updated_at) push.push(l);
      } else if (r.kind === "progress") { (remote[r.data.date] ??= {})[r.data.dev] = r.data.sec; }
    }
    const known = new Set(rows.map((r) => r.id));
    for (const n of notes) if (!known.has(n.id)) push.push(n);
    save(K.notes, [...byId.values()]); save(K.remote, remote);
    const body = push.map((n) => ({ id: n.id, kind: "note", deleted: !!n.deleted, updated_at: n.updatedAt, data: n.deleted ? { date: n.date } : { date: n.date, title: n.title, subject: n.subject, content: n.content, createdAt: n.createdAt } }));
    for (const [date, sec] of Object.entries(load(K.prog, {}))) if (!remote[date] || Math.abs((remote[date][DEV] || 0) - sec) > 1) body.push({ id: `p-${date}-${DEV}`, kind: "progress", deleted: false, updated_at: Date.now(), data: { date, dev: DEV, sec: Math.round(sec) } });
    if (body.length) {
      const r = await fetch(`${C.supabaseUrl}/rest/v1/lr_items?on_conflict=user_id,id`, { method: "POST", headers: { ...H(t), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("envoi refusé");
    }
    save(K.cur, start); setSync(`Synchronisé ${new Date().toLocaleTimeString("fr-FR")}`);
    if (!$("#notes").hidden) renderList(); if (!$("#today").hidden) renderToday();
  } catch (e) { setSync("Erreur de synchro : " + e.message); } finally { syncing = false; }
}
function setSync(m) { const el = $("#syncState"); if (el) el.textContent = m; }

// ---------- Export / import (conservation des données) ----------
$("#export").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "learning-routine", v: 1, notes: liveNotes(), progress: load(K.prog, {}) }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `routine-${today()}.json`; a.click();
};
$("#import").onchange = async (e) => {
  const d = JSON.parse(await e.target.files[0].text()), notes = load(K.notes, []), ids = new Set(notes.map((n) => n.id));
  for (const n of d.notes || []) if (!ids.has(n.id)) notes.push(n);
  const p = load(K.prog, {}); for (const [k, v] of Object.entries(d.progress || {})) p[k] = Math.max(p[k] || 0, v);
  save(K.notes, notes); save(K.prog, p); syncAll(true); alert("Import terminé (fusion, rien n'est écrasé)."); show("today");
};

window.lrStatus = () => { const left = GOAL - progress(); return { done: left <= 0, skipped: !!skipReason(today(), load(K.hw, { items: [] }).items), left: Math.ceil(Math.max(0, left) / 60) }; };
navigator.storage?.persist?.().then((ok) => ($("#persist").textContent = ok ? "Stockage persistant activé." : "Pense à exporter régulièrement tes notes."));
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js");
syncHomework().catch(() => {}).finally(renderToday);
syncAll();
setInterval(() => document.visibilityState === "visible" && syncAll(), 30000);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && syncAll());
window.addEventListener("online", syncAll);
show("today");
