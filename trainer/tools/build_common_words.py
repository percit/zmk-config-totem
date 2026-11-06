#!/usr/bin/env python3
"""Generuje js/words_common.js — popularne słowa PL i EN (do publicznego repo).

Źródło: hermitdave/FrequencyWords (napisy OpenSubtitles 2018), licencja CC BY-SA 4.0.
Pobierz pliki i podaj katalog:
    curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/pl/pl_50k.txt
    curl -O https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt
    python3 tools/build_common_words.py <katalog z plikami>

Filtr: tylko litery, słownik macOS (tools/spell.swift) usuwa śmieci i imiona,
polskie słowa bez polskich znaków (Marcin ich nie używa).
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "js" / "words_common.js"
TAKE, TOP = 6000, 3000
DEACC = str.maketrans("ąćęłńóśźż", "acelnoszz")
ONE = {"pl": {"a", "i", "o", "u", "w", "z"}, "en": {"a", "i"}}


def spell(words, lang):
    res = subprocess.run(["swift", str(ROOT / "tools" / "spell.swift"), lang],
                         input="\n".join(words), capture_output=True, text=True, check=True)
    return set(res.stdout.split())


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else sys.exit(__doc__)
    data = {}
    for lang in ("pl", "en"):
        words = []
        for line in (src / f"{lang}_50k.txt").read_text().splitlines()[:TAKE]:
            w = line.split(" ")[0].lower()
            if re.fullmatch(r"[a-ząćęłńóśźż]+", w) and (len(w) > 1 or w in ONE[lang]):
                words.append(w)
        ok = spell(words, lang)
        out, seen = [], set()
        for w in words:
            if w not in ok:
                continue
            w = w.translate(DEACC)
            if lang == "en" and not re.fullmatch(r"[a-z]+", w):
                continue
            if w not in seen:
                seen.add(w); out.append(w)
        data[lang] = out[:TOP]
        print(f"{lang}: {len(data[lang])}; {' '.join(out[:30])}")
    OUT.write_text(
        "// Wygenerowane przez tools/build_common_words.py — nie zmieniaj ręcznie.\n"
        "// Źródło: github.com/hermitdave/FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0.\n"
        "// Ten plik też jest na licencji CC BY-SA 4.0.\n"
        "window.WORDS_COMMON = " + json.dumps(data, ensure_ascii=False) + ";\n")
    print(f"OK: {OUT}")


if __name__ == "__main__":
    main()
