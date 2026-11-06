# ZMK — configi klawiatur

Configi ZMK dla moich klawiatur. **Jedna gałąź = jedna klawiatura.** Każda gałąź buduje tylko swój firmware (GitHub Actions).

| Gałąź | Klawiatura | Kontroler | Keymapa |
|---|---|---|---|
| [`totem`](../../tree/totem) | Totem (38 klawiszy) | Seeed XIAO BLE | `config/totem.keymap` |
| [`redox`](../../tree/redox) | Redox (70 klawiszy) | nice!nano v2 | `config/redox.keymap` |
| `corne` | Corne 3x6 (później) | — | szkic: `trainer/keymaps/corne.keymap` |

Na `master` nie ma firmware. Jest tu tylko ten opis i trener pisania.

## Trener pisania

Folder [`trainer/`](trainer). Otwórz `trainer/index.html` w przeglądarce.
Przełącznik Redox / Totem / Corne. Każda klawiatura ma osobny postęp.
Po zmianie keymapy na dowolnej gałęzi uruchom `trainer/tools/export_all.sh` i zrób commit na `master`.
Szczegóły: [`trainer/README.md`](trainer/README.md).

## Nowa klawiatura

1. Zrób gałąź od `totem` albo `redox`.
2. Zmień `build.yaml` i keymapę.
3. Dopisz klawiaturę do tabeli wyżej.
