/**
 * PokéRole Combat HUD - Main Module Entry Point
 * A Pokémon-themed Combat HUD overlay for the PokéRole system in FoundryVTT v13.
 */

import { CombatHUD } from "./combat-hud.mjs";

const MODULE_ID = "pok-role-combat-hud";

/* ---------------------------------------- */
/*  Module Initialization                    */
/* ---------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing PokéRole Combat HUD`);

  // Register module settings
  game.settings.register(MODULE_ID, "enableHud", {
    name: game.i18n?.localize("POKEHUD.Settings.EnableHud") ?? "Enable Combat HUD",
    hint: game.i18n?.localize("POKEHUD.Settings.EnableHudHint") ?? "Show the Pokémon-style Combat HUD during encounters.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "hudPosition", {
    name: game.i18n?.localize("POKEHUD.Settings.HudPosition") ?? "HUD Position",
    hint: game.i18n?.localize("POKEHUD.Settings.HudPositionHint") ?? "Choose where the Combat HUD appears on screen.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      "bottom-right": "Bottom Right",
      "bottom-left": "Bottom Left",
      "bottom-center": "Bottom Center"
    },
    default: "bottom-right",
    onChange: () => {
      if (game.pokeCombatHUD?.rendered) game.pokeCombatHUD.render();
    }
  });

  game.settings.register(MODULE_ID, "hudScale", {
    name: game.i18n?.localize("POKEHUD.Settings.HudScale") ?? "HUD Scale",
    hint: game.i18n?.localize("POKEHUD.Settings.HudScaleHint") ?? "Adjust the size of the Combat HUD (0.5 - 1.5).",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0.5, max: 1.5, step: 0.1 },
    default: 1.0,
    onChange: () => {
      if (game.pokeCombatHUD?.rendered) game.pokeCombatHUD.render();
    }
  });

  // Register keybinding
  game.keybindings.register(MODULE_ID, "toggleHud", {
    name: "POKEHUD.Keybinding.ToggleHud",
    hint: "POKEHUD.Keybinding.ToggleHudHint",
    editable: [{ key: "KeyP", modifiers: ["Shift"] }],
    onDown: () => {
      if (game.pokeCombatHUD) {
        game.pokeCombatHUD.toggle();
      }
      return true;
    },
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

/* ---------------------------------------- */
/*  Ready Hook                               */
/* ---------------------------------------- */

Hooks.once("ready", () => {
  // Verify we're running with the correct system
  if (game.system.id !== "pok-role-system") {
    console.warn(`${MODULE_ID} | This module requires the pok-role-system. Current system: ${game.system.id}`);
    return;
  }

  console.log(`${MODULE_ID} | PokéRole Combat HUD ready`);

  // Create the HUD instance
  game.pokeCombatHUD = new CombatHUD();

  // If combat is already active, show HUD
  if (game.combat && game.settings.get(MODULE_ID, "enableHud")) {
    game.pokeCombatHUD.showHUD();
  }
});

/* ---------------------------------------- */
/*  Combat Lifecycle Hooks                   */
/* ---------------------------------------- */

// Show HUD when combat starts
Hooks.on("createCombat", (combat) => {
  if (!game.pokeCombatHUD || !game.settings.get(MODULE_ID, "enableHud")) return;
  game.pokeCombatHUD.showHUD();
});

// Refresh HUD when combat ends (don't hide - HUD works outside combat too)
Hooks.on("deleteCombat", (combat) => {
  if (!game.pokeCombatHUD?.rendered) return;
  game.pokeCombatHUD.refresh();
});

// Update HUD when combat state changes (turn/round advance)
Hooks.on("updateCombat", (combat, changed, options, userId) => {
  if (!game.pokeCombatHUD?.rendered) return;
  if ("turn" in changed || "round" in changed) {
    game.pokeCombatHUD.refresh();
  }
});

// Update HUD when an actor is updated (HP, Will, conditions change)
Hooks.on("updateActor", (actor, changed, options, userId) => {
  if (!game.pokeCombatHUD?.rendered) return;
  // Refresh if the updated actor is the one currently shown in the HUD
  const activeActor = game.pokeCombatHUD.activeActor;
  if (activeActor?.id === actor.id) {
    game.pokeCombatHUD.refresh();
  }
});

// Update HUD when items change on the active actor (moves added/removed)
Hooks.on("createItem", (item, options, userId) => {
  if (!game.pokeCombatHUD?.rendered) return;
  const activeActor = game.pokeCombatHUD.activeActor;
  if (activeActor?.id === item.parent?.id) {
    game.pokeCombatHUD.refresh();
  }
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (!game.pokeCombatHUD?.rendered) return;
  const activeActor = game.pokeCombatHUD.activeActor;
  if (activeActor?.id === item.parent?.id) {
    game.pokeCombatHUD.refresh();
  }
});

// Re-render HUD when canvas is ready (scene change)
Hooks.on("canvasReady", () => {
  if (!game.pokeCombatHUD) return;
  if (game.pokeCombatHUD.rendered) {
    game.pokeCombatHUD.refresh();
  }
});

// Refresh HUD when the selected token changes
Hooks.on("controlToken", (token, controlled) => {
  if (!game.pokeCombatHUD?.rendered) return;
  game.pokeCombatHUD.refresh();
});

/* ---------------------------------------- */
/*  Token Controls: Toggle HUD Button       */
/* ---------------------------------------- */

Hooks.on("getSceneControlButtons", (controls) => {
  if (game.system.id !== "pok-role-system") return;

  // FoundryVTT v13: controls is an object keyed by name, tools is also an object
  const tokenControls = controls.tokens;
  if (!tokenControls) return;

  tokenControls.tools.pokeCombatHud = {
    name: "pokeCombatHud",
    title: "POKEHUD.Keybinding.ToggleHud",
    icon: "fas fa-gamepad",
    order: Object.keys(tokenControls.tools).length,
    button: true,
    onChange: () => {
      if (game.pokeCombatHUD) {
        game.pokeCombatHUD.toggle();
      }
    },
    visible: true
  };
});
