#!/usr/bin/env python3
"""Generuje js/layouts/<nazwa>.js z keymapy ZMK i geometrii.

Użycie (z katalogu redox-trainer):
    python3 tools/export_layout.py <nazwa> <plik.keymap> [opis źródła]
Geometria: tools/geometry/<nazwa>.json (patrz tools/make_geometry.py).
Wszystkie klawiatury naraz: tools/export_all.sh

Znaki są zbierane z BASE i z każdej warstwy włączanej przez &mo w BASE
(np. NAV, SYM). Kolejność wyboru, gdy znak jest w kilku miejscach:
BASE bez Shift → BASE z Shift → warstwa bez Shift → warstwa z Shift.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ZMK keycode -> (znak, znak z Shiftem). Shift = None: brak wersji z Shiftem.
CHARS = {
    **{c: (c.lower(), c) for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
    "N1": ("1", "!"), "N2": ("2", "@"), "N3": ("3", "#"), "N4": ("4", "$"),
    "N5": ("5", "%"), "N6": ("6", "^"), "N7": ("7", "&"), "N8": ("8", "*"),
    "N9": ("9", "("), "N0": ("0", ")"),
    "MINUS": ("-", "_"), "EQUAL": ("=", "+"),
    "LBKT": ("[", "{"), "RBKT": ("]", "}"), "BSLH": ("\\", "|"),
    "SEMI": (";", ":"), "SQT": ("'", '"'), "GRAVE": ("`", "~"),
    "COMMA": (",", "<"), "DOT": (".", ">"), "FSLH": ("/", "?"),
    # Kody, które same wysyłają znak z Shiftem.
    "EXCL": ("!", None), "AT": ("@", None), "HASH": ("#", None), "DLLR": ("$", None),
    "PRCNT": ("%", None), "CARET": ("^", None), "AMPS": ("&", None), "STAR": ("*", None),
    "LPAR": ("(", None), "RPAR": (")", None), "UNDER": ("_", None), "PLUS": ("+", None),
    "LBRC": ("{", None), "RBRC": ("}", None), "PIPE": ("|", None), "COLON": (":", None),
    "DQT": ('"', None), "TILDE": ("~", None), "LT": ("<", None), "GT": (">", None),
    "QMARK": ("?", None),
}

NAMES = {
    "ESC": "Esc", "TAB": "Tab", "CAPS": "Caps", "RET": "⏎", "BSPC": "⌫",
    "DEL": "Del", "LSHFT": "Shift", "RSHFT": "Shift", "LCTRL": "Ctrl", "RCTRL": "Ctrl",
    "LALT": "Opt", "RALT": "Opt", "LGUI": "Cmd", "RGUI": "Cmd", "UP": "↑", "DOWN": "↓",
    "LEFT": "←", "RIGHT": "→", "SPACE": "␣",
}


# ZMK keycode -> KeyboardEvent.code (+ Shift dla kodów z wbudowanym Shiftem).
CODES = {
    **{c: "Key" + c for c in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"},
    **{f"N{d}": f"Digit{d}" for d in range(10)},
    "MINUS": "Minus", "EQUAL": "Equal", "LBKT": "BracketLeft", "RBKT": "BracketRight",
    "BSLH": "Backslash", "SEMI": "Semicolon", "SQT": "Quote", "GRAVE": "Backquote",
    "COMMA": "Comma", "DOT": "Period", "FSLH": "Slash", "SPACE": "Space",
    "RET": "Enter", "ENTER": "Enter", "BSPC": "Backspace", "DEL": "Delete", "TAB": "Tab", "ESC": "Escape",
    "LEFT": "ArrowLeft", "RIGHT": "ArrowRight", "UP": "ArrowUp", "DOWN": "ArrowDown",
    "PG_UP": "PageUp", "PG_DN": "PageDown", "HOME": "Home", "END": "End",
    **{f"F{i}": f"F{i}" for i in range(1, 13)},
}
SHIFTED = {"EXCL": "N1", "AT": "N2", "HASH": "N3", "DLLR": "N4", "PRCNT": "N5", "CARET": "N6",
           "AMPS": "N7", "STAR": "N8", "LPAR": "N9", "RPAR": "N0", "UNDER": "MINUS", "PLUS": "EQUAL",
           "LBRC": "LBKT", "RBRC": "RBKT", "PIPE": "BSLH", "COLON": "SEMI", "DQT": "SQT",
           "TILDE": "GRAVE", "LT": "COMMA", "GT": "DOT", "QMARK": "FSLH"}
MODKEYS = {"LGUI": "meta", "RGUI": "meta", "LALT": "alt", "RALT": "alt",
           "LCTRL": "ctrl", "RCTRL": "ctrl", "LSHFT": "shift", "RSHFT": "shift"}
MODFN = {"LG": "meta", "RG": "meta", "LA": "alt", "RA": "alt", "LC": "ctrl", "RC": "ctrl", "LS": "shift", "RS": "shift"}
MODSYM = {"ctrl": "⌃", "alt": "⌥", "shift": "⇧", "meta": "⌘"}
OTHER = {"C_PREV": "⏮", "C_PP": "⏯", "C_NEXT": "⏭", "C_MUTE": "Mute", "C_VOL_UP": "Vol+", "C_VOL_DN": "Vol−",
         "C_BRI_UP": "Jas+", "C_BRI_DN": "Jas−", "BT_CLR": "BT clr", "OUT_USB": "USB", "OUT_BLE": "BLE",
         "PG_UP": "PgUp", "PG_DN": "PgDn", "HOME": "Home", "END": "End"}


def kp_action(arg):
    """'LG(LS(Z))' -> ({'code': 'KeyZ', 'mods': ['meta','shift']}, label)."""
    mods = []
    while True:
        m = re.fullmatch(r"(\w+)\((.+)\)", arg)
        if not m or m.group(1) not in MODFN:
            break
        mods.append(MODFN[m.group(1)]); arg = m.group(2)
    if arg in SHIFTED:
        mods.append("shift"); base_kc = SHIFTED[arg]
    else:
        base_kc = arg
    if arg in MODKEYS and not mods:
        return {"mod": MODKEYS[arg]}, NAMES.get(arg, arg)
    code = CODES.get(base_kc)
    if arg in CHARS and CHARS[arg][0] != " ":
        sym = CHARS[arg][0]
        sym = sym.upper() if sym.isalpha() else sym
    else:
        sym = NAMES.get(arg) or OTHER.get(arg) or arg
    order = ["ctrl", "alt", "shift", "meta"]
    label = "".join(MODSYM[m] for m in order if m in mods and not (arg in SHIFTED and m == "shift")) + sym
    act = {"code": code, "mods": sorted(set(mods))} if code else None
    return act, label


def binding_info(b):
    """Etykieta i akcja jednego bindingu (do obrazków warstw i trenera skrótów)."""
    kind, arg = b[0], b[1:] 
    if kind == "&kp":
        act, label = kp_action(arg[0])
        if act and "mod" in act:
            return {"t": label, "k": "mod", "mod": act["mod"]}
        return {"t": label, "k": "key", "act": act} if act else {"t": label, "k": "other"}
    if kind == "&mo":
        return {"t": arg[0], "k": "layer"}
    if kind == "&trans":
        return {"t": "", "k": "trans"}
    if kind == "&none":
        return {"t": "", "k": "none"}
    if kind == "&bt":
        if arg[0] == "BT_SEL":
            return {"t": f"BT{int(arg[1]) + 1}", "k": "other"}
        return {"t": OTHER.get(arg[0], arg[0]), "k": "other"}
    if kind == "&out":
        return {"t": OTHER.get(arg[0], arg[0]), "k": "other"}
    names = {"&bootloader": "Boot", "&sys_reset": "Reset"}
    return {"t": names.get(kind, kind.lstrip("&")), "k": "other"}


def parse_combos(text):
    out = []
    for m in re.finditer(r"key-positions\s*=\s*<([\d\s]+)>;\s*bindings\s*=\s*<([^>]+)>;", text):
        info = binding_info(m.group(2).split())
        out.append({"keys": [int(x) for x in m.group(1).split()], "t": info["t"], "act": info.get("act")})
    return out


def parse_conditional(text):
    return [{"if": m.group(1).split(), "then": m.group(2).strip()}
            for m in re.finditer(r"if-layers\s*=\s*<([^>]+)>;\s*then-layer\s*=\s*<([^>]+)>;", text)]


def parse_layers(text):
    layers = {}
    for m in re.finditer(r"\{[^{}]*?display-name\s*=\s*\"(\w+)\";.*?bindings\s*=\s*<(.*?)>;", text, re.S):
        body = re.sub(r"//[^\n]*", "", m.group(2))
        binds = re.findall(r"&\w+(?:\s+(?!&)[\w()]+)*", body)
        layers[m.group(1)] = [b.split() for b in binds]
    return layers


def layer_defines(text):
    """#define NAV 1 → {'NAV': 'NAV', '1': 'NAV'}; display-name zwykle = nazwa define."""
    return {m.group(1): m.group(1) for m in re.finditer(r"#define\s+(\w+)\s+\d+", text)}


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    name, keymap_path = sys.argv[1], Path(sys.argv[2])
    source = sys.argv[3] if len(sys.argv) > 3 else keymap_path.name
    text = keymap_path.read_text()
    layers = parse_layers(text)
    base = layers["BASE"]
    geo = json.loads((ROOT / "tools" / "geometry" / f"{name}.json").read_text())["keys"]
    assert len(base) == len(geo), f"BASE ma {len(base)} klawiszy, geometria {len(geo)}"
    n = len(base)

    def find(pred):
        return [i for i, b in enumerate(base) if pred(b)]
    shifts_l = find(lambda b: b == ["&kp", "LSHFT"])
    shifts_r = find(lambda b: b == ["&kp", "RSHFT"])
    # Warstwy przytrzymywane z BASE: nazwa → indeks klawisza.
    holds = {b[1]: i for i, b in enumerate(base) if b[0] == "&mo" and b[1] in layers}

    keys = [{"i": i, "x": round(g["x"] * 100), "y": round(g["y"] * 100),
             "w": round(g["w"] * 100), "h": round(g["h"] * 100), "r": g.get("r", 0),
             "finger": g["finger"], "hand": g["hand"]} for i, g in enumerate(geo)]

    def shift_for(i):
        # Shift po przeciwnej stronie; jeśli go nie ma — ten, który jest.
        opp = shifts_r if keys[i]["hand"] == "l" else shifts_l
        same = shifts_l if keys[i]["hand"] == "l" else shifts_r
        return (opp or same or [None])[0]

    labels = []
    for i in range(n):
        b, lab = base[i], {}
        if b[0] == "&kp" and b[1] in CHARS and b[1] != "SPACE":
            lab["base"], lab["shift"] = CHARS[b[1]]
        elif b[0] == "&kp":
            lab["name"] = NAMES.get(b[1], b[1])
        elif b[0] == "&mo":
            lab["name"] = b[1]
        elif b[0] in ("&none", "&trans"):
            lab["off"] = True
        else:
            lab["name"] = b[0].lstrip("&")
        lab["layers"] = {}
        for lname in holds:
            lb = layers[lname][i]
            if lb[0] == "&kp" and lb[1] in CHARS:
                lab["layers"][lname] = CHARS[lb[1]][0]
        labels.append(lab)

    chars = {}

    def add(ch, how):
        if ch and ch not in chars:
            chars[ch] = how
    passes = [("BASE", None, False), ("BASE", None, True)]
    passes += [(l, h, False) for l, h in holds.items()] + [(l, h, True) for l, h in holds.items()]
    for lname, hold, shifted in passes:
        for i, b in enumerate(layers[lname]):
            if b[0] != "&kp" or b[1] not in CHARS or b[1] == "SPACE":
                continue
            lo, up = CHARS[b[1]]
            ch = up if shifted else lo
            if shifted and (up is None or shift_for(i) is None):
                continue
            how = {"key": i}
            if hold is not None:
                how["hold"] = hold
            if shifted:
                how["shift"] = shift_for(i)
            add(ch, how)

    spaces = find(lambda b: b == ["&kp", "SPACE"])
    chars[" "] = {"key": spaces[0], "alt": spaces[1:]}

    conditional = parse_conditional(text)
    all_layers = []
    for lname, binds in layers.items():
        cond = next((c["if"] for c in conditional if c["then"] == lname), None)
        hold = holds.get(lname)
        if lname != "BASE" and hold is None and cond is None:
            # warstwa włączana inaczej (np. &mo z innej warstwy)
            src = [(ln, i) for ln, bs in layers.items() for i, b in enumerate(bs) if b[:2] == ["&mo", lname]]
            cond = [f"{ln} + #{i}" for ln, i in src] or None
        all_layers.append({"name": lname, "hold": hold, "cond": cond,
                           "keys": [binding_info(b) for b in binds]})

    data = {
        "name": name, "source": source, "exported": date.today().isoformat(),
        "keys": keys, "labels": labels, "chars": chars,
        "layers": {l: h for l, h in holds.items()},
        "allLayers": all_layers,
        "combos": parse_combos(text),
    }
    out = ROOT / "js" / "layouts" / f"{name}.js"
    out.parent.mkdir(exist_ok=True)
    out.write_text(
        "// Wygenerowane przez tools/export_layout.py — nie zmieniaj ręcznie.\n"
        f"(window.LAYOUTS ||= {{}})[{json.dumps(name)}] = " + json.dumps(data, ensure_ascii=False) + ";\n")
    missing = [c for c in "abcdefghijklmnopqrstuvwxyz0123456789-=[];',./`\\!@#$%^&*()_+{}:\"<>?~|" if c not in chars]
    print(f"{name}: {len(chars)} znaków, warstwy {holds}, spacje {spaces}"
          + (f", BRAK: {''.join(missing)}" if missing else ""))


if __name__ == "__main__":
    main()
