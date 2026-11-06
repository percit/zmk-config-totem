// Porównanie dwóch układów: te same funkcje = te same kolory. Parametry URL: ?a=redox&b=totem
(() => {
  const P = new URLSearchParams(location.search);
  const A = window.LAYOUTS[P.get("a") || "redox"], B = window.LAYOUTS[P.get("b") || "totem"];
  const NAME = { redox: "Redox", totem: "Totem", corne: "Corne" };
  const FINGER = { lk: "lewy mały", lr: "lewy serdeczny", lm: "lewy środkowy", li: "lewy wskazujący", lt: "lewy kciuk",
    rk: "prawy mały", rr: "prawy serdeczny", rm: "prawy środkowy", ri: "prawy wskazujący", rt: "prawy kciuk" };
  const CAT = {
    space: ["Spacja", "#c98a2b"], enter: ["Enter", "#c0504d"], bspc: ["Backspace / Del", "#9b3b5a"],
    cmd: ["Cmd", "#3f7fbf"], shift: ["Shift", "#7c5cbf"], opt: ["Opt", "#2f9e8f"], ctrl: ["Ctrl", "#4e9a3f"],
    layer: ["Warstwa (NAV / SYM / FN)", "#d4b020"], esc: ["Esc / Tab", "#a0662b"], arrow: ["Strzałki / PgUp / ⌘←", "#5b8fd6"],
    edit: ["⌘Z ⌘X ⌘C ⌘V", "#6d7f9e"], letter: ["Litery", "#3a3f4a"], sym: ["Cyfry i symbole", "#4b5160"], other: ["Inne (BT, media, F)", "#30343c"],
  };
  function cat(b) {
    if (b.k === "none" || b.k === "trans") return null;
    if (b.k === "mod") return { meta: "cmd", shift: "shift", alt: "opt", ctrl: "ctrl" }[b.mod];
    if (b.k === "layer") return "layer";
    const t = b.t;
    if (t === "␣") return "space";
    if (t === "⏎") return "enter";
    if (t === "⌫" || t === "Del") return "bspc";
    if (t === "Esc" || t === "Tab") return "esc";
    if (/[←→↑↓]|PgUp|PgDn/.test(t)) return "arrow";
    if (/^⌘[ZXCV]$|^⇧⌘Z$/.test(t)) return "edit";
    if (/^[A-Z]$/.test(t)) return "letter";
    if (b.k === "key" && [...t].length === 1) return "sym";
    return "other";
  }

  const SVGNS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, text) => {
    const n = document.createElementNS(SVGNS, tag);
    for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v);
    if (text != null) n.textContent = text;
    return n;
  };
  function access(R, L) {
    if (L.hold != null) return [L.hold];
    if (L.cond) return L.cond.map((n) => R.layers[n]).filter((x) => x != null);
    return [];
  }
  function draw(R, L) {
    const svg = el("svg", { class: "kbd" });
    const xs = R.keys.flatMap((k) => [k.x, k.x + k.w]), ys = R.keys.flatMap((k) => [k.y, k.y + k.h]);
    const x0 = Math.min(...xs) - 20, y0 = Math.min(...ys) - 20;
    svg.setAttribute("viewBox", `${x0} ${y0} ${Math.max(...xs) - x0 + 20} ${Math.max(...ys) - y0 + 30}`);
    const holds = access(R, L);
    R.keys.forEach((k, i) => {
      const b = L.keys[i], c = cat(b), cx = k.x + k.w / 2, cy = k.y + k.h / 2;
      const g = el("g", { class: holds.includes(i) ? "hold" : "" });
      if (k.r) g.setAttribute("transform", `rotate(${k.r} ${cx} ${cy})`);
      const rect = el("rect", { x: k.x + 4, y: k.y + 4, width: k.w - 8, height: k.h - 8, rx: 10, fill: c ? CAT[c][1] : "#202329" });
      if (holds.includes(i)) { rect.setAttribute("stroke", "#fff"); rect.setAttribute("stroke-width", 8); }
      g.append(rect);
      const t = b.k === "trans" ? "" : b.t;
      if (t) {
        const len = [...t].length;
        g.append(el("text", { x: cx, y: cy + 2, class: "c " + (len <= 1 ? "lt-big" : len <= 3 ? "lt-mid" : "lt-small") }, t));
      }
      if (holds.includes(i)) g.append(el("text", { x: cx, y: k.y + k.h - 14, class: "num", "text-anchor": "middle" }, "trzymaj"));
      g.append(el("text", { x: k.x + k.w - 10, y: k.y + 18, class: "num" }, i));
      svg.append(g);
    });
    return svg;
  }
  function cell(R, L) {
    const d = document.createElement("div"); d.className = "cell";
    if (!L) { d.classList.add("empty"); return d; }
    const h = document.createElement("h2");
    const how = L.hold != null ? `przytrzymaj #${L.hold}` : L.cond ? `naraz: ${L.cond.join(" + ")}` : "bez przytrzymania";
    h.innerHTML = `${NAME[R.name]} — ${L.name} <small>${how}</small>`;
    d.append(h, draw(R, L));
    return d;
  }

  document.getElementById("sub").textContent =
    `${NAME[A.name]}: ${A.source} · ${NAME[B.name]}: ${B.source}. Ten sam kolor = ta sama funkcja. Biała ramka = klawisz, który trzymasz dla tej warstwy.`;
  const lg = document.getElementById("legend");
  for (const [, [name, col]] of Object.entries(CAT)) lg.insertAdjacentHTML("beforeend", `<span><i style="background:${col}"></i>${name}</span>`);

  // Pary warstw: po nazwie, reszta obok siebie w kolejności.
  const la = [...A.allLayers], lb = [...B.allLayers], pairs = [];
  for (const L of [...la]) {
    const j = lb.findIndex((x) => x.name === L.name);
    if (j >= 0) { pairs.push([L, lb[j]]); lb.splice(j, 1); la.splice(la.indexOf(L), 1); }
  }
  while (la.length || lb.length) pairs.push([la.shift(), lb.shift()]);
  const rows = document.getElementById("rows");
  for (const [x, y] of pairs) {
    const r = document.createElement("div"); r.className = "row";
    r.append(cell(A, x), cell(B, y)); rows.append(r);
  }

  // Tabela: funkcja → gdzie (na warstwie BASE albo pod warstwą).
  const FUN = [
    ["Spacja", (b) => b.t === "␣"], ["Enter", (b) => b.t === "⏎"], ["Backspace", (b) => b.t === "⌫"], ["Delete", (b) => b.t === "Del"],
    ["Esc", (b) => b.t === "Esc"], ["Tab", (b) => b.t === "Tab"], ["Cmd", (b) => b.mod === "meta"], ["Shift", (b) => b.mod === "shift"],
    ["Opt", (b) => b.mod === "alt"], ["Ctrl", (b) => b.mod === "ctrl"], ["Warstwa NAV", (b) => b.k === "layer" && b.t === "NAV"],
    ["Warstwa SYM", (b) => b.k === "layer" && b.t === "SYM"], ["Warstwa FN / ADJ", (b) => b.k === "layer" && /ADJ|FN/.test(b.t)],
    ["← ↓ ↑ →", (b) => b.t === "←"], ["1", "1"], ["(", "("], ["[", "["], ["{", "{"], ["`", "`"], ["'", "'"], ["/", "/"], ["-", "-"], ["=", "="],
    ["⌘C (kopiuj)", (b) => b.t === "⌘C"], ["⌘← (początek linii)", (b) => b.t === "⌘←"],
  ];
  const where = (R, test) => {
    if (typeof test === "string") { // znak: jak go wpisać (warstwa + Shift + klawisz)
      const h = R.chars[test]; if (!h) return [];
      const parts = [];
      if (h.hold != null) parts.push(R.labels[h.hold].name);
      if (h.shift != null) parts.push("Shift");
      return [`${parts.length ? parts.join(" + ") + " + " : ""}#${h.key} ${FINGER[R.keys[h.key].finger]}`];
    }
    const out = [];
    for (const L of R.allLayers) {
      L.keys.forEach((b, i) => {
        if (b.k === "trans" || !test(b)) return;
        const pre = L.name === "BASE" ? "" : `${L.name} + `;
        out.push(`${pre}#${i} ${FINGER[R.keys[i].finger]}`);
      });
    }
    return out;
  };
  const tb = document.getElementById("table");
  tb.innerHTML = `<tr><th>Funkcja</th><th>${NAME[A.name]}</th><th>${NAME[B.name]}</th></tr>`;
  for (const [name, test] of FUN) {
    const a = where(A, test), b = where(B, test);
    if (!a.length && !b.length) continue;
    const fa = a.map((x) => x.replace(/^.*#\d+ /, "")).sort().join(), fb = b.map((x) => x.replace(/^.*#\d+ /, "")).sort().join();
    const cls = fa === fb ? "same" : "diff";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${name}</td><td class="${cls}"></td><td class="${cls}"></td>`;
    tr.children[1].textContent = a.join(" · ") || "— brak —";
    tr.children[2].textContent = b.join(" · ") || "— brak —";
    tb.append(tr);
  }
})();
