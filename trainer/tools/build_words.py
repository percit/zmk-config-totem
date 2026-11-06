#!/usr/bin/env python3
"""Generuje js/words.js (listy słów PL i EN) z własnych notatek .md.

Użycie (z katalogu redox-trainer):
    python3 tools/build_words.py ~/Downloads/pixel/lifestyle-obsidian ~/github/Notatki

Kroki:
1. Zbierz słowa ze wszystkich plików .md.
2. Sprawdź każde słowo słownikiem macOS (tools/spell.swift) — po polsku i po angielsku.
   Polskie słowa zapisujemy BEZ polskich znaków (Marcin ich nie używa): „zdjęcie” → „zdjecie”.
   Słowo PL jest poprawne, gdy po zdjęciu ogonków pasuje do słowa ze słownika,
   albo gdy często występuje w polskich liniach (min. OFTEN razy) i nie jest angielskie.
3. Każdą linię przypisz do języka (więcej słów tylko-PL czy tylko-EN).
4. Policz słowa w liniach danego języka. Odrzuć nazwy własne (częściej z wielkiej litery)
   i rzadkie słowa (mniej niż MIN_COUNT wystąpień).
"""
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "js" / "words.js"
SPELL = ROOT / "tools" / "spell.swift"
MIN_COUNT = 3
TOP = 3000
WORD = re.compile(r"[A-Za-ząćęłńóśźżĄĆĘŁŃÓŚŹŻ]+")
PL_CHARS = set("ąćęłńóśźż")
DEACC = str.maketrans("ąćęłńóśźż", "acelnoszz")
OFTEN = 5
URL = re.compile(r"\S*(https?://|www\.)\S*|\S+\.(com|pl|org|io|png|jpg|md)\b\S*")


def spell(words, lang):
    res = subprocess.run(["swift", str(SPELL), lang], input="\n".join(words),
                         capture_output=True, text=True, check=True)
    return set(res.stdout.split())


def main():
    dirs = [Path(d).expanduser() for d in sys.argv[1:]]
    if not dirs:
        sys.exit(__doc__)
    lines = []
    for d in dirs:
        for f in d.rglob("*.md"):
            if any(p in (".git", "node_modules", ".obsidian") for p in f.parts):
                continue
            lines += [URL.sub(" ", l) for l in f.read_text(errors="ignore").splitlines()]

    lower_cnt, upper_cnt = Counter(), Counter()
    for line in lines:
        for w in WORD.findall(line):
            if len(w) > 15:
                continue
            (lower_cnt if w[0].islower() else upper_cnt)[w.lower()] += 1
    lower_cnt_d, upper_cnt_d = Counter(), Counter()
    for w, n in lower_cnt.items():
        if set(w) & PL_CHARS:
            lower_cnt_d[w.translate(DEACC)] += n
    for w, n in upper_cnt.items():
        if set(w) & PL_CHARS:
            upper_cnt_d[w.translate(DEACC)] += n
    vocab = sorted(w for w in set(lower_cnt) | set(upper_cnt) if 1 <= len(w))
    print(f"Linie: {len(lines)}, różne słowa: {len(vocab)}; sprawdzam słownikiem…")
    pl, en = spell(vocab, "pl"), spell(vocab, "en")
    pl_only, en_only = pl - en, en - pl

    pl_deacc = {w.translate(DEACC) for w in pl}
    counts = {"pl": Counter(), "en": Counter()}
    for line in lines:
        ws = [w.lower() for w in WORD.findall(line)]
        p = sum(w not in en and len(w) > 1 for w in ws)
        e = sum(w in en_only for w in ws)
        if p == e:
            continue
        if p > e:
            for w in ws:
                if w not in en_only:
                    counts["pl"][w.translate(DEACC)] += 1
        else:
            for w in ws:
                if w in en:
                    counts["en"][w] += 1

    data = {}
    for lang, c in counts.items():
        keep = [w for w, n in c.most_common()
                if n >= MIN_COUNT and lower_cnt[w] + lower_cnt_d[w] >= upper_cnt[w] + upper_cnt_d[w]
                and (lang == "en" or w in pl_deacc or (n >= OFTEN and len(w) <= 10))
                and (len(w) > 1 or w in ("a", "i", "w", "z", "o", "u"))]
        keep = [w for w in keep if not (set(w) & PL_CHARS)]
        data[lang] = keep[:TOP]
        print(f"{lang}: {len(data[lang])} słów; początek: {' '.join(data[lang][:25])}")

    OUT.write_text("// Wygenerowane przez tools/build_words.py z własnych notatek — nie zmieniaj ręcznie.\n"
                   "window.WORDS = " + json.dumps(data, ensure_ascii=False) + ";\n")
    print(f"OK: {OUT}")


if __name__ == "__main__":
    main()
