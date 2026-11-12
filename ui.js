// Boîtes de dialogue intégrées (remplacent alert/confirm/prompt qui font perdre le focus
// des champs dans l'app PC) + éditeur de texte enrichi des notes.

// ---------- Dialogues ----------
const dlg = document.createElement("div");
dlg.id = "dlg"; dlg.hidden = true;
dlg.innerHTML = '<form class="card dlg-box" method="dialog"><h3 id="dlgT"></h3><p id="dlgM"></p><input id="dlgI" autocomplete="off"><div class="row dlg-act"><button type="button" id="dlgNo">Annuler</button><button type="submit" id="dlgOk" class="addbtn">OK</button></div></form>';
document.body.append(dlg);
const q = (s) => dlg.querySelector(s);
function open({ title = "", msg = "", input = null, ok = "OK", cancel = "Annuler", danger = false }) {
  return new Promise((resolve) => {
    const prev = document.activeElement;
    q("#dlgT").textContent = title; q("#dlgT").hidden = !title; q("#dlgM").textContent = msg;
    const inp = q("#dlgI"); inp.hidden = input === null; inp.value = input?.value || ""; inp.placeholder = input?.placeholder || "";
    q("#dlgOk").textContent = ok; q("#dlgOk").classList.toggle("danger", danger); q("#dlgNo").hidden = cancel === null; q("#dlgNo").textContent = cancel || "";
    dlg.hidden = false;
    const done = (v) => {
      dlg.hidden = true; q("form").onsubmit = q("#dlgNo").onclick = dlg.onkeydown = null;
      resolve(v);
      // rend le focus au champ précédent (sinon il reste parfois inaccessible)
      if (prev && prev.isConnected && prev !== document.body) setTimeout(() => prev.focus({ preventScroll: true }), 0);
    };
    q("form").onsubmit = (e) => { e.preventDefault(); done(input !== null ? inp.value : true); };
    q("#dlgNo").onclick = () => done(input !== null ? null : false);
    dlg.onkeydown = (e) => { if (e.key === "Escape") done(input !== null ? null : false); };
    setTimeout(() => (input !== null ? inp : q("#dlgOk")).focus(), 30);
  });
}
export const uiAlert = (msg, title = "") => open({ msg, title, cancel: null });
export const uiConfirm = (msg, opts = {}) => open({ msg, title: opts.title || "Confirmation", ok: opts.ok || "Confirmer", danger: !!opts.danger });
export const uiPrompt = (msg, opts = {}) => open({ msg, title: opts.title || "", input: { value: opts.value, placeholder: opts.placeholder }, ok: opts.ok || "Valider" });

// ---------- Texte enrichi ----------
const COLORS = { r: "#ff2a3d", c: "#29e0ff", w: "#ffffff", y: "#ffd23f", g: "#3dff9a" };
const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "MARK", "BR", "DIV", "P", "SPAN", "FONT", "HR"]);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const textToHtml = (t) => esc(t).replace(/\n/g, "<br>");

const norm = (col) => { const d = document.createElement("div"); d.style.color = col; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; };
let palette = null;
const colorClass = (col) => {
  if (!col) return null; palette ??= Object.fromEntries(Object.entries(COLORS).map(([k, v]) => [norm(v), k]));
  return palette[norm(col)] || null;
};
/** Ne garde que les balises et couleurs autorisées (les données synchronisées ne peuvent pas injecter de script). */
export function sanitize(html) {
  const tpl = document.createElement("template"); tpl.innerHTML = html;
  const walk = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) continue;
      if (ch.nodeType !== 1 || !ALLOWED.has(ch.tagName)) { if (ch.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED)$/.test(ch.tagName)) { walk(ch); ch.replaceWith(...ch.childNodes); } else ch.remove(); continue; }
      walk(ch);
      const fg = ch.tagName === "FONT" ? ch.getAttribute("color") : ch.style?.color;
      const bg = ch.style?.backgroundColor;
      let cls = [...ch.classList].filter((c) => /^(fc|hl)-[rcwyg]$/.test(c));
      const f = colorClass(fg), b = colorClass(bg);
      if (f) cls.push("fc-" + f); if (b) cls.push("hl-" + b);
      for (const a of [...ch.attributes]) ch.removeAttribute(a.name);
      if (ch.tagName === "FONT" || (ch.tagName === "SPAN" && !cls.length)) {
        if (cls.length) { const s = document.createElement("span"); s.className = [...new Set(cls)].join(" "); s.append(...ch.childNodes); ch.replaceWith(s); }
        else ch.replaceWith(...ch.childNodes);
      } else if (cls.length) ch.className = [...new Set(cls)].join(" ");
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

export function initEditor(ed, bar, onChange) {
  const exec = (cmd, val = null) => { ed.focus({ preventScroll: true }); document.execCommand(cmd, false, val); onChange(); refresh(); };
  const block = (tag) => { const cur = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, ""); exec("formatBlock", cur === tag ? "div" : tag); };
  const color = (k, hl) => {
    document.execCommand("styleWithCSS", false, true);
    exec(hl ? "hiliteColor" : "foreColor", k ? COLORS[k] : hl ? "transparent" : "#f1f1f4");
    document.execCommand("styleWithCSS", false, false);
  };
  const ACTIONS = {
    b: () => exec("bold"), i: () => exec("italic"), u: () => exec("underline"), s: () => exec("strikeThrough"),
    h2: () => block("h2"), h3: () => block("h3"), quote: () => block("blockquote"), code: () => block("pre"),
    ul: () => exec("insertUnorderedList"), ol: () => exec("insertOrderedList"), hr: () => exec("insertHorizontalRule"),
    clear: () => { exec("removeFormat"); const cur = (document.queryCommandValue("formatBlock") || "").toLowerCase(); if (/h2|h3|blockquote|pre/.test(cur)) exec("formatBlock", "div"); },
    undo: () => exec("undo"), redo: () => exec("redo")
  };
  bar.addEventListener("pointerdown", (e) => { if (e.target.closest("button")) e.preventDefault(); }); // garde la sélection
  bar.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.a) ACTIONS[b.dataset.a]();
    else if (b.dataset.fc !== undefined) color(b.dataset.fc, false);
    else if (b.dataset.hl !== undefined) color(b.dataset.hl, true);
    else if (b.dataset.pop) { const p = bar.querySelector(`.pop[data-p="${b.dataset.pop}"]`); const open = p.hidden; bar.querySelectorAll(".pop").forEach((x) => (x.hidden = true)); p.hidden = !open; if (open) { const r = b.getBoundingClientRect(); p.style.top = r.bottom + 6 + "px"; p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 8)) + "px"; } return; }
    bar.querySelectorAll(".pop").forEach((x) => (x.hidden = true));
  });
  // raccourcis clavier PC
  ed.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase(), map = { b: "b", i: "i", u: "u" };
    if (map[k]) { e.preventDefault(); ACTIONS[map[k]](); }
    else if (e.shiftKey && k === "x") { e.preventDefault(); ACTIONS.s(); }
    else if (e.altKey && (k === "2" || k === "3")) { e.preventDefault(); ACTIONS["h" + k](); }
  });
  // collage en texte brut (évite les styles parasites)
  ed.addEventListener("paste", (e) => { e.preventDefault(); const t = e.clipboardData.getData("text/plain"); document.execCommand("insertText", false, t); });
  ed.addEventListener("input", onChange);
  // état actif des boutons
  const refresh = () => {
    if (!ed.contains(document.getSelection()?.anchorNode)) return;
    const st = { b: "bold", i: "italic", u: "underline", s: "strikeThrough", ul: "insertUnorderedList", ol: "insertOrderedList" };
    const blk = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
    bar.querySelectorAll("button[data-a]").forEach((b) => { const a = b.dataset.a; b.classList.toggle("on", st[a] ? document.queryCommandState(st[a]) : a === blk || (a === "quote" && blk === "blockquote") || (a === "code" && blk === "pre")); });
  };
  document.addEventListener("selectionchange", refresh);
  document.execCommand("defaultParagraphSeparator", false, "div");
  return {
    set(html) { ed.innerHTML = html; },
    html: () => sanitize(ed.innerHTML),
    text: () => ed.innerText.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim()
  };
}

// ---------- Listes déroulantes stylisées (PC) ----------
// Les menus natifs <select> s'ouvrent dans une fenêtre système : le curseur stylisé ne peut pas
// les suivre et restait figé. On les remplace par un menu dessiné dans la page (le <select>
// d'origine reste la source de vérité : value, change, input fonctionnent comme avant).
export function enhanceSelects(root = document) {
  if (!matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  let openList = null;
  const close = () => { if (!openList) return; openList.list.hidden = true; openList.btn.setAttribute("aria-expanded", "false"); openList.wrap.classList.remove("open"); openList = null; };
  document.addEventListener("pointerdown", (e) => { if (openList && !openList.wrap.contains(e.target) && !openList.list.contains(e.target)) close(); }, true);
  addEventListener("resize", close); addEventListener("blur", close);
  document.addEventListener("scroll", (e) => { if (openList && !openList.list.contains(e.target)) close(); }, true);
  root.querySelectorAll("select:not([data-csel])").forEach((sel) => {
    sel.dataset.csel = 1;
    const wrap = document.createElement("div"); wrap.className = "csel"; if (sel.id) wrap.dataset.for = sel.id;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = "csel-btn"; btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
    if (sel.getAttribute("aria-label")) btn.setAttribute("aria-label", sel.getAttribute("aria-label"));
    const list = document.createElement("div"); list.className = "csel-list"; list.setAttribute("role", "listbox"); list.hidden = true;
    sel.before(wrap); wrap.append(sel, btn); document.body.append(list);
    const label = () => { const o = sel.options[sel.selectedIndex]; btn.innerHTML = `<span>${o ? o.textContent.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) : "—"}</span><i>▾</i>`; };
    Object.defineProperty(sel, "value", { get() { return desc.get.call(this); }, set(v) { desc.set.call(this, v); label(); }, configurable: true });
    new MutationObserver(label).observe(sel, { childList: true, subtree: true, characterData: true });
    sel.addEventListener("change", label);
    let idx = -1;
    const render = () => {
      list.innerHTML = [...sel.options].map((o, i) => `<div role="option" class="csel-opt${i === sel.selectedIndex ? " sel" : ""}${o.value === "+" ? " add" : ""}" data-i="${i}" aria-selected="${i === sel.selectedIndex}">${o.textContent.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</div>`).join("");
      idx = sel.selectedIndex; hl();
    };
    const hl = () => list.querySelectorAll(".csel-opt").forEach((el, i) => { el.classList.toggle("hl", i === idx); if (i === idx) el.scrollIntoView({ block: "nearest" }); });
    const place = () => {
      const r = btn.getBoundingClientRect(), h = Math.min(320, list.scrollHeight), below = innerHeight - r.bottom - 8;
      list.style.minWidth = r.width + "px"; list.style.left = Math.max(8, Math.min(r.left, innerWidth - Math.max(r.width, list.offsetWidth) - 8)) + "px";
      list.style.top = (below >= Math.min(h, 200) ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + "px";
    };
    const open = () => { if (openList) close(); render(); list.hidden = false; place(); btn.setAttribute("aria-expanded", "true"); wrap.classList.add("open"); openList = { wrap, btn, list }; };
    const pick = (i) => { if (i < 0) return; close(); btn.focus({ preventScroll: true }); if (i !== sel.selectedIndex) { sel.selectedIndex = i; label(); sel.dispatchEvent(new Event("input", { bubbles: true })); sel.dispatchEvent(new Event("change", { bubbles: true })); } };
    btn.addEventListener("click", () => (list.hidden ? open() : close()));
    list.addEventListener("pointerdown", (e) => e.preventDefault());
    list.addEventListener("click", (e) => { const o = e.target.closest(".csel-opt"); if (o) pick(+o.dataset.i); });
    list.addEventListener("pointermove", (e) => { const o = e.target.closest(".csel-opt"); if (o && +o.dataset.i !== idx) { idx = +o.dataset.i; list.querySelectorAll(".csel-opt").forEach((el, i) => el.classList.toggle("hl", i === idx)); } });
    btn.addEventListener("keydown", (e) => {
      const n = sel.options.length;
      if (["ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); if (list.hidden) open(); else { idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + n) % n; hl(); } }
      else if (e.key === "Enter" || e.key === " ") { if (!list.hidden) { e.preventDefault(); pick(idx); } }
      else if (e.key === "Escape" || e.key === "Tab") close();
    });
    label();
  });
}
