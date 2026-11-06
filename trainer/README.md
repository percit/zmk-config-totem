# Trener pisania — Redox / Totem / Corne

Trener pisania bezwzrokowego dla klawiatur ZMK: Redox, Totem i Corne (przełącznik u góry, osobny postęp dla każdej). Pomysł na podstawie
[adv360-tipptrainer](https://github.com/nonameneeded/adv360-tipptrainer). Kod jest napisany od nowa.

## Uruchom

Otwórz `index.html` w przeglądarce. Serwer nie jest potrzebny.

## Tryby

- **Nauka** — zaczynasz od 6 liter. Następna litera dochodzi, gdy wszystkie są „pewne”.
- **Słabe punkty** — znaki, przy których się mylisz najczęściej.
- **Zdania** — wielkie litery i interpunkcja.
- **Symbole** — fragmenty kodu (warstwa NAV i Shift).
- **Test 1 min** — wynik w znakach/min.
- **Skróty** — popularne skróty macOS i nawigacja w tekście (⌘C, ⌥←, ⇧⌘→…). Trener liczy, jak je nacisnąć
  na wybranej klawiaturze (warstwa + modyfikatory) i pokazuje skróty, których nie da się nacisnąć.

Pod klawiaturą są wszystkie warstwy (BASE, NAV, SYM, ADJ…) i kombinacje (np. Esc = Q+W).
`compare.html?a=redox&b=totem` — porównanie dwóch układów: ten sam kolor = ta sama funkcja.

## Odśwież dane

1. Po zmianie keymapy wygeneruj układy wszystkich klawiatur:
   `tools/export_all.sh`
   Skrypt czyta keymapy z gałęzi tego repo: Redox z `redox`, Totem z `totem`. Corne: `keymaps/corne.keymap` (szkic = Totem + zewnętrzne kolumny).
2. Po zmianie geometrii: `python3 tools/make_geometry.py` (Redox i Corne z QMK, Totem ręcznie).
3. Popularne słowa (w repo, CC BY-SA 4.0, FrequencyWords): `python3 tools/build_common_words.py <katalog>` — instrukcja w pliku.
4. Po nowych notatkach wygeneruj słowa (tylko macOS, używa słownika systemu):
   `python3 tools/build_words.py ~/Downloads/pixel/lifestyle-obsidian ~/github/Notatki`

Uwaga: `js/words.js` powstaje z prywatnych notatek, więc jest w `.gitignore`. Bez niego trener używa zmyślonych słów.

Geometria: `tools/geometry/` (QMK `keyboards/redox/rev1` i `keyboards/crkbd`).
