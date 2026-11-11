// Mode « Qualité visuelle » : choix dans Réglages + décors supplémentaires (aucun effet en mode Performances).
const root = document.documentElement, HQ = root.classList.contains("hq");
const PC = matchMedia("(hover:hover) and (pointer:fine)").matches;
if (!PC) document.getElementById("visualCard").hidden = true;
const seg = document.getElementById("visualMode");
seg.querySelectorAll("button").forEach((b) => {
  b.classList.toggle("on", (b.dataset.m === "hq") === HQ);
  b.onclick = () => {
    if ((b.dataset.m === "hq") === HQ) return;
    try { localStorage.setItem("lr_visual", b.dataset.m); } catch {}
    document.querySelectorAll("#nTitle,#nSubject,#nContent").forEach((el) => el.dispatchEvent(new Event("blur")));
    setTimeout(() => location.reload(), 150);
  };
});

if (HQ) {
  const el = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; };
  // Fond : sol en perspective, vignette, lignes d'écran
  document.body.prepend(el('<div class="hq-bg" aria-hidden="true"><div class="hq-floor"></div><div class="hq-glow g1"></div><div class="hq-glow g2"></div></div>'));
  document.body.append(el('<div class="hq-fx" aria-hidden="true"></div>'));
  // Bandeau HUD défilant sous l'en-tête
  const msgs = ["SYS ONLINE", "NEURAL LINK STABLE", "1H / DAY PROTOCOL", "NO EXCUSES", "SYNC // SUPABASE", "FOCUS MODE READY", "KNOWLEDGE IS POWER"];
  const run = msgs.map((m) => `<span>◆ ${m}</span>`).join("");
  document.querySelector("header").after(el(`<div class="hq-ticker" aria-hidden="true"><div>${run}${run}</div></div>`));

  // Illustration d'accueil : calques supplémentaires
  const orb = document.querySelector(".orb");
  const ticks = [...Array(72)].map((_, i) => { const a = (i * 5 * Math.PI) / 180, r1 = 188, r2 = i % 6 ? 182 : 174; return `<line x1="${200 + r1 * Math.cos(a)}" y1="${200 + r1 * Math.sin(a)}" x2="${200 + r2 * Math.cos(a)}" y2="${200 + r2 * Math.sin(a)}"/>`; }).join("");
  const labels = [0, 60, 120, 180, 240, 300].map((d) => { const a = (d * Math.PI) / 180; return `<text x="${200 + 196 * Math.cos(a)}" y="${203 + 196 * Math.sin(a)}" text-anchor="middle">${String(d).padStart(3, "0")}</text>`; }).join("");
  const hex = []; for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) { const cx = 60 + x * 36 + (y % 2) * 18, cy = 60 + y * 31; if (Math.hypot(cx - 200, cy - 200) < 125) hex.push(`<path d="M${cx} ${cy - 10}l9 5v10l-9 5l-9-5v-10z"/>`); }
  const before = orb.querySelector(".globe");
  before.before(el(`<svg class="lyr hq-hex" viewBox="0 0 400 400"><g fill="none" stroke="#ff2a3d" stroke-opacity=".22" stroke-width=".8">${hex.join("")}</g></svg>`));
  orb.append(el(`<svg class="lyr hq-ticks" viewBox="0 0 400 400"><g stroke="#ff8a95" stroke-opacity=".7" stroke-width="1">${ticks}</g><g font-family="JetBrains Mono,monospace" font-size="7" fill="#ff8a95" fill-opacity=".8">${labels}</g></svg>`));
  orb.append(el('<div class="lyr hq-radar"></div>'));
  orb.append(el('<svg class="lyr hq-orbit2" viewBox="0 0 400 400"><ellipse cx="200" cy="200" rx="160" ry="44" transform="rotate(28 200 200)" fill="none" stroke="#ff2a3d" stroke-width="1.2" stroke-dasharray="3 6" stroke-opacity=".8"/><circle cx="341" cy="275" r="4" fill="#fff"/></svg>'));
  orb.append(el('<div class="lyr hq-pulse"><i></i><i></i><i></i></div>'));
  orb.append(el('<svg class="lyr hq-reticle" viewBox="0 0 400 400"><g fill="none" stroke="#29e0ff" stroke-width="1.4"><path d="M150 150h-14v14M250 150h14v14M150 250h-14v-14M250 250h14v-14"/><circle cx="200" cy="200" r="4"/></g><g font-family="JetBrains Mono,monospace" font-size="8" fill="#29e0ff"><text x="268" y="146">TARGET // LOCK</text><text x="268" y="157" fill-opacity=".7">DIST 0.42AU</text></g></svg>'));

  // Cadre HUD autour de l'accueil
  const hero = document.querySelector(".hero");
  const bars = [...Array(26)].map(() => `<i style="width:${1 + Math.round(Math.random() * 3)}px"></i>`).join("");
  hero.append(el(`<div class="hq-frame" aria-hidden="true"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
    <span class="side">LEARNING PROTOCOL // V.${document.getElementById("ver").textContent.replace(/^v/i, "")} // ${new Date().getFullYear()}</span>
    <span class="barcode">${bars}</span><span class="stream">${[...Array(10)].map(() => Math.random().toString(16).slice(2, 10).toUpperCase()).join("<br>")}</span></div>`));

  // Anneau de progression autour du chrono
  const timer = document.getElementById("timer"), wrap = el('<div class="hq-ring"><svg viewBox="0 0 220 220" aria-hidden="true"><defs><linearGradient id="rg" x1="0" x2="1"><stop offset="0" stop-color="#ff2a3d"/><stop offset="1" stop-color="#ff7a87"/></linearGradient></defs><circle class="trk" cx="110" cy="110" r="96"/><circle class="tks" cx="110" cy="110" r="106"/><circle class="val" cx="110" cy="110" r="96"/></svg></div>');
  timer.before(wrap); wrap.append(timer);
  const val = wrap.querySelector(".val"), C = 2 * Math.PI * 96; val.style.strokeDasharray = C;
  const prog = document.getElementById("prog");
  const sync = () => { const p = parseFloat(prog.style.width) || 0; val.style.strokeDashoffset = C * (1 - p / 100); };
  new MutationObserver(sync).observe(prog, { attributes: true, attributeFilter: ["style"] }); sync();
}

// ---------- Effets au survol (PC, mode Qualité) ----------
if (HQ && PC) {
  root.classList.add("hq-pc");
  const SEL = ".card,.tile,.item,.topic,.badge,button,.btn";
  // projecteur qui suit la souris + inclinaison 3D des tuiles
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest && e.target.closest(SEL); if (!t) return;
    const r = t.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    t.style.setProperty("--mx", x + "px"); t.style.setProperty("--my", y + "px");
    if (t.classList.contains("tile")) t.style.transform = `perspective(700px) rotateX(${(.5 - y / r.height) * 8}deg) rotateY(${(x / r.width - .5) * 10}deg) translateY(-3px)`;
  }, { passive: true });
  document.addEventListener("pointerout", (e) => { const t = e.target.closest && e.target.closest(".tile"); if (t && !t.contains(e.relatedTarget)) t.style.transform = ""; });
  // curseur réticule
  const cur = document.createElement("div"); cur.className = "hq-cursor"; cur.innerHTML = "<i></i>"; document.body.append(cur);
  let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy, raf = 0;
  const move = () => { cx += (tx - cx) * .25; cy += (ty - cy) * .25; cur.style.transform = `translate3d(${cx}px,${cy}px,0)`; raf = Math.abs(tx - cx) + Math.abs(ty - cy) > .3 ? requestAnimationFrame(move) : 0; };
  document.addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; cur.classList.toggle("on-link", !!e.target.closest("button,a,.item,.topic,.tile,select,label,input[type=checkbox]")); cur.classList.toggle("on-text", !!e.target.closest("input:not([type=checkbox]),textarea")); if (!raf) raf = requestAnimationFrame(move); }, { passive: true });
  document.addEventListener("pointerdown", () => cur.classList.add("down")); document.addEventListener("pointerup", () => cur.classList.remove("down"));
  document.addEventListener("mouseleave", () => cur.classList.add("gone")); document.addEventListener("mouseenter", () => cur.classList.remove("gone"));
  // le globe suit légèrement la souris
  const hero = document.querySelector(".hero"), orb = document.querySelector(".orb");
  hero.addEventListener("pointermove", (e) => { const r = hero.getBoundingClientRect(); orb.style.setProperty("--ox", ((e.clientX - r.left) / r.width - .5) * 24 + "px"); orb.style.setProperty("--oy", ((e.clientY - r.top) / r.height - .5) * 18 + "px"); }, { passive: true });
  // texte « décodage » au survol des titres
  const CH = "▓▒░<>/\\|_-=+*#01";
  document.querySelectorAll(".sec,nav button,.big").forEach((n) => n.addEventListener("mouseenter", () => {
    const node = [...n.childNodes].reverse().find((c) => c.nodeType === 3 && c.textContent.trim()); if (!node || n.dataset.dec) return;
    const final = node.textContent; n.dataset.dec = 1; let i = 0;
    const id = setInterval(() => { i += 1.2; node.textContent = final.split("").map((c, k) => (k < i || c === " " ? c : CH[(Math.random() * CH.length) | 0])).join(""); if (i >= final.length) { clearInterval(id); node.textContent = final; delete n.dataset.dec; } }, 22);
  }));
}
