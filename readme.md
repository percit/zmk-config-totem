# ZMK — Redox (gałąź `redox`)

Config ZMK dla Redoxa (Falbatech, nice!nano v2). Repo ma jedną gałąź na klawiaturę:
`totem`, `redox` (ta), później `corne`. Na `master` jest trener pisania i opis repo.

- Keymapa: `config/redox.keymap` (opis warstw w komentarzu na górze pliku).
- Shield `redox` pochodzi z ZMK, więc tu nie ma `config/boards`.

## Wgrywanie

1. Wypchnij zmiany na gałąź `redox`.
2. Na GitHubie otwórz Actions i pobierz `firmware.zip` z ostatniego buildu.
3. Podłącz lewą połówkę i naciśnij reset dwa razy. Pojawi się dysk `NICENANO`.
4. Przeciągnij `redox_left-nice_nano_v2-zmk.uf2` na dysk.
5. Powtórz dla prawej połówki z `redox_right-nice_nano_v2-zmk.uf2`.
