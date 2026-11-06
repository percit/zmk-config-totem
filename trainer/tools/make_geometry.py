#!/usr/bin/env python3
"""Tworzy tools/geometry/{redox,corne,totem}.json — jeden format dla wszystkich klawiatur.

Każdy klawisz: x, y, w, h (jednostki: 1 = 1u), r (obrót w stopniach wokół środka),
finger (lk lr lm li lt / rt ri rm rr rk), hand (l / r).
Kolejność klawiszy = kolejność bindings w keymapie ZMK.

Źródła: Redox i Corne — QMK info.json. Totem — ręcznie (brak w QMK), wg zdjęć/SVG Totema.
"""
import json
from pathlib import Path

G = Path(__file__).resolve().parent / "geometry"
L_FINGERS = ["lk", "lr", "lm", "li", "li"]  # kolumny od zewnątrz: mały, serdeczny, środkowy, wskazujący x2


def save(name, keys):
    (G / f"{name}.json").write_text(json.dumps({"keys": keys}, indent=0))
    print(name, len(keys))


def key(x, y, finger, w=1, h=1, r=0):
    return {"x": round(x, 3), "y": round(y, 3), "w": w, "h": h, "r": r,
            "finger": finger, "hand": finger[0]}


def redox():
    lay = json.loads((G / "redox_rev1_info.json").read_text())["layouts"]["LAYOUT"]["layout"]
    out = []
    for i, g in enumerate(lay):
        w, h = g.get("w", 1), g.get("h", 1)
        x = g["x"] + w / 2
        if i in (60, 61, 46, 47, 62):
            f = "lt"
        elif i in (64, 65, 48, 49, 63):
            f = "rt"
        elif x < 9:
            f = "lk" if x < 2.25 else "lr" if x < 3.25 else "lm" if x < 4.25 else "li"
        else:
            f = "ri" if x < 14.25 else "rm" if x < 15.25 else "rr" if x < 16.25 else "rk"
        out.append(key(g["x"], g["y"], f, w, h))
    save("redox", out)


def corne():
    lay = json.loads((G / "crkbd_info.json").read_text())["layouts"]["LAYOUT_split_3x6_3"]["layout"]
    cols = ["lk", "lk", "lr", "lm", "li", "li", "ri", "ri", "rm", "rr", "rk", "rk"]
    out = []
    for i, g in enumerate(lay):
        f = cols[i % 12] if i < 36 else ("lt" if i < 39 else "rt")
        out.append(key(g["x"], g["y"], f, g.get("w", 1), g.get("h", 1)))
    save("corne", out)


def totem():
    # Lewa połowa: kolumny x = 1..5 (mały → wewnętrzny wskazujący), przesunięcie kolumn w pionie.
    stag = [0.55, 0.2, 0, 0.15, 0.3]
    right_x = lambda x: 15 - x  # lustro (prawa połowa zaczyna się od x = 9)
    out = []
    for row in range(2):  # rzędy 0 i 1: po 10 klawiszy
        out += [key(1 + c, row + stag[c], L_FINGERS[c]) for c in range(5)]
        out += [key(right_x(1 + c) - 1, row + stag[c], "r" + L_FINGERS[c][1]) for c in reversed(range(5))]
    # rząd 2: zewnętrzny lewy (20), 5 + 5, zewnętrzny prawy (31)
    out.append(key(0, 2 + stag[0] + 0.35, "lk", r=10))
    out += [key(1 + c, 2 + stag[c], L_FINGERS[c]) for c in range(5)]
    out += [key(right_x(1 + c) - 1, 2 + stag[c], "r" + L_FINGERS[c][1]) for c in reversed(range(5))]
    out.append(key(14, 2 + stag[0] + 0.35, "rk", r=-10))
    # kciuki: 3 na stronę, wachlarz
    thumbs = [(3.55, 3.45, 8), (4.65, 3.65, 16), (5.75, 4.0, 24)]
    out += [key(x, y, "lt", r=r) for x, y, r in thumbs]
    out += [key(right_x(x) - 1, y, "rt", r=-r) for x, y, r in reversed(thumbs)]
    save("totem", out)


redox(); corne(); totem()
