// Trener pisania ZMK (Redox / Totem / Corne). Logika: linie, pomiar, odblokowywanie liter, skróty, rysowanie.
(() => {
  "use strict";
  const LAYOUTS = window.LAYOUTS, SNIPPETS = window.SNIPPETS, SHORTCUTS = window.SHORTCUTS || [];
  const LINE = 52, MIN_SAMPLES = 30, PAUSE = 3000, HALF_LIFE = 7 * 864e5, TEST_MS = 60000, MAX_ERRORS = 1000;
  const ORDER = { pl: "aioeznrwsctykdpmuljbghfvxq", en: "etaoinsrhldcumfpgwybvkxjqz" };
  const START = 6;
  // Słowa: popularne (js/words_common.js, w repo) albo z notatek (js/words.js, tylko lokalnie — repo jest publiczne).
  const wordCache = {};
  const fakeWords = (letters) => Array.from({ length: 2000 }, () => {
    let w = ""; const n = 2 + Math.floor(Math.random() * 6);
    for (let i = 0; i < n; i++) w += letters[Math.floor(Math.random() * letters.length)];
    return w;
  });
  function words() {
    const key = `${opt.words}.${opt.lang}`;
    if (wordCache[key]) return wordCache[key];
    const c = window.WORDS_COMMON, n = window.WORDS;
    const src = (opt.words === "notes" ? [n] : opt.words === "both" ? [c, n] : [c]).filter(Boolean).map((x) => x[opt.lang]);
    let out;
    if (!src.length) out = fakeWords(ORDER[opt.lang]);
    else if (src.length === 1) out = src[0];
    else { // przeplataj po pozycji na liście (częste z obu na początku)
      const seen = new Set(); out = [];
      for (let i = 0; i < Math.max(...src.map((l) => l.length)); i++) for (const l of src) if (l[i] && !seen.has(l[i])) { seen.add(l[i]); out.push(l[i]); }
    }
    return (wordCache[key] = out);
  }
  const FINGER = { lk: "lewy mały", lr: "lewy serdeczny", lm: "lewy środkowy", li: "lewy wskazujący", lt: "lewy kciuk",
    rk: "prawy mały", rr: "prawy serdeczny", rm: "prawy środkowy", ri: "prawy wskazujący", rt: "prawy kciuk" };
  const DEFAULTS = { kb: "redox", lang: "pl", mode: "learn", view: "finger", caps: false, punct: false, kbd: true,
    target: 150, acc: 95, tempo: 60, escape: 15, words: "common", scGroup: "all" };
  const MODSYM = { ctrl: "⌃", alt: "⌥", shift: "⇧", meta: "⌘" }, MODNAME = { ctrl: "Ctrl", alt: "Opt", shift: "Shift", meta: "Cmd" };
  const CODE_SYM = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Backspace: "⌫", Delete: "⌦", Enter: "⏎",
    Escape: "Esc", Tab: "⇥", PageUp: "PgUp", PageDown: "PgDn", Slash: "/", BracketLeft: "[", BracketRight: "]", Comma: ",",
    Period: ".", Backquote: "`", Semicolon: ";", Quote: "'", Minus: "-", Equal: "=", Backslash: "\\", Space: "Space" };
  const comboText = (code, mods) => ["ctrl", "alt", "shift", "meta"].filter((m) => mods.includes(m)).map((m) => MODSYM[m]).join("")
    + (CODE_SYM[code] || code.replace(/^(Key|Digit)/, ""));

  const $ = (s) => document.querySelector(s);
  const rand = (n) => Math.floor(Math.random() * n);
  const pick = (a) => a[rand(a.length)];
  const pickFreq = (a) => a[Math.floor(a.length * Math.random() ** 2)]; // częstsze słowa częściej
  const today = () => new Date().toLocaleDateString("sv"); // RRRR-MM-DD
  const isLetter = (c) => /^[a-z]$/.test(c);
  const fmtTime = (ms) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  // ---------- Zapis ----------
  const load = (k, d) => { try { return { ...d, ...JSON.parse(localStorage.getItem(k)) }; } catch { return { ...d }; } };
  const opt = load("redoxTrainer.settings", DEFAULTS);
  if (!LAYOUTS[opt.kb]) opt.kb = DEFAULTS.kb;
  let R = LAYOUTS[opt.kb];
  // Migracja: stary postęp (jedna klawiatura) → Redox.
  for (const l of ["pl", "en"]) {
    const old = localStorage.getItem(`redoxTrainer.progress.${l}`);
    if (old && !localStorage.getItem(`redoxTrainer.progress.redox.${l}`)) localStorage.setItem(`redoxTrainer.progress.redox.${l}`, old);
    localStorage.removeItem(`redoxTrainer.progress.${l}`);
  }
  const saveOpt = () => localStorage.setItem("redoxTrainer.settings", JSON.stringify(opt));
  const progKey = () => `redoxTrainer.progress.${opt.kb}.${opt.lang}`;
  const freshProg = () => ({ unlocked: START, stats: {}, errors: [], days: {}, sinceUnlock: 0 });
  let prog = load(progKey(), freshProg());
  const saveProg = () => localStorage.setItem(progKey(), JSON.stringify(prog));
  const stat = (c) => (prog.stats[c] ||= { n: 0, cpm: 0, err: 0 });
  const day = () => (prog.days[today()] ||= { ms: 0, cpmSum: 0, lines: 0, best: 0 });

  // ---------- Litery i postęp ----------
  const order = () => ORDER[opt.lang];
  const unlockedLetters = () => order().slice(0, prog.unlocked);
  const allUnlocked = () => prog.unlocked >= order().length;
  const minCpm = () => opt.target * opt.tempo / 100;
  const accOf = (s) => 1 - s.err;

  function quality(c) { // 0..1, do kolorów i wyboru litery „fokus”
    const s = prog.stats[c];
    if (!s || s.n === 0) return 0;
    const speed = Math.min(s.cpm / opt.target, 1);
    const acc = Math.max(0, (accOf(s) - 0.8) / 0.2);
    return speed * Math.min(acc, 1) * Math.min(s.n / MIN_SAMPLES, 1);
  }
  function missing(c) { // co brakuje literze, żeby była „pewna”
    const s = prog.stats[c] || { n: 0, cpm: 0, err: 0 }, m = [];
    if (s.n < MIN_SAMPLES) m.push("za mało prób");
    if (accOf(s) * 100 < opt.acc) m.push("dokładność");
    if (s.cpm < minCpm()) m.push("tempo");
    return m;
  }
  const focusLetter = () => [...unlockedLetters()].sort((a, b) => quality(a) - quality(b))[0];

  function checkUnlock() {
    if (allUnlocked()) return;
    const miss = [...unlockedLetters()].map((c) => [c, missing(c)]).filter(([, m]) => m.length);
    const onlySpeed = miss.every(([, m]) => m.length === 1 && m[0] === "tempo");
    const escape = opt.escape > 0 && prog.sinceUnlock >= opt.escape * 60000 && onlySpeed;
    if (miss.length === 0 || escape) {
      const c = order()[prog.unlocked];
      prog.unlocked++; prog.sinceUnlock = 0;
      showMsg(`Nowa litera: „${c}”${miss.length ? " (wyjście awaryjne)" : ""}`);
    }
  }

  // ---------- Generowanie linii ----------
  const wordsFor = (set) => words().filter((w) => [...w].every((c) => set.includes(c)));
  function pseudo(focus, set) {
    const len = 3 + rand(4), a = [];
    for (let i = 0; i < len; i++) a.push(pick(set));
    a[rand(len)] = focus;
    return a.join("");
  }
  function decorate(w) {
    if (opt.caps && Math.random() < 0.2) w = w[0].toUpperCase() + w.slice(1);
    if (opt.punct && Math.random() < 0.15) w += pick([",", ",", ".", ";", ":", "?", "!"]);
    return w;
  }
  function fill(next) {
    let line = next();
    for (let tries = 0; tries < 200; tries++) {
      const w = next();
      if (line.length + 1 + w.length > LINE) { if (line.length > LINE - 8) break; continue; }
      line += " " + w;
    }
    return line;
  }
  function genLearn() {
    const set = unlockedLetters(), focus = focusLetter();
    const all = wordsFor(set), withF = all.filter((w) => w.includes(focus));
    return fill(() => {
      let w;
      if (Math.random() < 0.6) w = withF.length >= 5 ? pickFreq(withF) : pseudo(focus, set);
      else w = all.length ? pickFreq(all) : pseudo(focus, set);
      return decorate(w);
    });
  }
  function weakWeights() {
    const now = Date.now(), agg = {};
    for (const e of prog.errors) agg[e.exp] = (agg[e.exp] || 0) + 0.5 ** ((now - e.t) / HALF_LIFE);
    return Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }
  function genWeak() {
    const top = weakWeights();
    if (!top.length) { showMsg("Brak zapisanych pomyłek — ćwiczysz naukę."); return genLearn(); }
    const total = top.reduce((s, [, w]) => s + w, 0), all = words();
    const choose = () => { let r = Math.random() * total; for (const [c, w] of top) if ((r -= w) <= 0) return c; return top[0][0]; };
    return fill(() => {
      const c = choose();
      if (isLetter(c.toLowerCase())) {
        const lc = c.toLowerCase(), ws = all.filter((w) => w.includes(lc));
        const w = ws.length ? pickFreq(ws) : pseudo(lc, unlockedLetters());
        return c === lc ? w : w.replace(lc, c);
      }
      const sn = SNIPPETS.filter((s) => s.includes(c) && s.length < 20);
      if (sn.length && Math.random() < 0.5) return pick(sn);
      return c === " " ? pickFreq(all) : pickFreq(all) + c + pickFreq(all);
    });
  }
  function genSentences() {
    const pool = allUnlocked() ? words() : wordsFor(unlockedLetters());
    const src = pool.length ? pool : [pseudo(focusLetter(), unlockedLetters())];
    let line = "";
    for (let tries = 0; tries < 20; tries++) {
      const n = 3 + rand(5), ws = [];
      for (let i = 0; i < n; i++) ws.push(pickFreq(src));
      if (n > 4 && Math.random() < 0.4) ws[1 + rand(n - 2)] += ",";
      let s = ws.join(" ") + pick([".", ".", ".", "?", "!"]);
      s = s[0].toUpperCase() + s.slice(1);
      if (line && line.length + 1 + s.length > LINE) break;
      line += (line ? " " : "") + s;
    }
    return line.slice(0, 70);
  }
  const genSymbols = () => fill(() => pick(SNIPPETS));
  const genTest = () => fill(() => pickFreq(words().slice(0, 300)));
  const GEN = { learn: genLearn, weak: genWeak, sentences: genSentences, symbols: genSymbols, test: genTest };

  // ---------- Warstwy i skróty ----------
  const baseL = () => R.allLayers[0];
  const layerByName = (n) => R.allLayers.find((l) => l.name === n);
  function layerAccess(Lr) { // klawisze do przytrzymania, żeby włączyć warstwę
    if (Lr.name === "BASE") return [];
    if (Lr.hold != null) return [Lr.hold];
    if (Lr.cond) { const hs = Lr.cond.map((n) => R.layers[n]); if (hs.every((h) => h != null)) return hs; }
    return null;
  }
  const eff = (Lr, i) => (Lr.keys[i].k === "trans" ? baseL().keys[i] : Lr.keys[i]);
  const modsOn = (Lr, mod, used) => Lr.keys.map((_, i) => i).filter((i) => !used.includes(i) && eff(Lr, i).k === "mod" && eff(Lr, i).mod === mod);
  const sameMods = (a, b) => [...a].sort().join() === [...b].sort().join();

  // Jak nacisnąć skrót {code, mods} na tej klawiaturze. Zwraca max 2 sposoby, najprostszy pierwszy.
  function solve(t) {
    const cands = [];
    for (const Lr of R.allLayers) {
      const acc = layerAccess(Lr); if (!acc) continue;
      Lr.keys.forEach((_, i) => {
        if (acc.includes(i)) return;
        const b = eff(Lr, i);
        if (b.k !== "key" || !b.act || b.act.code !== t.code || b.act.mods.some((m) => !t.mods.includes(m))) return;
        const miss = t.mods.filter((m) => !b.act.mods.includes(m));
        const mods = [], pre = [];
        for (const m of miss) {
          const used = [i, ...acc, ...mods, ...pre.map((p) => p.key)];
          let q = modsOn(Lr, m, used)[0];
          if (q != null) { mods.push(q); continue; }
          q = modsOn(baseL(), m, used)[0]; // modyfikator z BASE wciśnięty przed warstwą
          if (q != null && Lr.name !== "BASE") { pre.push({ key: q, mod: m }); continue; }
          let found = null; // modyfikator z innej warstwy: przytrzymaj ją, wciśnij mod, puść warstwę
          for (const L2 of R.allLayers) {
            const a2 = L2 === Lr || L2.name === "BASE" ? null : layerAccess(L2); if (!a2) continue;
            const q2 = modsOn(L2, m, [...used, ...a2])[0];
            if (q2 != null) { found = { key: q2, mod: m, via: L2.name, access: a2 }; break; }
          }
          if (!found) return;
          pre.push(found);
        }
        // Klawisz przezroczysty na warstwie bez modyfikatorów z tej warstwy = to samo co BASE, pomiń.
        if (Lr.name !== "BASE" && Lr.keys[i].k === "trans" && !mods.length) return;
        cands.push({ layer: Lr.name, acc, mods, pre, key: i, label: b.t,
          cost: acc.length + mods.length + pre.length + 1 + 0.5 * miss.length + 3 * pre.filter((p) => p.via).length });
      });
    }
    for (const c of R.combos || []) {
      if (c.act && c.act.code === t.code && sameMods(c.act.mods, t.mods))
        cands.push({ layer: "BASE", acc: [], mods: [], pre: [], combo: c.keys, label: c.t, cost: 2.5 });
    }
    return cands.sort((a, b) => a.cost - b.cost).slice(0, 2);
  }
  const kdesc = (i) => `#${i} ${FINGER[R.keys[i].finger]}`;
  function solText(sol) {
    const parts = [];
    for (const p of sol.pre) {
      if (p.via) parts.push(`przytrzymaj ${p.via} (${p.access.map((i) => "#" + i).join("+")}), wciśnij i trzymaj ${MODNAME[p.mod]} (${kdesc(p.key)}), puść ${p.via}`);
      else parts.push(`${MODNAME[p.mod]} (${kdesc(p.key)})`);
    }
    if (sol.acc.length) parts.push(`przytrzymaj ${sol.layer} (${sol.acc.map(kdesc).join(" + ")})`);
    for (const m of sol.mods) parts.push(`${eff(layerByName(sol.layer), m).t} (${kdesc(m)})`);
    if (sol.combo) parts.push(`naciśnij razem ${sol.combo.map((i) => `#${i} ${baseL().keys[i].t}`).join(" + ")}`);
    else parts.push(`${sol.label} (${kdesc(sol.key)})`);
    return parts.join(" → ") + (sol.pre.some((p) => p.via) ? "  ⚠️ trudne na tej klawiaturze" : "");
  }
  function solHighlight(sol) {
    if (!sol) return {};
    return {
      holds: [...sol.acc, ...sol.pre.filter((p) => p.via).flatMap((p) => p.access)],
      mods: [...sol.mods, ...sol.pre.map((p) => p.key)],
      target: sol.combo ? sol.combo : [sol.key],
    };
  }

  function kbdViewBox() {
    const xs = R.keys.flatMap((k) => [k.x, k.x + k.w]), ys = R.keys.flatMap((k) => [k.y, k.y + k.h]);
    const x0 = Math.min(...xs) - 20, y0 = Math.min(...ys) - 20;
    return `${x0} ${y0} ${Math.max(...xs) - x0 + 20} ${Math.max(...ys) - y0 + 40}`;
  }
  // Rysuje dowolną warstwę (etykiety z keymapy). hl = { holds, mods, target } — indeksy klawiszy.
  function drawLayer(svg, Lr, hl = {}) {
    svg.textContent = "";
    const holds = [...(layerAccess(Lr) || []), ...(hl.holds || [])];
    R.keys.forEach((k, i) => {
      const b = Lr.keys[i], cls = ["key"];
      let text = b.t;
      if (b.k === "none") cls.push("off");
      else if (b.k === "trans") { cls.push("trans"); text = baseL().keys[i].t; }
      else if (b.k === "mod" || b.k === "layer" || b.k === "other") cls.push("modkey");
      else cls.push("f-" + k.finger);
      if (holds.includes(i)) cls.push("hold");
      if ((hl.mods || []).includes(i)) cls.push("mod");
      if ((hl.target || []).includes(i)) cls.push("target");
      const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
      const g = el("g", { class: cls.join(" ") });
      if (k.r) g.setAttribute("transform", `rotate(${k.r} ${cx} ${cy})`);
      g.append(el("rect", { x: k.x + 4, y: k.y + 4, width: k.w - 8, height: k.h - 8, rx: 10 }));
      if (text) {
        const len = [...text].length;
        g.append(el("text", { x: cx, y: cy + 2, class: len <= 1 ? "lt-big" : len <= 3 ? "lt-mid" : "lt-small" }, text));
      }
      g.append(el("text", { x: k.x + k.w - 10, y: k.y + 18, class: "num" }, i));
      svg.append(g);
    });
  }
  function renderLayers() {
    const box = $("#layers"); box.textContent = "";
    for (const Lr of R.allLayers) {
      const acc = layerAccess(Lr);
      let how = "bez przytrzymania";
      if (Lr.hold != null) how = `przytrzymaj #${Lr.hold} (${FINGER[R.keys[Lr.hold].finger]})`;
      else if (Lr.cond && acc) how = `przytrzymaj naraz ${Lr.cond.join(" + ")} (${acc.map((i) => "#" + i).join(" + ")})`;
      else if (Lr.cond) how = Lr.cond.join(", ");
      const div = document.createElement("div"); div.className = "layer";
      const h = document.createElement("h3"); h.textContent = Lr.name + " ";
      const sm = document.createElement("small"); sm.textContent = how; h.append(sm);
      const svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "kbd"); svg.setAttribute("viewBox", kbdViewBox());
      drawLayer(svg, Lr);
      div.append(h, svg); box.append(div);
    }
    if ((R.combos || []).length) {
      const c = document.createElement("div"); c.className = "combos";
      c.textContent = "Kombinacje (naciśnij razem): " + R.combos.map((x) => `${x.t} = ${x.keys.map((i) => `#${i} ${baseL().keys[i].t}`).join(" + ")}`).join(" · ");
      box.append(c);
    }
  }

  // ---------- Tryb „Skróty” ----------
  let SC = null; // { item, sols, shownAt, erred, done, hint, timer }
  const scId = (s) => s.g + "|" + s.d;
  const scStat = (id) => ((prog.sc ||= {})[id] ||= { n: 0, ms: 0, err: 0 });
  const scGroup = () => SHORTCUTS.filter((s) => opt.scGroup === "all" || s.g === opt.scGroup);
  function nextShortcut() {
    if (SC && SC.timer) clearTimeout(SC.timer);
    const all = scGroup().map((s) => ({ s, sols: solve({ code: s.c, mods: s.m }) }));
    const pool = all.filter((x) => x.sols.length), none = all.filter((x) => !x.sols.length);
    $("#sc-count").textContent = `${pool.length} skrótów do ćwiczenia`;
    $("#status").textContent = none.length
      ? `Nie da się nacisnąć na tej klawiaturze (${none.length}): ` + none.map((x) => `${comboText(x.s.c, x.s.m)} ${x.s.d}`).join(" · ")
      : "Wszystkie skróty z tej grupy da się nacisnąć.";
    if (!pool.length) { SC = null; $("#sc-desc").textContent = "Brak skrótów."; return; }
    const lastId = SC && scId(SC.item);
    const cand = pool.filter((x) => pool.length === 1 || scId(x.s) !== lastId);
    const w = cand.map((x) => { const st = scStat(scId(x.s)); return 1 + (st.n < 3 ? 4 : 0) + st.err * 8 + Math.min(st.ms / 1000, 4); });
    let r = Math.random() * w.reduce((a, b) => a + b, 0), idx = 0;
    while ((r -= w[idx]) > 0 && idx < w.length - 1) idx++;
    const { s, sols } = cand[idx], st = scStat(scId(s));
    const learned = st.n >= 3 && st.err < 0.3;
    SC = { item: s, sols, shownAt: performance.now(), erred: false, done: false, hint: !learned };
    if (learned) SC.timer = setTimeout(() => { SC.hint = true; renderShortcut(); }, 3000);
    $("#sc-res").textContent = ""; $("#sc-res").className = "sc-res";
    renderShortcut();
  }
  function renderShortcut() {
    if (!SC) return;
    $("#sc-desc").textContent = SC.item.d;
    $("#sc-combo").textContent = comboText(SC.item.c, SC.item.m);
    $("#hint").textContent = SC.hint ? SC.sols.map((x, i) => (i ? "albo: " : "") + solText(x)).join("\n") : "podpowiedź za 3 s…";
    renderKbd();
  }
  function onShortcutKey(e) {
    if (e.repeat || ["Meta", "Shift", "Alt", "Control", "CapsLock", "Fn", "Dead"].includes(e.key)) return;
    e.preventDefault();
    if (!SC || SC.done) return;
    const mods = ["alt", "ctrl", "meta", "shift"].filter((m) => e[m + "Key"]);
    const st = scStat(scId(SC.item)), res = $("#sc-res");
    if (e.code === SC.item.c && sameMods(mods, SC.item.m)) {
      const dt = Math.min(performance.now() - SC.shownAt, 10000);
      st.ms = st.n ? 0.8 * st.ms + 0.2 * dt : dt; st.n++;
      if (!SC.erred) st.err *= 0.85;
      day().ms += dt; saveProg();
      SC.done = true; clearTimeout(SC.timer);
      res.textContent = `✓ ${(dt / 1000).toFixed(1)} s`; res.className = "sc-res ok";
      setTimeout(() => { nextShortcut(); renderSide(); }, 400);
    } else {
      if (!SC.erred) { st.err = 0.85 * st.err + 0.15; SC.erred = true; saveProg(); }
      res.textContent = `Wciśnięto: ${comboText(e.code, mods)}`; res.className = "sc-res bad";
      SC.hint = true; clearTimeout(SC.timer); renderShortcut();
    }
  }

  // ---------- Pisanie ----------
  let L = null; // stan bieżącej linii
  let test = null; // { start, timer, chars, done }
  let justFinished = false;

  function newLine() {
    if (opt.mode === "shortcuts") { nextShortcut(); return; }
    const text = GEN[opt.mode]();
    L = { text, pos: 0, errs: new Set(), start: 0, last: 0, active: 0, ok: 0, bad: 0 };
    render();
  }
  function restartLine() { if (L) { L = { ...L, pos: 0, errs: new Set(), start: 0, last: 0, active: 0, ok: 0, bad: 0 }; render(); } }

  function category(exp, got) {
    const he = R.chars[exp], hg = R.chars[got];
    if (!hg) return "Znak spoza układu — sprawdź źródło wprowadzania";
    if (he && he.key === hg.key) return "Dobry klawisz, zły modyfikator (Shift/NAV)";
    if (he && dist(he.key, hg.key) < 150) return "Sąsiedni klawisz";
    return "Inny błąd";
  }
  function dist(a, b) {
    const ka = R.keys[a], kb = R.keys[b];
    return Math.hypot(ka.x + ka.w / 2 - kb.x - kb.w / 2, ka.y + ka.h / 2 - kb.y - kb.h / 2);
  }

  function onKey(e) {
    if (e.target.closest && e.target.closest("input, select, textarea, summary")) return;
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === "Escape") { e.preventDefault(); restartLine(); return; }
    if (e.key.length !== 1 || !L) return;
    e.preventDefault();
    if (test && test.done) return;
    const ch = e.key;
    if (justFinished && ch === " ") { justFinished = false; return; }
    justFinished = false;
    const now = performance.now(), exp = L.text[L.pos];
    if (opt.mode === "test" && !test) startTest();
    if (ch === exp) {
      if (L.pos === 0) L.start = now;
      if (L.last && now - L.last < PAUSE) {
        const dt = now - L.last, s = stat(exp), cpm = 60000 / dt;
        s.cpm = s.n === 0 ? cpm : 0.9 * s.cpm + 0.1 * cpm;
        s.n++;
        if (!L.errs.has(L.pos)) s.err *= 0.9;
        L.active += dt;
      }
      L.last = now; L.ok++; L.pos++;
      if (test) test.chars++;
      if (L.pos >= L.text.length) return finishLine();
    } else {
      L.bad++;
      flash(ch);
      if (!L.errs.has(L.pos)) {
        L.errs.add(L.pos);
        const s = stat(exp); s.err = 0.9 * s.err + 0.1;
        prog.errors.push({ exp, got: ch, cat: category(exp, ch), t: Date.now() });
        if (prog.errors.length > MAX_ERRORS) prog.errors.splice(0, prog.errors.length - MAX_ERRORS);
      }
    }
    render();
  }

  function finishLine() {
    const dur = L.last - L.start, d = day();
    const cpm = dur > 0 ? (L.text.length - 1) / dur * 60000 : 0;
    const acc = L.ok / (L.ok + L.bad);
    d.ms += L.active;
    if (opt.mode !== "test") {
      d.cpmSum += cpm; d.lines++;
      setStats(cpm, acc);
    }
    if (opt.mode === "learn") { prog.sinceUnlock += L.active; checkUnlock(); }
    saveProg();
    justFinished = true;
    newLine();
    renderSide();
  }

  function startTest() {
    test = { start: performance.now(), chars: 0, done: false };
    test.timer = setInterval(() => {
      const left = TEST_MS - (performance.now() - test.start);
      if (left <= 0) return endTest();
      $("#status").textContent = `Test: zostało ${Math.ceil(left / 1000)} s`;
    }, 200);
  }
  function endTest() {
    clearInterval(test.timer);
    test.done = true;
    const cpm = test.chars, d = day();
    d.ms += L.active;
    d.best = Math.max(d.best, cpm);
    saveProg();
    setStats(cpm, null);
    $("#status").textContent = `Wynik testu: ${cpm} znaków/min (${Math.round(cpm / 5)} słów/min). Esc = nowy test.`;
    renderSide();
  }
  function resetTest() { if (test) clearInterval(test.timer); test = null; }

  // ---------- Rysowanie ----------
  function setStats(cpm, acc) {
    $("#s-cpm").textContent = Math.round(cpm);
    $("#s-wpm").textContent = Math.round(cpm / 5);
    if (acc != null) $("#s-acc").textContent = Math.round(acc * 100) + "%";
  }
  let msgTimer;
  function showMsg(t) { $("#msg").textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => ($("#msg").textContent = ""), 5000); }

  function renderLine() {
    const el = $("#line"); el.textContent = "";
    [...L.text].forEach((c, i) => {
      const s = document.createElement("span");
      s.textContent = c === " " && i === L.pos ? "·" : c;
      if (i < L.pos) s.className = "done" + (L.errs.has(i) ? " err" : "");
      if (i === L.pos) s.className = "cur" + (L.errs.has(i) ? " err" : "");
      el.append(s);
    });
  }

  function howTo(c) {
    const h = R.chars[c];
    if (!h) return null;
    const keys = [h.key, ...(h.alt || [])];
    const mods = [h.shift, h.hold].filter((x) => x != null);
    return { keys, mods, h };
  }
  function renderHint() {
    const c = L.text[L.pos], how = c && howTo(c);
    if (!how) { $("#hint").textContent = ""; return; }
    const k = (i) => `#${i} ${FINGER[R.keys[i].finger]}`;
    const parts = [];
    if (how.h.hold != null) parts.push(`przytrzymaj ${R.labels[how.h.hold].name} (${k(how.h.hold)})`);
    if (how.h.shift != null) parts.push(`Shift (${k(how.h.shift)})`);
    const name = c === " " ? "spacja" : `„${c}”`;
    const key = c === " " ? `#${how.keys.join(" lub #")} kciuk` : k(how.h.key);
    $("#hint").textContent = `${name}: ${[...parts, key].join(" + ")}`;
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v);
    if (text != null) n.textContent = text;
    return n;
  };
  function keyColor(i) {
    const b = R.labels[i].base;
    if (!b) return "#3a3e48";
    const s = prog.stats[b];
    if (!s || !s.n) return "#3a3e48";
    return `hsl(${quality(b) * 120} 55% 38%)`;
  }
  function renderKbd() {
    const svg = $("#kbd");
    svg.style.display = opt.kbd ? "" : "none";
    $(".legend").style.display = opt.kbd ? "" : "none";
    if (!opt.kbd) return;
    if (opt.mode === "shortcuts") {
      const sol = SC && SC.hint ? SC.sols[0] : null;
      drawLayer(svg, sol ? layerByName(sol.layer) : baseL(), solHighlight(sol));
      return;
    }
    svg.textContent = "";
    const c = L && L.text[L.pos], how = c ? howTo(c) : null;
    const active = new Set(opt.mode === "learn" ? [...unlockedLetters()] : []);
    R.keys.forEach((k, i) => {
      const lab = R.labels[i];
      const cls = ["key"];
      if (lab.off) cls.push("off");
      else if (lab.name && opt.view === "finger") cls.push("fn");
      else cls.push("f-" + k.finger);
      if (opt.mode === "learn" && isLetter(lab.base || "") && !active.has(lab.base)) cls.push("dimmed");
      if (how && how.keys.includes(i)) cls.push("target");
      if (how && how.mods.includes(i)) cls.push("mod");
      if (flashKey === i) cls.push("flash");
      const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
      const g = el("g", { class: cls.join(" "), "data-i": i });
      if (k.r) g.setAttribute("transform", `rotate(${k.r} ${cx} ${cy})`);
      const rect = el("rect", { x: k.x + 4, y: k.y + 4, width: k.w - 8, height: k.h - 8, rx: 10 });
      if (opt.view === "heat" && !lab.off) { const col = keyColor(i); if (col) rect.style.fill = col; }
      g.append(rect);
      if (lab.base) {
        const letter = isLetter(lab.base);
        g.append(el("text", { x: cx, y: cy + 4, class: "main" }, letter ? lab.base.toUpperCase() : lab.base));
        if (!letter && lab.shift) g.append(el("text", { x: k.x + 14, y: k.y + 24, class: "sh" }, lab.shift));
      } else if (lab.name) {
        g.append(el("text", { x: cx, y: cy, class: "name" }, lab.name));
      }
      charLayers().forEach((ln, j) => {
        const ch = lab.layers && lab.layers[ln];
        if (ch) g.append(el("text", j === 0 ? { x: k.x + k.w - 12, y: k.y + k.h - 22, class: "l0" } : { x: k.x + 12, y: k.y + k.h - 22, class: "l1" }, ch));
      });
      g.append(el("text", { x: k.x + k.w - 10, y: k.y + 18, class: "num" }, i));
      if (opt.view === "heat" && lab.base && prog.stats[lab.base]) {
        const s = prog.stats[lab.base];
        g.append(el("title", {}, `${lab.base}: ${Math.round(s.cpm)} zn/min, błędy ${Math.round(s.err * 100)}%, prób ${s.n}`));
      }
      svg.append(g);
    });
  }
  // Warstwy, które mają znaki (np. NAV na Redoxie, SYM na Totemie) — max 2 na obrazku.
  const charLayers = () => Object.keys(R.layers).filter((l) => R.labels.some((x) => x.layers && x.layers[l])).slice(0, 2);
  function renderKbdFrame() {
    $("#kbd").setAttribute("viewBox", kbdViewBox());
    renderLayers();
    const pos = ["prawy dolny róg", "lewy dolny róg"];
    $(".legend").textContent = ["górny lewy róg: Shift", ...charLayers().map((l, j) => `${pos[j]}: ${l} (przytrzymaj #${R.layers[l]})`), "numer klawisza: górny prawy róg"].join(" · ");
    $("#src").textContent = `${R.source}, eksport ${R.exported}`;
  }
  let flashKey = null, flashTimer;
  function flash(ch) {
    const h = R.chars[ch];
    flashKey = h ? h.key : null;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => { flashKey = null; renderKbd(); }, 250);
  }

  function renderLetters() {
    const box = $("#letters"); box.textContent = "";
    const focus = opt.mode === "learn" ? focusLetter() : null;
    [...order()].forEach((c, i) => {
      const s = document.createElement("span");
      s.textContent = c;
      if (i < prog.unlocked) {
        const q = quality(c);
        s.style.background = prog.stats[c]?.n ? `hsl(${q * 120} 55% 38%)` : "";
        s.style.color = prog.stats[c]?.n ? "#fff" : "";
        if (c === focus) s.classList.add("focus");
        const st = prog.stats[c];
        s.title = st ? `${Math.round(st.cpm)} zn/min, dokładność ${Math.round(accOf(st) * 100)}%, prób ${st.n}` : "brak prób";
      } else {
        s.className = "locked";
        s.title = "Kliknij, aby odblokować do tej litery";
        s.onclick = () => {
          if (confirm(`Odblokować litery do „${c}”?`)) { prog.unlocked = i + 1; prog.sinceUnlock = 0; saveProg(); newLine(); renderSide(); }
        };
      }
      box.append(s);
    });
    if (opt.mode === "test" && test) return;
    if (allUnlocked()) { $("#status").textContent = "Wszystkie litery odblokowane."; return; }
    const next = order()[prog.unlocked];
    const miss = [...unlockedLetters()].map((c) => [c, missing(c)]).filter(([, m]) => m.length);
    $("#status").textContent = miss.length
      ? `Do „${next}” brakuje: ` + miss.map(([c, m]) => `${c} (${m.join(", ")})`).join(" · ")
      : `Następna litera: „${next}”.`;
  }

  function renderHistory() {
    const svg = $("#hist"); svg.textContent = "";
    const W = 600, H = 220, P = 24, days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toLocaleDateString("sv");
      days.push([d, prog.days[d]]);
    }
    const maxMin = Math.max(10, ...days.map(([, v]) => (v ? v.ms / 60000 : 0)));
    const avg = (v) => (v && v.lines ? v.cpmSum / v.lines : 0);
    const maxCpm = Math.max(opt.target * 1.2, ...days.map(([, v]) => Math.max(avg(v), v ? v.best : 0)));
    const bw = (W - 2 * P) / 30, y = (cpm) => H - P - (cpm / maxCpm) * (H - 2 * P);
    days.forEach(([d, v], i) => {
      const x = P + i * bw;
      if (v && v.ms) {
        const h = (v.ms / 60000 / maxMin) * (H - 2 * P);
        svg.append(el("rect", { x: x + 2, y: H - P - h, width: bw - 4, height: h, fill: "#3a4252" },));
      }
      if (i % 7 === 2) svg.append(el("text", { x: x, y: H - 6 }, d.slice(5)));
    });
    const pts = days.map(([, v], i) => [P + i * bw + bw / 2, avg(v)]).filter(([, c]) => c > 0);
    if (pts.length) svg.append(el("polyline", { points: pts.map(([x, c]) => `${x},${y(c)}`).join(" "), fill: "none", stroke: "#6cb6ff", "stroke-width": 2.5 }));
    pts.forEach(([x, c]) => svg.append(el("circle", { cx: x, cy: y(c), r: 3.5, fill: "#6cb6ff" })));
    days.forEach(([, v], i) => {
      if (v && v.best) {
        const x = P + i * bw + bw / 2, yy = y(v.best);
        svg.append(el("path", { d: `M${x} ${yy - 6}L${x + 6} ${yy}L${x} ${yy + 6}L${x - 6} ${yy}Z`, fill: "#e0b450" }));
      }
    });
    svg.append(el("line", { x1: P, x2: W - P, y1: y(opt.target), y2: y(opt.target), stroke: "#57c78a", "stroke-dasharray": "6 5" }));
    svg.append(el("text", { x: W - P, y: y(opt.target) - 6, "text-anchor": "end" }, `cel ${opt.target}`));
    svg.append(el("text", { x: P, y: 20 }, `słupki: minuty (max ${Math.round(maxMin)}) · linia: śr. zn/min · romby: test`));

    const sum = (from, to) => {
      let ms = 0, cs = 0, n = 0;
      days.slice(from, to).forEach(([, v]) => { if (v) { ms += v.ms; cs += v.cpmSum; n += v.lines; } });
      return { min: Math.round(ms / 60000), cpm: n ? Math.round(cs / n) : 0 };
    };
    const a = sum(23, 30), b = sum(16, 23);
    $("#hist-sum").textContent = `Ostatnie 7 dni: ${a.min} min, śr. ${a.cpm || "–"} zn/min. Poprzednie 7 dni: ${b.min} min, śr. ${b.cpm || "–"} zn/min.`;
  }

  function renderScTable() {
    $("#conf-title").textContent = "Najsłabsze skróty";
    const rows = scGroup().map((s) => ({ s, st: (prog.sc || {})[scId(s)] })).filter((x) => x.st && x.st.n)
      .sort((a, b) => (b.st.err * 8 + b.st.ms / 1000) - (a.st.err * 8 + a.st.ms / 1000)).slice(0, 15);
    const t = $("#conf"); t.textContent = "";
    if (!rows.length) { t.innerHTML = "<tr><td class='small'>Brak danych — poćwicz skróty.</td></tr>"; return; }
    t.innerHTML = "<tr><th>Skrót</th><th>Co robi</th><th>Czas</th><th>Błędy</th></tr>";
    for (const { s, st } of rows) {
      const tr = document.createElement("tr");
      for (const [v, cls] of [[comboText(s.c, s.m), "ch"], [s.d, "small"], [(st.ms / 1000).toFixed(1) + " s", ""], [Math.round(st.err * 100) + "%", ""]]) {
        const td = document.createElement("td"); td.textContent = v; if (cls) td.className = cls; tr.append(td);
      }
      t.append(tr);
    }
  }
  function renderConf() {
    if (opt.mode === "shortcuts") return renderScTable();
    $("#conf-title").textContent = "Pomyłki";
    const now = Date.now(), agg = {};
    for (const e of prog.errors) {
      const k = e.exp + "\u0000" + e.got;
      const a = (agg[k] ||= { exp: e.exp, got: e.got, n: 0, w: 0, cat: e.cat });
      a.n++; a.w += 0.5 ** ((now - e.t) / HALF_LIFE); a.cat = e.cat;
    }
    const rows = Object.values(agg).sort((a, b) => b.w - a.w).slice(0, 15);
    const t = $("#conf"); t.textContent = "";
    if (!rows.length) { t.innerHTML = "<tr><td class='small'>Brak pomyłek.</td></tr>"; return; }
    t.innerHTML = "<tr><th>Miało być</th><th>Wpisane</th><th>Ile</th><th>Przyczyna</th></tr>";
    const show = (c) => (c === " " ? "␣" : c);
    for (const r of rows) {
      const tr = document.createElement("tr");
      for (const [v, cls] of [[show(r.exp), "ch"], [show(r.got), "ch"], [r.n, ""], [r.cat, "small"]]) {
        const td = document.createElement("td"); td.textContent = v; if (cls) td.className = cls; tr.append(td);
      }
      t.append(tr);
    }
  }

  function renderSide() {
    if (opt.mode !== "shortcuts") renderLetters();
    renderHistory();
    renderConf();
    $("#s-today").textContent = fmtTime(day().ms);
  }
  function render() { renderLine(); renderHint(); renderKbd(); }
  function renderModeUI() {
    const sc = opt.mode === "shortcuts";
    $("#sc").hidden = !sc; $("#line").hidden = sc; $("#letters").hidden = sc;
    $("#hint").style.whiteSpace = sc ? "pre-line" : "";
  }

  function renderControls() {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.mode === opt.mode));
    document.querySelectorAll("#kb button").forEach((b) => b.classList.toggle("on", b.dataset.kb === opt.kb));
    document.querySelectorAll("#lang button").forEach((b) => b.classList.toggle("on", b.dataset.lang === opt.lang));
    document.querySelectorAll("#view button").forEach((b) => b.classList.toggle("on", b.dataset.view === opt.view));
    const f = $("#settings");
    for (const k of ["caps", "punct", "kbd"]) f.elements[k].checked = opt[k];
    f.elements.words.value = opt.words;
    for (const o of f.elements.words.options) o.disabled = o.value !== "common" && !window.WORDS;
    $("#sc-group").value = opt.scGroup;
    renderModeUI();
    for (const k of ["target", "acc", "tempo", "escape"]) f.elements[k].value = opt[k];
  }

  // ---------- Sterowanie ----------
  function setMode(m) { opt.mode = m; saveOpt(); resetTest(); renderControls(); newLine(); renderSide(); $("#line").focus(); }
  $("#tabs").onclick = (e) => { const m = e.target.dataset.mode; if (m) setMode(m); };
  $("#weak-go").onclick = () => setMode("weak");
  $("#lang").onclick = (e) => {
    const l = e.target.dataset.lang; if (!l || l === opt.lang) return;
    opt.lang = l; saveOpt(); prog = load(progKey(), freshProg()); resetTest(); renderControls(); newLine(); renderSide();
  };
  $("#kb").onclick = (e) => {
    const kb = e.target.dataset.kb; if (!kb || kb === opt.kb || !LAYOUTS[kb]) return;
    opt.kb = kb; R = LAYOUTS[kb]; saveOpt(); prog = load(progKey(), freshProg()); resetTest();
    renderKbdFrame(); renderControls(); newLine(); renderSide();
  };
  $("#view").onclick = (e) => { const v = e.target.dataset.view; if (v) { opt.view = v; saveOpt(); renderControls(); renderKbd(); } };
  $("#settings").onchange = (e) => {
    const t = e.target;
    opt[t.name] = t.type === "checkbox" ? t.checked : t.tagName === "SELECT" ? t.value : Number(t.value) || DEFAULTS[t.name];
    saveOpt(); renderSide(); if (t.name === "kbd") renderKbd(); else newLine();
  };
  $("#unlock-next").onclick = () => { if (!allUnlocked()) { prog.unlocked++; prog.sinceUnlock = 0; saveProg(); newLine(); renderSide(); } };
  $("#reset").onclick = () => {
    if (confirm(`Wyczyścić cały postęp dla ${opt.kb} / ${opt.lang.toUpperCase()}?`)) { prog = freshProg(); saveProg(); newLine(); renderSide(); }
  };
  $("#export").onclick = () => {
    const data = { settings: opt, progress: {} };
    for (const kb of Object.keys(LAYOUTS)) for (const l of ["pl", "en"]) {
      const v = localStorage.getItem(`redoxTrainer.progress.${kb}.${l}`); if (v) data.progress[`${kb}.${l}`] = JSON.parse(v);
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `redox-trainer-${today()}.json`; a.click();
  };
  $("#import").onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      for (const [k, v] of Object.entries(data.progress || {})) localStorage.setItem(`redoxTrainer.progress.${k}`, JSON.stringify(v));
      prog = load(progKey(), freshProg()); newLine(); renderSide(); showMsg("Zaimportowano postęp.");
    } catch { alert("Zły plik."); }
  };
  // Po kliknięciu przycisku zdejmij z niego fokus, żeby spacja nie klikała go ponownie.
  document.addEventListener("click", (e) => { if (e.target.closest("button")) e.target.closest("button").blur(); });
  $("#sc-group").onchange = (e) => { opt.scGroup = e.target.value; saveOpt(); e.target.blur(); nextShortcut(); renderSide(); };
  document.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, select, textarea")) return;
    if (opt.mode === "shortcuts") return onShortcutKey(e);
    if (e.key === "Escape" && test) { e.preventDefault(); resetTest(); newLine(); renderSide(); return; }
    onKey(e);
  });

  if (!window.WORDS && opt.words !== "common") opt.words = "common";
  renderKbdFrame();
  renderControls();
  newLine();
  renderSide();
})();
