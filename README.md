# PokéRole Combat HUD

A Pokémon-themed Combat HUD overlay for [FoundryVTT v13](https://foundryvtt.com/), designed for the [PokéRole 2.0 system](https://github.com/RiccardoMont1/Pok-Role-Module) (`pok-role-system`).

Replaces the default combat interface with the classic Pokémon battle menu featuring four familiar buttons: **Battle**, **Pokémon**, **Bag**, and **Run**.

![FoundryVTT v13](https://img.shields.io/badge/FoundryVTT-v13.351-green)
![System](https://img.shields.io/badge/System-pok--role--system-red)
![Version](https://img.shields.io/badge/Version-3.2.4-blue)

---

## Features

### Battle
Select and use your Pokémon's moves directly from the HUD. Each move displays:
- Type with color-coded background (Fire, Water, Grass, etc.)
- Category icon (Physical / Special / Status)
- Power, accuracy dice pool, and Will cost
- Moves are grayed out if you don't have enough Will to use them

### Pokémon
View your full party at a glance and switch your active Pokémon mid-battle:
- HP bar with color indicator (green/yellow/red)
- Type badges
- Active status conditions (Burn, Paralyzed, Frozen, etc.)
- Fainted Pokémon are marked and cannot be switched in
- Switching posts a message to chat automatically

### Bag
Use items from your Trainer's inventory during combat:
- Items grouped by pocket (Medicine, Poké Balls, Items, Held Items, Key Items)
- Shows quantity remaining and a short effect summary
- Supports healing, status cure, and revive items
- Consumable items are decremented automatically after use

### Run
Attempt to flee from wild Pokémon encounters:
- Rolls 1d6 — success on 4+ (shown in chat with the roll)
- Trainer battles block fleeing with a warning message
- On success, the combatant is removed and the HUD closes
- If no player combatants remain, combat ends automatically

### Portrait Bar
The HUD displays your active Pokémon's info at the top:
- Name, portrait, and species
- Animated HP and Will bars with percentage
- Type badges with official colors
- Active condition icons

---

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| **Enable Combat HUD** | Show/hide the HUD during combat | Enabled |
| **HUD Position** | Screen position: bottom-left or bottom-center | bottom-left |
| **HUD Scale** | Resize the HUD (0.5x to 1.5x) | 1.0 |

**Keybinding:** Press `Shift + P` to toggle the HUD on/off.

---

## Installation

### Manifest URL (recommended)

1. In FoundryVTT, go to **Add-on Modules** > **Install Module**
2. Paste the manifest URL:
   ```
   https://raw.githubusercontent.com/LinguardEvergreen/pok-role-combat-hud/main/module.json
   ```
3. Click **Install**
4. Enable the module in your world's **Module Management**

### Manual

1. Download or clone this repository
2. Place the folder in your Foundry `Data/modules/` directory as `pok-role-combat-hud`
3. Restart FoundryVTT and enable the module

---

## Requirements

- **FoundryVTT** v13 (verified on Build 351)
- **PokéRole System** (`pok-role-system`) v0.12.1+

This module is designed exclusively for the `pok-role-system`. It reads Pokémon actor data (types, resources, conditions, moves) and Trainer actor data (inventory, party) using that system's data model.

---

## Languages

- English
- Italiano

---

## License

This project is open source. Pokémon is a trademark of Nintendo / Game Freak / The Pokémon Company. This module is a fan-made project and is not affiliated with or endorsed by any of these companies.
