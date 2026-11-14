import { uiAlert, uiConfirm, uiPrompt, initEditor, sanitize, textToHtml, enhanceSelects, toggleCheck } from "./ui.js";
import { skipReason, parisToday, isImportant, addDays } from "./skip.js";
const C = window.LR_CONFIG, GOAL = C.goalMinutes * 60;
const $ = (s) => document.querySelector(s);
const K = { notes: "lr_notes", prog: "lr_progress", auth: "lr_auth", hw: "lr_homework", topic: "lr_topic", done: "lr_done_sent", remote: "lr_progress_remote", dev: "lr_device", cur: "lr_sync_cursor", topics: "lr_topics" };
const DEV = localStorage.getItem(K.dev) || (localStorage.setItem(K.dev, crypto.randomUUID().slice(0, 8)), localStorage.getItem(K.dev));
const liveNotes = () => load(K.notes, []).filter((n) => !n.deleted);
const DEFAULT_TAGS = ["BUT1", "BUT2", "BUT3", "Maths prépa", "Bourse"];
const allTags = () => [...new Set([...DEFAULT_TAGS, ...load("lr_tags", []), ...liveNotes().map((n) => n.tag), ...load("lr_topics", []).filter((t) => !t.deleted).map((t) => t.tag)].filter(Boolean))];
function fillTagSelect(sel, value, { any = false, none = "Sans catégorie", add = true } = {}) {
  sel.innerHTML = (any ? '<option value="*">Toutes les catégories</option>' : "") + `<option value="">${none}</option>` + allTags().map((t) => `<option${t === value ? " selected" : ""}>${esc(t)}</option>`).join("") + (add ? '<option value="+">＋ Nouvelle catégorie…</option>' : "");
  sel.value = value ?? (any ? "*" : "");
  sel.dataset.prev = sel.value;
}
function onTagChange(sel, after) {
  sel.addEventListener("change", async () => {
    if (sel.value === "+") {
      const name = ((await uiPrompt("Nom de la nouvelle catégorie", { title: "Nouvelle catégorie", placeholder: "ex : Anglais, Python, Économie…", ok: "Créer" })) || "").trim();
      if (name) { save("lr_tags", [...new Set([...load("lr_tags", []), name])]); fillTagSelect(sel, name, sel.dataset.opts ? JSON.parse(sel.dataset.opts) : {}); }
      else sel.value = sel.dataset.prev || "";
    }
    sel.dataset.prev = sel.value; after && after();
  });
}
const liveTopics = () => load(K.topics, []).filter((t) => !t.deleted);
const norm = (x) => String(x || "").trim().toLowerCase();
const notesOf = (t) => liveNotes().filter((n) => norm(n.subject) === norm(t.name));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const today = () => parisToday();
let current = null, noteSecs = 0; // id de la note en cours d'édition

// ---------- Navigation ----------
function show(v) {
  window.scrollTo(0, 0);
  for (const s of document.querySelectorAll("main>section")) s.hidden = s.id !== v;
  document.querySelectorAll("nav button").forEach((b) => b.classList.toggle("on", b.dataset.v === v));
  $("nav").hidden = v === "note";
  if (window.heroKick) setTimeout(window.heroKick);
  if (v === "today") renderToday(); if (v === "notes") renderList(); if (v === "topics") renderTopics(); if (v === "ach") renderAch(); if (v === "settings") renderSettings();
}
document.querySelectorAll("nav button").forEach((b) => (b.onclick = () => show(b.dataset.v)));

// ---------- Chrono ----------
const progress = (d = today()) => (load(K.prog, {})[d] || 0) + Object.entries(load(K.remote, {})[d] || {}).reduce((t, [dev, v]) => t + (dev === DEV ? 0 : v), 0);
function addProgress(sec) { const p = load(K.prog, {}); p[today()] = (p[today()] || 0) + sec; save(K.prog, p); }
let last = null;
setInterval(() => {
  const active = !$("#note").hidden && document.visibilityState === "visible";
  const now = Date.now();
  if (active && last) { const dt = Math.min(5, (now - last) / 1000); addProgress(dt); noteSecs += dt; if (noteSecs >= 15) saveNote(); }
  last = active ? now : null;
  const rest = GOAL - progress();
  $("#noteTimer").textContent = rest > 0 ? fmt(rest) : "1H OK";
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
  $("#timer").textContent = p >= GOAL ? "DONE" : fmt(GOAL - p);
  $("#prog").style.width = Math.min(100, (p / GOAL) * 100) + "%";
  $("#dayStatus").innerHTML = why
    ? `<b>// Jour sauté</b> — veille de « ${esc(why.title)} » (${esc(why.type)}). Révise plutôt ça !`
    : p >= GOAL ? "[OK] Apprentissage du jour terminé." : "> Objectif : 1h d'apprentissage aujourd'hui.";
  $("#heroStatus").innerHTML = why ? `<i class="dot"></i> JOUR SAUTÉ — révise « ${esc(why.title)} »` : p >= GOAL ? '<i class="dot ok"></i> SESSION DU JOUR VALIDÉE' : `<i class="dot"></i> ${Math.ceil((GOAL - p) / 60)} MIN RESTANTES AUJOURD'HUI`;
  renderStats(hw);
  const up = hw.filter((h) => isImportant(h) && h.dueDate >= d).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
  $("#upcoming").innerHTML = "<h3>Prochaines échéances importantes</h3>" + (up.length ? up.map((h) => `<div><span style="color:var(--ac)">▸</span> ${esc(h.dueDate)} — ${esc(h.title)} <span class="hint">(${esc(h.type)})</span></div>`).join("") : '<p class="hint">Aucune (ou non synchronisé : voir Réglages).</p>');
}
$("#heroGo").onclick = () => $("#startNote").click();
$("#startNote").onclick = () => startSession();
function startSession(topic = null) {
  const notes = load(K.notes, []);
  let n = notes.filter((x) => x.date === today() && !x.deleted).find((x) => (topic ? norm(x.subject) === norm(topic) : true));
  if (!n) { n = { id: crypto.randomUUID(), date: today(), title: "", subject: topic || "", tag: (topic && liveTopics().find((t) => norm(t.name) === norm(topic))?.tag) || "", content: "", secs: 0, createdAt: Date.now(), updatedAt: Date.now() }; notes.push(n); save(K.notes, notes); queueSync(); }
  openEditor(n.id);
}
function openEditor(id) {
  const n = load(K.notes, []).find((x) => x.id === id); if (!n) return;
  current = id; $("#nTitle").value = n.title; $("#nSubject").value = n.subject; fillTagSelect($("#nTag"), n.tag || ""); $("#topicList").innerHTML = liveTopics().map((t) => `<option value="${esc(t.name)}">`).join(""); editor.set(n.html ? sanitize(n.html) : textToHtml(n.content)); $("#saved").textContent = `Leçon du ${n.date}`;
  $("#modal").hidden = true; show("note");
}
let saveTimer = null;
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNote, 500); }
function saveNote() {
  clearTimeout(saveTimer);
  const notes = load(K.notes, []), n = notes.find((x) => x.id === current); if (!n) return;
  n.secs = (n.secs || 0) + noteSecs; noteSecs = 0;
  Object.assign(n, { title: $("#nTitle").value, subject: $("#nSubject").value, tag: $("#nTag").value === "+" ? n.tag || "" : $("#nTag").value, content: editor.text(), html: editor.html(), updatedAt: Date.now() });
  save(K.notes, notes); queueSync(); $("#saved").textContent = `Enregistré à ${new Date().toLocaleTimeString("fr-FR")}`;
}
const editor = initEditor($("#nContent"), $("#rtBar"), scheduleSave);
["#nTitle", "#nSubject", "#nContent"].forEach((s) => { $(s).addEventListener("input", scheduleSave); $(s).addEventListener("blur", saveNote); });
// Entrée dans le titre/sujet : passe au champ suivant au lieu de « valider »
$("#nTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#nSubject").focus(); } });
$("#nSubject").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("#nContent").focus(); } });
$("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); renderList(); } });
addEventListener("pagehide", () => current && saveNote());
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && current && saveNote());
$("#closeNote").onclick = () => { saveNote(); current = null; show("today"); };

// ---------- Tableau de bord ----------
function computeStats(hw) {
  const own = load(K.prog, {}), rem = load(K.remote, {}), d0 = today();
  const dates = [...new Set([...Object.keys(own), ...Object.keys(rem), ...liveNotes().map((n) => n.date)])].filter(Boolean).sort();
  const sec = (d) => progress(d), done = (d) => sec(d) >= GOAL;
  const notes = liveNotes().filter((n) => (n.content || "").trim() || (n.title || "").trim());
  let total = 0; for (const d of dates) total += sec(d);
  let eligible = 0, ok = 0, best = 0, run = 0;
  if (dates.length) for (let d = dates[0]; d <= d0; d = addDays(d, 1)) {
    const skip = !!skipReason(d, hw);
    if (done(d)) { ok++; eligible++; run++; best = Math.max(best, run); }
    else if (skip) continue;
    else if (d === d0) continue;
    else { eligible++; run = 0; }
  }
  let streak = 0;
  for (let d = done(d0) ? d0 : addDays(d0, -1), i = 0; i < 400; d = addDays(d, -1), i++) { if (done(d)) streak++; else if (skipReason(d, hw)) continue; else break; }
  const text = notes.map((n) => n.content || "").join("\n");
  const lines = text.split("\n").filter((l) => l.trim()).length, words = (text.match(/\S+/g) || []).length;
  const subj = {}; for (const n of notes) if (n.subject) subj[n.subject.trim()] = (subj[n.subject.trim()] || 0) + 1;
  const top = Object.entries(subj).sort((a, b) => b[1] - a[1])[0];
  const active = dates.filter((d) => sec(d) > 0).length;
  const week = [...Array(7)].reduce((t, _, i) => t + sec(addDays(d0, -i)), 0);
  const mins = total / 60, level = Math.floor(Math.sqrt(mins / 30)) + 1, lvlLo = (level - 1) ** 2 * 30, lvlHi = level ** 2 * 30;
  const tops = liveTopics();
  return { tDone: tops.filter((t) => t.doneAt).length, tStudied: tops.filter((t) => notesOf(t).length).length, dates, sec, done, lessons: notes.length, ok, pct: eligible ? Math.round((ok / eligible) * 100) : 0, total, lines, words, chars: text.length, streak, best, top, subjects: Object.keys(subj).length, avg: active ? total / active : 0, week, mins, level, lvlPct: ((mins - lvlLo) / (lvlHi - lvlLo)) * 100, toNext: Math.ceil(lvlHi - mins) };
}
const hm = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m}min`; };
function renderStats(hw) {
  const S = computeStats(hw);
  const tiles = [
    ["Leçons complétées", S.lessons, "", "▣"], ["Jours réussis", S.pct, "%", "◎"], ["Temps total", hm(S.total), null, "◷"],
    ["Série actuelle", S.streak, " j", "▲"], ["Meilleure série", S.best, " j", "★"], ["Lignes écrites", S.lines, "", "≡"],
    ["Mots écrits", S.words, "", "✎"], ["Moyenne / jour actif", hm(S.avg), null, "∿"], ["Cette semaine", hm(S.week), null, "▦"],
    ["Sujets maîtrisés", S.tDone, "", "◇"], ["Matière favorite", S.top ? S.top[0] : "—", null, "♥"], ["Sujets étudiés", S.tStudied, "", "⌘"], ["Caractères tapés", S.chars, "", "⌨"]
  ];
  $("#stats").innerHTML = `<div class="tile lvl reveal"><div class="lvl-n">LVL <b data-count="${S.level}">0</b></div><div class="lvl-bar"><i style="width:${S.lvlPct.toFixed(1)}%"></i></div><p class="hint">${S.toNext} min avant le niveau ${S.level + 1}</p></div>` +
    tiles.map(([l, v, u, ic], i) => `<div class="tile reveal" style="--d:${i * 40}ms"><span class="ic">${ic}</span><div class="v">${u === null ? esc(v) : `<b data-count="${v}">0</b>${u}`}</div><div class="l">${l}</div></div>`).join("");
  const d0 = today(), days = [...Array(14)].map((_, i) => addDays(d0, i - 13));
  $("#chart").innerHTML = days.map((d) => { const m = S.sec(d) / 60, h = Math.min(100, (m / 60) * 100); return `<div class="col${S.done(d) ? " ok" : ""}${skipReason(d, hw) ? " skip" : ""}" title="${d} : ${Math.round(m)} min"><i style="--h:${h}%"></i><span>${d.slice(8)}</span></div>`; }).join("");
  const start = addDays(d0, -111); let cells = "";
  for (let i = 0; i < 112; i++) { const d = addDays(start, i), r = S.sec(d) / GOAL, lv = r >= 1 ? 4 : r >= .66 ? 3 : r >= .33 ? 2 : r > 0 ? 1 : 0; cells += `<i class="h${lv}${skipReason(d, hw) ? " sk" : ""}" title="${d}"></i>`; }
  $("#heat").innerHTML = cells; $("#heatLegend").innerHTML = 'Moins <i class="h0"></i><i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> Plus · <i class="h0 sk"></i> jour sauté';
  const A = computeAchievements(hw), got = A.filter((x) => x.at).sort((a, b) => b.at.localeCompare(a.at));
  $("#badges").innerHTML = `<h3>Succès — ${got.length}/${A.length}</h3><div class="ach-bar"><i style="width:${(got.length / A.length) * 100}%"></i></div>
    <div class="badges">${got.slice(0, 6).map((x) => `<span class="badge on">${x.ic} ${esc(x.name)}</span>`).join("") || '<span class="hint">Aucun succès pour l\'instant : lance ta première session !</span>'}</div>
    <button class="big" id="openAch" style="margin-top:12px">Voir tous les succès</button>`;
  $("#openAch").onclick = () => show("ach");
  observeReveal();
}
function countUp(el) {
  const to = Number(el.dataset.count); if (!isFinite(to)) return; const t0 = performance.now(), dur = 1200;
  const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e).toLocaleString("fr-FR"); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); e.target.querySelectorAll("[data-count]").forEach(countUp); io.unobserve(e.target); } }), { threshold: .15 }) : null;
function observeReveal() { document.querySelectorAll(".reveal:not(.in)").forEach((el) => (io ? io.observe(el) : el.classList.add("in"))); }

// ---------- Animations de la page d'accueil ----------
(function heroFx() {
  const c = $("#stars"), x = c.getContext("2d", { alpha: true }), hero = $(".hero"), orb = $(".orb"), txt = $(".hero-txt");
  const mobile = matchMedia("(max-width: 700px)").matches, reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HQ = document.documentElement.classList.contains("hq");
  const dpr = Math.min(devicePixelRatio || 1, HQ ? 2 : mobile ? 1.5 : 2), N = HQ ? (mobile ? 60 : 110) : mobile ? 28 : 55;
  let W, H, P = [], visible = true, running = false, last = 0;
  const size = () => { W = c.width = Math.round(c.offsetWidth * dpr); H = c.height = Math.round(c.offsetHeight * dpr); P = [...Array(N)].map(() => ({ x: Math.random() * W, y: Math.random() * H, v: (.25 + Math.random() * .8) * dpr, r: (.6 + Math.random()) * dpr, c: Math.random() < .15 ? "#29e0ff" : "#ff2a3d", a: .35 + Math.random() * .5 })); };
  let rs; addEventListener("resize", () => { clearTimeout(rs); rs = setTimeout(size, 200); }); size();
  const active = () => visible && !$("#today").hidden && document.visibilityState === "visible";
  function frame(t) {
    if (!active()) { running = false; return; }
    if (t - last >= (mobile && !HQ ? 33 : 16)) { // ~30 fps sur mobile
      const k = last ? Math.min(3, (t - last) / 16) : 1; last = t;
      x.clearRect(0, 0, W, H);
      for (const p of P) { p.y -= p.v * k; if (p.y < 0) { p.y = H; p.x = Math.random() * W; } x.globalAlpha = p.a; x.fillStyle = p.c; x.fillRect(p.x, p.y, p.r, p.r * 3); }
      if (HQ) { // constellation : liens entre particules proches
        const L = 110 * dpr, L2 = L * L; x.lineWidth = .6 * dpr;
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = dx * dx + dy * dy; if (d < L2) { x.globalAlpha = (1 - d / L2) * .35; x.strokeStyle = P[i].c; x.beginPath(); x.moveTo(P[i].x, P[i].y); x.lineTo(P[j].x, P[j].y); x.stroke(); } }
      }
    }
    requestAnimationFrame(frame);
  }
  const kick = () => { hero.classList.toggle("paused", !active()); if (!reduce && active() && !running) { running = true; last = 0; requestAnimationFrame(frame); } };
  window.heroKick = kick;
  if ("IntersectionObserver" in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }).observe(hero);
  document.addEventListener("visibilitychange", kick); kick();
  setInterval(() => { if (active()) $("#clock").textContent = new Date().toLocaleTimeString("fr-FR"); }, 1000);
  let n = 0; const t = setInterval(() => { n = Math.min(100, n + 3 + Math.round(Math.random() * 6)); $("#pct").textContent = n; if (n >= 100) clearInterval(t); }, 60);
  let ticking = false;
  if (!reduce) addEventListener("scroll", () => {
    if (ticking || !visible) return; ticking = true;
    requestAnimationFrame(() => { ticking = false; const y = Math.min(scrollY, 900); orb.style.transform = `translate3d(0,${y * .25}px,0)`; txt.style.transform = `translate3d(0,${y * .12}px,0)`; txt.style.opacity = Math.max(0, 1 - y / 500); });
  }, { passive: true });
})();

// ---------- Succès ----------
const ACH = [
  // [id, groupe, icône, nom, description, métrique, seuil]
  ["l1", "Leçons", "▣", "Premier pas", "Écrire ta première leçon", "lessons", 1],
  ["l10", "Leçons", "▣", "Carnet entamé", "10 leçons écrites", "lessons", 10],
  ["l25", "Leçons", "▣", "Bibliothèque", "25 leçons écrites", "lessons", 25],
  ["l50", "Leçons", "▣", "Archiviste", "50 leçons écrites", "lessons", 50],
  ["l100", "Leçons", "▣", "Encyclopédie", "100 leçons écrites", "lessons", 100],
  ["l250", "Leçons", "▣", "Mémoire vive", "250 leçons écrites", "lessons", 250],
  ["h1", "Temps", "◷", "Première heure", "1 h d'apprentissage cumulée", "mins", 60],
  ["h10", "Temps", "◷", "Échauffement", "10 h cumulées", "mins", 600],
  ["h25", "Temps", "◷", "Régime de croisière", "25 h cumulées", "mins", 1500],
  ["h50", "Temps", "◷", "Machine", "50 h cumulées", "mins", 3000],
  ["h100", "Temps", "◷", "Centurion", "100 h cumulées", "mins", 6000],
  ["h250", "Temps", "◷", "Maître du temps", "250 h cumulées", "mins", 15000],
  ["m2", "Temps", "⚡", "Marathon", "2 h dans une même journée", "maxDay", 120],
  ["m3", "Temps", "⚡", "Ultra-marathon", "3 h dans une même journée", "maxDay", 180],
  ["s3", "Séries", "▲", "Lancé", "Série de 3 jours", "best", 3],
  ["s7", "Séries", "▲", "Semaine parfaite", "Série de 7 jours", "best", 7],
  ["s14", "Séries", "▲", "Quinzaine de fer", "Série de 14 jours", "best", 14],
  ["s30", "Séries", "▲", "Mois sans faille", "Série de 30 jours", "best", 30],
  ["s60", "Séries", "▲", "Inarrêtable", "Série de 60 jours", "best", 60],
  ["s100", "Séries", "▲", "Légende", "Série de 100 jours", "best", 100],
  ["d10", "Régularité", "◎", "Habitude", "10 jours réussis", "days", 10],
  ["d50", "Régularité", "◎", "Discipline", "50 jours réussis", "days", 50],
  ["d100", "Régularité", "◎", "Rituel", "100 jours réussis", "days", 100],
  ["d365", "Régularité", "◎", "Une année d'apprentissage", "365 jours réussis", "days", 365],
  ["w1k", "Écriture", "✎", "Plume", "1 000 mots écrits", "words", 1000],
  ["w10k", "Écriture", "✎", "Auteur", "10 000 mots écrits", "words", 10000],
  ["w50k", "Écriture", "✎", "Romancier", "50 000 mots écrits", "words", 50000],
  ["li100", "Écriture", "≡", "Cent lignes", "100 lignes écrites", "lines", 100],
  ["li1k", "Écriture", "≡", "Mille lignes", "1 000 lignes écrites", "lines", 1000],
  ["li5k", "Écriture", "≡", "Rouleau infini", "5 000 lignes écrites", "lines", 5000],
  ["fmt", "Écriture", "✦", "Typographe", "Utiliser la mise en forme dans une note", "rich", 1],
  ["t1", "Sujets", "◇", "Sujet maîtrisé", "Cocher ton premier sujet", "tDone", 1],
  ["t5", "Sujets", "◇", "Spécialiste", "5 sujets maîtrisés", "tDone", 5],
  ["t10", "Sujets", "◇", "Expert", "10 sujets maîtrisés", "tDone", 10],
  ["t25", "Sujets", "◇", "Érudit", "25 sujets maîtrisés", "tDone", 25],
  ["sb3", "Sujets", "⌘", "Curieux", "Étudier 3 matières différentes", "subjects", 3],
  ["sb10", "Sujets", "⌘", "Touche-à-tout", "Étudier 10 matières différentes", "subjects", 10],
  ["c3", "Sujets", "⬡", "Multi-cursus", "Utiliser 3 catégories (BUT, prépa, bourse…)", "cats", 3],
  ["n3", "Sujets", "⬡", "Triple session", "3 leçons le même jour", "maxNotesDay", 3]
];
function computeAchievements(hw) {
  const notes = liveNotes().filter((n) => (n.content || "").trim() || (n.title || "").trim()), d0 = today();
  const byDate = {}; for (const n of notes) (byDate[n.date] ??= []).push(n);
  const topicsDone = liveTopics().filter((t) => t.doneAt).map((t) => new Date(t.doneAt).toISOString().slice(0, 10)).sort();
  const days = [...new Set([...Object.keys(load(K.prog, {})), ...Object.keys(load(K.remote, {})), ...Object.keys(byDate), ...topicsDone])].filter((d) => d && d <= d0).sort();
  const m = { lessons: 0, mins: 0, maxDay: 0, best: 0, days: 0, words: 0, lines: 0, rich: 0, tDone: 0, subjects: 0, cats: 0, maxNotesDay: 0 };
  const subj = new Set(), cats = new Set(), at = {}; let run = 0;
  const check = (d) => { for (const [id, , , , , k, v] of ACH) if (!at[id] && m[k] >= v) at[id] = d; };
  if (days.length) for (let d = days[0]; d <= d0; d = addDays(d, 1)) {
    const sec = progress(d), ns = byDate[d] || [];
    m.mins += sec / 60; m.maxDay = Math.max(m.maxDay, sec / 60);
    if (sec >= GOAL) { m.days++; run++; m.best = Math.max(m.best, run); } else if (!skipReason(d, hw) && d !== d0) run = 0;
    m.lessons += ns.length; m.maxNotesDay = Math.max(m.maxNotesDay, ns.length);
    for (const n of ns) {
      m.words += ((n.content || "").match(/\S+/g) || []).length; m.lines += (n.content || "").split("\n").filter((l) => l.trim()).length;
      if (/<(b|strong|i|em|u|s|h2|h3|ul|ol|blockquote|pre|mark)\b|class="(fc|hl)-/.test(n.html || "")) m.rich = 1;
      if (n.subject) subj.add(norm(n.subject)); if (n.tag) cats.add(n.tag);
    }
    m.subjects = subj.size; m.cats = cats.size; m.tDone = topicsDone.filter((x) => x <= d).length;
    check(d);
  }
  return ACH.map(([id, group, ic, name, desc, k, v]) => ({ id, group, ic, name, desc, at: at[id] || null, cur: Math.min(v, Math.floor(m[k])), goal: v }));
}
function renderAch() {
  const A = computeAchievements(load(K.hw, { items: [] }).items), f = $("#achFilter").value, got = A.filter((x) => x.at).length;
  $("#achHead").innerHTML = `<div class="tile lvl in"><div class="lvl-n">${got}<span class="hint" style="font-size:1rem"> / ${A.length} succès</span></div><div class="lvl-bar"><i style="width:${(got / A.length) * 100}%"></i></div><p class="hint">${Math.round((got / A.length) * 100)} % de complétion${got ? ` · dernier : ${esc(A.filter((x) => x.at).sort((a, b) => b.at.localeCompare(a.at))[0].name)}` : ""}</p></div>`;
  const list = A.filter((x) => f === "all" || (f === "got" ? x.at : !x.at));
  const groups = [...new Set(list.map((x) => x.group))];
  const fmtD = (d) => new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  $("#achList").innerHTML = groups.map((g) => `<h2 class="sec"><span>//</span> ${esc(g)}</h2><div class="ach-grid">${list.filter((x) => x.group === g).map((x) => `
    <div class="card ach${x.at ? " got" : ""}"><div class="ach-ic">${x.ic}</div><div class="ach-b"><b>${esc(x.name)}</b><div class="hint">${esc(x.desc)}</div>
    ${x.at ? `<div class="ach-date">◆ Débloqué le ${fmtD(x.at)}</div>` : `<div class="ach-bar"><i style="width:${(x.cur / x.goal) * 100}%"></i></div><div class="hint">${x.cur.toLocaleString("fr-FR")} / ${x.goal.toLocaleString("fr-FR")}</div>`}</div></div>`).join("")}</div>`).join("") || '<p class="hint">Rien ici pour l\'instant.</p>';
}
$("#achFilter").onchange = renderAch; $("#achBack").onclick = () => show("today");

// ---------- Sujets à étudier ----------
function saveTopics(list) { save(K.topics, list); queueSync(); renderTopics(); }
function topicStats(t) { const ns = notesOf(t); return { sessions: ns.length, days: new Set(ns.map((n) => n.date)).size, secs: ns.reduce((a, n) => a + (n.secs || 0), 0), lines: ns.reduce((a, n) => a + (n.content || "").split("\n").filter((l) => l.trim()).length, 0), last: ns.map((n) => n.date).sort().pop() }; }
function renderTopics() {
  const f = $("#tFilter").value, tg = $("#tTagFilter").options.length ? $("#tTagFilter").value : "*", all = liveTopics();
  fillTagSelect($("#tTagFilter"), tg, { any: true, add: false });
  const list = all.filter((t) => tg === "*" || (t.tag || "") === tg).filter((t) => f === "all" || (f === "done" ? t.doneAt : !t.doneAt))
    .sort((a, b) => (!!a.doneAt - !!b.doneAt) || (b.doneAt || b.createdAt) - (a.doneAt || a.createdAt));
  const done = all.filter((t) => t.doneAt), studied = all.filter((t) => topicStats(t).sessions > 0);
  const avg = done.length ? done.reduce((a, t) => a + topicStats(t).secs, 0) / done.length : 0;
  $("#tSummary").innerHTML = [["Sujets", all.length], ["Étudiés", studied.length], ["Maîtrisés", done.length], ["Temps moyen / sujet maîtrisé", done.length ? hm(avg) : "—"]].map(([l, v]) => `<div class="tile in"><div class="v">${esc(v)}</div><div class="l">${l}</div></div>`).join("");
  $("#tList").innerHTML = list.length ? list.map((t) => { const S = topicStats(t); return `<div class="card topic${t.doneAt ? " done" : ""}" data-id="${t.id}">
    <label class="chk"><input type="checkbox" class="tDone"${t.doneAt ? " checked" : ""}><span></span></label>
    <div class="tbody">${t.tag ? `<span class="chip">${esc(t.tag)}</span> ` : ""}<b>${esc(t.name)}</b>
      <div class="hint">${S.sessions} session${S.sessions > 1 ? "s" : ""} · ${hm(S.secs)} · ${S.lines} lignes${S.last ? " · dernière : " + S.last : ""}${t.doneAt ? " · maîtrisé le " + new Date(t.doneAt).toLocaleDateString("fr-FR") : ""}</div>
      <div class="tact"><button class="tGo">Étudier</button> <button class="tNotes"${S.sessions ? "" : " disabled"}>Réviser les notes (${S.sessions})</button> <button class="tEdit" title="Renommer">✎</button> <button class="tDel danger" title="Supprimer">✕</button></div></div></div>`; }).join("") : '<p class="hint">Aucun sujet. Ajoute ce que tu veux apprendre ci-dessus.</p>';
  document.querySelectorAll(".topic").forEach((el) => {
    const id = el.dataset.id, t = all.find((x) => x.id === id);
    el.querySelector(".tDone").onchange = (e) => saveTopics(load(K.topics, []).map((x) => (x.id === id ? { ...x, doneAt: e.target.checked ? Date.now() : null, updatedAt: Date.now() } : x)));
    el.querySelector(".tGo").onclick = () => startSession(t.name);
    el.querySelector(".tNotes").onclick = () => { show("notes"); $("#q").value = ""; $("#qDate").value = ""; $("#sort").value = "date-asc"; $("#qSubject").innerHTML = `<option>${esc(t.name)}</option>`; $("#qSubject").value = t.name; fillTagSelect($("#qTag"), "*", { any: true, add: false }); renderList(); };
    el.querySelector(".tEdit").onclick = async () => {
      const name = ((await uiPrompt("Nouveau nom du sujet (ses leçons suivent automatiquement)", { title: "Renommer le sujet", value: t.name, ok: "Renommer" })) || "").trim();
      if (!name || name === t.name) return;
      if (liveTopics().some((x) => x.id !== id && norm(x.name) === norm(name))) return uiAlert("Un sujet porte déjà ce nom.");
      const now = Date.now();
      save(K.notes, load(K.notes, []).map((n) => (!n.deleted && norm(n.subject) === norm(t.name) ? { ...n, subject: name, updatedAt: now } : n)));
      saveTopics(load(K.topics, []).map((x) => (x.id === id ? { ...x, name, updatedAt: now } : x)));
    };
    el.querySelector(".tDel").onclick = async () => (await uiConfirm(`Supprimer le sujet « ${t.name} » ? (les notes sont conservées)`, { ok: "Supprimer", danger: true })) && saveTopics(load(K.topics, []).map((x) => (x.id === id ? { id, deleted: true, updatedAt: Date.now() } : x)));
  });
}
$("#tAdd").onsubmit = (e) => {
  e.preventDefault(); const name = $("#tName").value.trim(); if (!name) return;
  if (liveTopics().some((t) => norm(t.name) === norm(name))) return uiAlert("Ce sujet existe déjà.");
  saveTopics([...load(K.topics, []), { id: crypto.randomUUID(), name, tag: $("#tTag").value === "+" ? "" : $("#tTag").value, createdAt: Date.now(), doneAt: null, updatedAt: Date.now() }]); $("#tName").value = ""; $("#tName").focus();
};
$("#tFilter").onchange = renderTopics; $("#tTagFilter").onchange = renderTopics;
fillTagSelect($("#tTag"), ""); onTagChange($("#tTag")); onTagChange($("#nTag"), () => scheduleSave());

// ---------- Leçons ----------
function renderList() {
  const q = $("#q").value.toLowerCase().trim(), d = $("#qDate").value, s = $("#sort").value;
  const sj = $("#qSubject").value, tg = $("#qTag").options.length ? $("#qTag").value : "*";
  fillTagSelect($("#qTag"), tg, { any: true, add: false });
  const subs = [...new Set(liveNotes().map((n) => (n.subject || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  $("#qSubject").innerHTML = '<option value="">Tous les sujets</option>' + subs.map((x) => `<option${norm(x) === norm(sj) ? " selected" : ""}>${esc(x)}</option>`).join("");
  let notes = liveNotes().filter((n) => (tg === "*" || (n.tag || "") === tg) && (!sj || norm(n.subject) === norm(sj)) && (!d || n.date === d) && (!q || `${n.title} ${n.subject} ${n.content}`.toLowerCase().includes(q)));
  const cmp = { "date-desc": (a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt, "date-asc": (a, b) => a.date.localeCompare(b.date), title: (a, b) => (a.title || "").localeCompare(b.title || "", "fr"), subject: (a, b) => (a.subject || "").localeCompare(b.subject || "", "fr") || b.date.localeCompare(a.date), len: (a, b) => b.content.length - a.content.length };
  notes.sort(cmp[s]);
  $("#list").innerHTML = notes.length ? notes.map((n) => `<div class="card item" data-id="${n.id}"><b>${esc(n.title || "(sans titre)")}</b><div class="hint">${n.tag ? `<span class="chip">${esc(n.tag)}</span> ` : ""}${esc(n.date)} · ${esc(n.subject || "—")}${n.secs ? " · " + hm(n.secs) : ""}</div><div class="excerpt">${esc(n.content.slice(0, 120))}</div></div>`).join("") : '<p class="hint">Aucune leçon.</p>';
  document.querySelectorAll(".item").forEach((el) => (el.onclick = () => openModal(el.dataset.id)));
}
let listTimer; const renderListSoon = () => { clearTimeout(listTimer); listTimer = setTimeout(renderList, 120); };
["#q", "#qDate", "#sort", "#qSubject", "#qTag"].forEach((s) => $(s).addEventListener("input", renderListSoon));
function openModal(id) {
  const n = load(K.notes, []).find((x) => x.id === id);
  $("#mTitle").textContent = n.title || "(sans titre)"; $("#mMeta").textContent = `${n.date} · ${n.subject || "—"}`; $("#mBody").innerHTML = n.html ? sanitize(n.html) : textToHtml(n.content);
  $("#mEdit").onclick = () => openEditor(id);
  // cocher/décocher directement en lecture
  $("#mBody").onpointerdown = (e) => {
    if (!toggleCheck(e, $("#mBody"))) return; e.preventDefault();
    const notes = load(K.notes, []), m = notes.find((x) => x.id === id); if (!m) return;
    m.html = sanitize($("#mBody").innerHTML); m.updatedAt = Date.now(); save(K.notes, notes); queueSync();
  };
  $("#mDel").onclick = async () => { if (await uiConfirm("Supprimer cette leçon ?", { ok: "Supprimer", danger: true })) { save(K.notes, load(K.notes, []).map((x) => x.id === id ? { id, date: x.date, deleted: true, updatedAt: Date.now() } : x)); queueSync(); $("#modal").hidden = true; renderList(); } };
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
$("#login").onclick = async () => { try { await auth({ email: C.email, password: $("#pwd").value }, "password"); $("#pwd").value = ""; await syncHomework(); await syncAll(true); } catch (e) { uiAlert(e.message, "Erreur"); } renderSettings(); };
$("#sync").onclick = async () => { try { await syncHomework(); await syncAll(true); } catch (e) { uiAlert(e.message, "Erreur"); } renderSettings(); };
$("#saveTopic").onclick = () => { save(K.topic, $("#topic").value.trim()); uiAlert("Sujet ntfy enregistré."); };
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
    const topics = load(K.topics, []), tById = new Map(topics.map((t) => [t.id, t])), tPush = [];
    for (const r of rows) {
      if (r.kind === "note") {
        const l = byId.get(r.id);
        if (!l || l.updatedAt < r.updated_at) { const n = r.deleted ? { id: r.id, date: r.data.date, deleted: true, updatedAt: r.updated_at } : { ...r.data, id: r.id, updatedAt: r.updated_at }; byId.set(r.id, n); }
        else if (l.updatedAt > r.updated_at) push.push(l);
      } else if (r.kind === "topic") {
        const l = tById.get(r.id);
        if (!l || l.updatedAt < r.updated_at) tById.set(r.id, r.deleted ? { id: r.id, deleted: true, updatedAt: r.updated_at } : { ...r.data, id: r.id, updatedAt: r.updated_at });
        else if (l.updatedAt > r.updated_at) tPush.push(l);
      } else if (r.kind === "progress") { (remote[r.data.date] ??= {})[r.data.dev] = r.data.sec; }
    }
    const known = new Set(rows.map((r) => r.id));
    for (const n of notes) if (!known.has(n.id)) push.push(n);
    for (const t of topics) if (!known.has(t.id)) tPush.push(t);
    save(K.topics, [...tById.values()]);
    save(K.notes, [...byId.values()]); save(K.remote, remote);
    const body = push.map((n) => ({ id: n.id, kind: "note", deleted: !!n.deleted, updated_at: n.updatedAt, data: n.deleted ? { date: n.date } : { date: n.date, title: n.title, subject: n.subject, content: n.content, html: n.html || "", tag: n.tag || "", secs: Math.round(n.secs || 0), createdAt: n.createdAt } }));
    for (const t of tPush) body.push({ id: t.id, kind: "topic", deleted: !!t.deleted, updated_at: t.updatedAt, data: t.deleted ? {} : { name: t.name, tag: t.tag || "", createdAt: t.createdAt, doneAt: t.doneAt || null } });
    for (const [date, sec] of Object.entries(load(K.prog, {}))) if (!remote[date] || Math.abs((remote[date][DEV] || 0) - sec) > 1) body.push({ id: `p-${date}-${DEV}`, kind: "progress", deleted: false, updated_at: Date.now(), data: { date, dev: DEV, sec: Math.round(sec) } });
    if (body.length) {
      const r = await fetch(`${C.supabaseUrl}/rest/v1/lr_items?on_conflict=user_id,id`, { method: "POST", headers: { ...H(t), Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("envoi refusé");
    }
    save(K.cur, start); setSync(`Synchronisé ${new Date().toLocaleTimeString("fr-FR")}`);
    rerenderWhenIdle();
  } catch (e) { setSync("Erreur de synchro : " + e.message); } finally { syncing = false; }
}
const typing = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
let pendingRender = false;
function rerenderWhenIdle() {
  if (typing()) { if (!pendingRender) { pendingRender = true; document.addEventListener("focusout", () => { pendingRender = false; setTimeout(rerenderWhenIdle, 50); }, { once: true }); } return; }
  if (!$("#notes").hidden) renderList(); if (!$("#topics").hidden) renderTopics(); if (!$("#today").hidden) renderToday();
}
function setSync(m) { const el = $("#syncState"); if (el) el.textContent = m; }

// ---------- Export / import (conservation des données) ----------
$("#export").onclick = () => {
  const blob = new Blob([JSON.stringify({ app: "learning-routine", v: 1, notes: liveNotes(), topics: liveTopics(), progress: load(K.prog, {}) }, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `routine-${today()}.json`; a.click();
};
$("#import").onchange = async (e) => {
  const d = JSON.parse(await e.target.files[0].text()), notes = load(K.notes, []), ids = new Set(notes.map((n) => n.id));
  for (const n of d.notes || []) if (!ids.has(n.id)) notes.push(n);
  const p = load(K.prog, {}); for (const [k, v] of Object.entries(d.progress || {})) p[k] = Math.max(p[k] || 0, v);
  const tp = load(K.topics, []), tids = new Set(tp.map((t) => t.id)); for (const t of d.topics || []) if (!tids.has(t.id)) tp.push(t);
  save(K.topics, tp); save(K.notes, notes); save(K.prog, p); syncAll(true); uiAlert("Import terminé (fusion, rien n'est écrasé)."); show("today");
};

window.lrStatus = () => { const left = GOAL - progress(); return { done: left <= 0, skipped: !!skipReason(today(), load(K.hw, { items: [] }).items), left: Math.ceil(Math.max(0, left) / 60) }; };
navigator.storage?.persist?.().then((ok) => ($("#persist").textContent = ok ? "Stockage persistant activé." : "Pense à exporter régulièrement tes notes."));
// ---------- Mises à jour automatiques ----------
function updateBar(msg, label, fn) { $("#updMsg").textContent = msg; $("#updBtn").textContent = label; $("#updBtn").onclick = fn; $("#updBar").hidden = false; }
$("#checkUpd").onclick = async () => {
  const st = $("#updState"); st.textContent = "Recherche en cours…";
  try {
    if (window.desktop?.check) { const r = await window.desktop.check(); st.textContent = r.state === "none" ? `Tu as la dernière version (${r.version}).` : r.state === "available" ? `Version ${r.version} trouvée : téléchargement en cours, un bandeau proposera de redémarrer.` : `Erreur : ${r.error || "impossible de vérifier"}`; return; }
    const reg = await navigator.serviceWorker?.getRegistration(); if (!reg) { st.textContent = "Mises à jour indisponibles dans ce mode."; return; }
    await reg.update();
    if (reg.installing || reg.waiting) { st.textContent = "Nouvelle version trouvée : rechargement…"; setTimeout(() => { if (current) saveNote(); location.reload(); }, 800); }
    else st.textContent = `Tu as la dernière version (${$("#ver").textContent}).`;
  } catch (e) { st.textContent = "Erreur : " + e.message; }
};
if (window.desktop) {
  window.desktop.onUpdate((s) => {
    if (s.state === "available") updateBar(`Mise à jour ${s.version} : téléchargement…`, "OK", () => ($("#updBar").hidden = true));
    if (s.state === "ready") updateBar(`Version ${s.version} prête`, "Redémarrer", () => { saveNote(); window.desktop.install(); });
  });
} else if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register("sw.js").then((reg) => setInterval(() => reg.update(), 30 * 60 * 1000));
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!hadController) return; if ($("#note").hidden && !typing()) location.reload(); else updateBar("Nouvelle version disponible", "Recharger", () => { saveNote(); location.reload(); }); });
}
syncHomework().catch(() => {}).finally(renderToday);
syncAll();
setInterval(() => document.visibilityState === "visible" && syncAll(), 30000);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && syncAll());
window.addEventListener("online", syncAll);
enhanceSelects();
show("today");
