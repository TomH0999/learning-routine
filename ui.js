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
// Palette : les anciennes clés (r, c, w, y, g) restent identiques pour ne rien changer aux notes existantes.
export const COLORS = {
  r: ["#ff2a3d", "Rouge néon"], o: ["#ff8a1f", "Orange"], y: ["#ffd23f", "Jaune"], l: ["#b6ff3b", "Citron vert"],
  g: ["#3dff9a", "Vert"], t: ["#00e0b0", "Turquoise"], c: ["#29e0ff", "Cyan"], b: ["#3d8bff", "Bleu"],
  v: ["#9b6bff", "Violet"], m: ["#ff3df0", "Magenta"], p: ["#ff7ab6", "Rose"], br: ["#c98b5a", "Cuivre"],
  w: ["#ffffff", "Blanc"], s: ["#a3a3b2", "Gris"], d: ["#5c5866", "Gris foncé"]
};
(() => { // styles des couleurs générés depuis la palette
  const st = document.createElement("style"); st.id = "rt-colors";
  st.textContent = Object.entries(COLORS).map(([k, [hex]]) => { const n = parseInt(hex.slice(1), 16), rgb = `${n >> 16},${(n >> 8) & 255},${n & 255}`;
    const al = { r: .35, c: .3, y: .35, g: .3, w: .25 }[k] ?? .32; // anciennes valeurs conservées
    return `.fc-${k}{color:${hex}!important}.hl-${k}{background:rgba(${rgb},${al})}.sw.k-${k}{background:${hex}}`; }).join("");
  document.head.append(st);
})();
const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "S", "STRIKE", "DEL", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "PRE", "CODE", "MARK", "BR", "DIV", "P", "SPAN", "FONT", "HR"]);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const textToHtml = (t) => esc(t).replace(/\n/g, "<br>");

const norm = (col) => { const d = document.createElement("div"); d.style.color = col; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; };
let palette = null;
const colorClass = (col) => {
  if (!col || col === "transparent") return null; palette ??= Object.fromEntries(Object.entries(COLORS).map(([k, [v]]) => [norm(v), k]));
  return palette[norm(col)] || null;
};
const CLASS_OK = (c) => { const m = /^(fc|hl)-([a-z]{1,2})$/.exec(c); return !!(m && COLORS[m[2]]) || c === "chk-list"; };
/** Ne garde que les balises, couleurs et cases autorisées (les données synchronisées ne peuvent pas injecter de script).
 *  Les styles posés en CSS par le navigateur (gras/italique/souligné/barré, fréquents sur iPhone) sont convertis
 *  en balises, ce qui permet de cumuler les styles sans en perdre à l'enregistrement. */
export function sanitize(html) {
  const tpl = document.createElement("template"); tpl.innerHTML = html;
  const walk = (node) => {
    for (const ch of [...node.childNodes]) {
      if (ch.nodeType === 3) continue;
      if (ch.nodeType !== 1 || !ALLOWED.has(ch.tagName)) { if (ch.nodeType === 1 && !/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE)$/.test(ch.tagName)) { walk(ch); ch.replaceWith(...ch.childNodes); } else ch.remove(); continue; }
      walk(ch);
      const st = ch.style || {}, fw = st.fontWeight, deco = `${st.textDecorationLine || ""} ${st.textDecoration || ""}`;
      const wrap = [];
      if ((fw === "bold" || fw === "bolder" || +fw >= 600) && !/^(B|STRONG|H2|H3)$/.test(ch.tagName)) wrap.push("b");
      if (st.fontStyle === "italic" && !/^(I|EM)$/.test(ch.tagName)) wrap.push("i");
      if (/underline/.test(deco) && ch.tagName !== "U") wrap.push("u");
      if (/line-through/.test(deco) && !/^(S|STRIKE|DEL)$/.test(ch.tagName)) wrap.push("s");
      const cls = [...ch.classList].filter(CLASS_OK).filter((c) => c !== "chk-list" || ch.tagName === "UL");
      const f = colorClass(ch.tagName === "FONT" ? ch.getAttribute("color") : st.color), bgc = colorClass(st.backgroundColor);
      if (f) cls.push("fc-" + f); if (bgc) cls.push("hl-" + bgc);
      const chk = ch.tagName === "LI" ? (ch.getAttribute("data-c") === "1" ? "1" : ch.getAttribute("data-c") === "0" ? "0" : null) : null;
      for (const a of [...ch.attributes]) ch.removeAttribute(a.name);
      if (chk !== null) ch.setAttribute("data-c", chk);
      const uniq = [...new Set(cls)];
      // élément cible qui reçoit les styles cumulés
      let target = ch;
      if (ch.tagName === "FONT" || (ch.tagName === "SPAN" && !uniq.length)) {
        if (uniq.length) { const s = document.createElement("span"); s.className = uniq.join(" "); s.append(...ch.childNodes); ch.replaceWith(s); target = s; }
        else if (wrap.length) { const frag = document.createElement(wrap.shift()); frag.append(...ch.childNodes); ch.replaceWith(frag); target = frag; }
        else { ch.replaceWith(...ch.childNodes); continue; }
      } else if (uniq.length) ch.className = uniq.join(" ");
      if (wrap.length) { let inner = null, outer = null; for (const t of wrap) { const e = document.createElement(t); if (inner) inner.append(e); else outer = e; inner = e; } inner.append(...target.childNodes); target.append(outer); }
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

/** Cases à cocher : bascule une case (éditeur ou lecture). Renvoie true si un clic a touché une case. */
export function toggleCheck(e, root) {
  const li = e.target.closest && e.target.closest("ul.chk-list > li"); if (!li || !root.contains(li)) return false;
  const r = li.getBoundingClientRect(); if (e.clientX - r.left > 30) return false;
  li.setAttribute("data-c", li.getAttribute("data-c") === "1" ? "0" : "1"); return true;
}

export function initEditor(ed, bar, onChange) {
  const exec = (cmd, val = null) => { ed.focus({ preventScroll: true }); document.execCommand(cmd, false, val); onChange(); refresh(); };
  const block = (tag) => { const cur = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, ""); exec("formatBlock", cur === tag ? "div" : tag); };
  const color = (k, hl) => {
    document.execCommand("styleWithCSS", false, true);
    exec(hl ? "hiliteColor" : "foreColor", k ? COLORS[k][0] : hl ? "transparent" : "#f1f1f4");
    document.execCommand("styleWithCSS", false, false);
  };
  const curLi = () => { let n = document.getSelection()?.anchorNode; while (n && n !== ed) { if (n.nodeType === 1 && n.tagName === "LI") return n; n = n.parentNode; } return null; };
  // palettes générées depuis COLORS
  for (const [attr, p] of [["fc", bar.querySelector('.pop[data-p="fc"]')], ["hl", bar.querySelector('.pop[data-p="hl"]')]])
    p.innerHTML = Object.entries(COLORS).map(([k, [, name]]) => `<button type="button" data-${attr}="${k}" class="sw k-${k}" title="${name}" aria-label="${name}"></button>`).join("") + `<button type="button" data-${attr}="" class="sw x" title="${attr === "fc" ? "Couleur par défaut" : "Sans surlignage"}">✕</button>`;
  const ACTIONS = {
    b: () => exec("bold"), i: () => exec("italic"), u: () => exec("underline"), s: () => exec("strikeThrough"),
    h2: () => block("h2"), h3: () => block("h3"), quote: () => block("blockquote"), code: () => block("pre"),
    ul: () => exec("insertUnorderedList"), ol: () => exec("insertOrderedList"), hr: () => exec("insertHorizontalRule"),
    clear: () => { exec("removeFormat"); const cur = (document.queryCommandValue("formatBlock") || "").toLowerCase(); if (/h2|h3|blockquote|pre/.test(cur)) exec("formatBlock", "div"); },
    undo: () => exec("undo"), redo: () => exec("redo"),
    chk: () => {
      const li = curLi(), ul = li && li.parentElement;
      if (ul && ul.tagName === "UL" && ul.classList.contains("chk-list")) { exec("insertUnorderedList"); return; } // retire la liste
      if (!(ul && ul.tagName === "UL")) { ed.focus({ preventScroll: true }); document.execCommand("insertUnorderedList"); }
      const u2 = curLi()?.parentElement; if (u2 && u2.tagName === "UL") { u2.classList.add("chk-list"); u2.querySelectorAll(":scope>li").forEach((x) => x.hasAttribute("data-c") || x.setAttribute("data-c", "0")); }
      onChange(); refresh();
    }
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
  ed.addEventListener("pointerdown", (e) => { if (toggleCheck(e, ed)) { e.preventDefault(); onChange(); } });
  ed.addEventListener("keydown", (e) => { if (e.key === "Enter") setTimeout(() => { const li = curLi(); if (li && li.parentElement?.classList.contains("chk-list") && !li.textContent.trim()) li.setAttribute("data-c", "0"); }); });
  // état actif des boutons
  const refresh = () => {
    if (!ed.contains(document.getSelection()?.anchorNode)) return;
    const st = { b: "bold", i: "italic", u: "underline", s: "strikeThrough", ul: "insertUnorderedList", ol: "insertOrderedList" };
    const blk = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
    const inChk = !!curLi()?.parentElement?.classList.contains("chk-list");
    bar.querySelectorAll("button[data-a]").forEach((b) => { const a = b.dataset.a; b.classList.toggle("on", a === "chk" ? inChk : a === "ul" && inChk ? false : st[a] ? document.queryCommandState(st[a]) : a === blk || (a === "quote" && blk === "blockquote") || (a === "code" && blk === "pre")); });
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
