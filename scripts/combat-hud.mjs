/**
 * PokéRole Combat HUD - Main HUD Application
 * Two-mode HUD: Pokémon tokens show portrait+moves, Trainer tokens show portrait+action buttons.
 */

import { MODULE_ID, TYPE_COLORS, getHpColorClass, getHpPercent, getTrainerForActor, getTrainerParty, isCurrentUserTurn, CONDITION_ICONS, RANK_LABELS } from "./helpers.mjs";
import { BattlePanel } from "./panels/battle-panel.mjs";
import { PokemonPanel } from "./panels/pokemon-panel.mjs";
import { BagPanel } from "./panels/bag-panel.mjs";
import { RunPanel } from "./panels/run-panel.mjs";
import { MegaPanel } from "./panels/mega-panel.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

export class CombatHUD extends HandlebarsApplicationMixin(ApplicationV2) {

  /** Currently open sub-panel (trainer only): "pokemon" | "bag" | null */
  #activePanel = null;

  /** Sub-panel handlers */
  #battlePanel = new BattlePanel(this);
  #pokemonPanel = new PokemonPanel(this);
  #bagPanel = new BagPanel(this);
  #runPanel = new RunPanel(this);
  #megaPanel = new MegaPanel(this);

  /* ---------------------------------------- */
  /*  Application Configuration               */
  /* ---------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: "poke-combat-hud",
    classes: ["poke-combat-hud"],
    tag: "section",
    position: {
      width: "auto",
      height: "auto"
    },
    window: {
      frame: false,
      positioned: false
    }
  };

  static PARTS = {
    hud: {
      template: `modules/${MODULE_ID}/templates/combat-hud.hbs`
    }
  };

  /* ---------------------------------------- */
  /*  Getters                                  */
  /* ---------------------------------------- */

  get activePanel() {
    return this.#activePanel;
  }

  get megaPanel() {
    return this.#megaPanel;
  }

  /**
   * Get the active actor based on the selected token.
   * Always uses the currently selected token, both in and out of combat.
   * @returns {Actor|null}
   */
  get activeActor() {
    // Always use the selected token's actor
    const controlled = canvas.tokens?.controlled;
    if (controlled?.length === 1) {
      return controlled[0].actor ?? null;
    }
    // Fallback: if in combat and no token selected, use the active combatant
    if (game.combat?.combatant?.actor) {
      return game.combat.combatant.actor;
    }
    return null;
  }

  /**
   * Determine the HUD type based on the active actor.
   * @returns {"pokemon"|"trainer"|null}
   */
  get hudType() {
    const actor = this.activeActor;
    if (!actor) return null;
    return actor.type === "pokemon" ? "pokemon" : actor.type === "trainer" ? "trainer" : null;
  }

  /**
   * Get the active Pokémon (the combatant itself if it's a Pokémon,
   * or the first Pokémon in the trainer's party).
   * @returns {Actor|null}
   */
  get activePokemon() {
    const actor = this.activeActor;
    if (!actor) return null;
    if (actor.type === "pokemon") return actor;
    // If it's a trainer, try to find their active Pokémon in combat
    const party = getTrainerParty(actor);
    const inCombat = party.find(p =>
      game.combat?.combatants.some(c => c.actor?.id === p.id)
    );
    return inCombat ?? party[0] ?? null;
  }

  /**
   * Get the Trainer actor.
   * @returns {Actor|null}
   */
  get trainer() {
    return getTrainerForActor(this.activeActor);
  }

  /* ---------------------------------------- */
  /*  Data Preparation                         */
  /* ---------------------------------------- */

  async _prepareContext(options) {
    const actor = this.activeActor;
    const hudType = this.hudType;
    const isMyTurn = isCurrentUserTurn();

    // HUD settings
    const position = game.settings.get(MODULE_ID, "hudPosition");
    const scale = game.settings.get(MODULE_ID, "hudScale");

    const inCombat = !!game.combat;

    const context = {
      hudType,
      isMyTurn,
      inCombat,
      position,
      scale,
      MODULE_ID
    };

    if (hudType === "pokemon") {
      // Pokémon HUD: portrait + moves
      context.pokemon = this.#preparePokemonData(actor);
      context.moves = this.#battlePanel.getMoves(actor);
    } else if (hudType === "trainer") {
      // Trainer HUD: portrait + action buttons + sub-panels
      context.trainerData = this.#prepareTrainerData(actor);
      context.activePanel = this.#activePanel;

      // Sub-panel data
      if (this.#activePanel === "pokemon") {
        const pokemon = this.activePokemon;
        context.party = this.#pokemonPanel.getParty(actor, pokemon);
      } else if (this.#activePanel === "bag") {
        context.bag = this.#bagPanel.getBagItems(actor);
      }
    }

    return context;
  }

  /**
   * Prepare Pokémon portrait data.
   * @param {Actor} pokemon
   * @returns {object}
   */
  #preparePokemonData(pokemon) {
    const hp = pokemon.system.resources?.hp ?? { value: 0, max: 0 };
    const will = pokemon.system.resources?.will ?? { value: 0, max: 0 };
    const types = pokemon.system.types ?? {};
    const conditions = pokemon.system.conditions ?? {};

    // Mega Evolution data
    const trainer = this.trainer;
    const megaData = this.#megaPanel.getMegaData(pokemon, trainer);
    const isMegaEvolved = this.#megaPanel.isMegaEvolved(pokemon);

    return {
      name: pokemon.name,
      img: pokemon.img,
      species: pokemon.system.species ?? "",
      hp,
      will,
      hpPercent: getHpPercent(hp.value, hp.max),
      willPercent: getHpPercent(will.value, will.max),
      hpColor: getHpColorClass(hp.value, hp.max),
      primaryType: types.primary ?? "normal",
      secondaryType: types.secondary !== "none" ? types.secondary : null,
      primaryTypeColor: TYPE_COLORS[types.primary]?.bg ?? TYPE_COLORS.normal.bg,
      secondaryTypeColor: types.secondary && types.secondary !== "none" ? TYPE_COLORS[types.secondary]?.bg : null,
      conditions: this.#getActiveConditions(conditions),
      isFainted: conditions.fainted ?? false,
      canMegaEvolve: !!megaData,
      isMegaEvolved
    };
  }

  /**
   * Prepare Trainer portrait data.
   * @param {Actor} trainer
   * @returns {object}
   */
  #prepareTrainerData(trainer) {
    const hp = trainer.system.resources?.hp ?? { value: 0, max: 0 };
    const will = trainer.system.resources?.will ?? { value: 0, max: 0 };
    const conditions = trainer.system.conditions ?? {};
    const rank = trainer.system.cardRank ?? "starter";

    const inFray = typeof trainer.isTrainerInFray === "function" ? trainer.isTrainerInFray() : false;

    return {
      name: trainer.name,
      img: trainer.img,
      hp,
      will,
      hpPercent: getHpPercent(hp.value, hp.max),
      willPercent: getHpPercent(will.value, will.max),
      hpColor: getHpColorClass(hp.value, hp.max),
      rank,
      rankLabel: game.i18n.localize(RANK_LABELS[rank] ?? RANK_LABELS.starter),
      conditions: this.#getActiveConditions(conditions),
      inFray
    };
  }

  /**
   * Get active conditions as an array.
   * @param {object} conditions
   * @returns {object[]}
   */
  #getActiveConditions(conditions) {
    const active = [];
    for (const [key, isActive] of Object.entries(conditions)) {
      if (isActive) {
        active.push({
          key,
          icon: CONDITION_ICONS[key] ?? "\u2753",
          label: game.i18n.localize(`POKEHUD.Condition.${key.charAt(0).toUpperCase() + key.slice(1)}`)
        });
      }
    }
    return active;
  }

  /* ---------------------------------------- */
  /*  Rendering                                */
  /* ---------------------------------------- */

  _onRender(context, options) {
    const html = this.element;
    if (!html) return;

    // Apply position class
    const position = game.settings.get(MODULE_ID, "hudPosition");
    html.classList.remove("bottom-right", "bottom-left", "bottom-center");
    html.classList.add(position);

    // Apply scale
    const scale = game.settings.get(MODULE_ID, "hudScale");
    html.style.setProperty("--hud-scale", scale);

    // Bind events
    this.#bindEvents(html);
  }

  /* ---------------------------------------- */
  /*  Event Binding                            */
  /* ---------------------------------------- */

  #bindEvents(html) {
    // === Pokémon HUD: Move buttons ===
    html.querySelectorAll('[data-action="use-move"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.#battlePanel.useMove(btn.dataset.moveId);
      });
    });

    // === Trainer HUD: Menu buttons ===
    html.querySelector('[data-action="pokemon"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#togglePanel("pokemon");
    });

    html.querySelector('[data-action="bag"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#togglePanel("bag");
    });

    html.querySelector('[data-action="take-cover"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#onTakeCover();
    });

    html.querySelector('[data-action="enter-melee"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#onEnterMelee();
    });

    html.querySelector('[data-action="run"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#runPanel.onRun();
    });

    // === Trainer sub-panels ===
    html.querySelectorAll('[data-action="switch-pokemon"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.#pokemonPanel.switchPokemon(btn.dataset.actorId);
      });
    });

    html.querySelectorAll('[data-action="use-item"]').forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.#bagPanel.useItem(btn.dataset.itemId);
      });
    });

    // Close panel button
    html.querySelector('[data-action="close-panel"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#closePanel();
    });

    // Refresh HUD button
    html.querySelector('[data-action="refresh-hud"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.refresh();
    });

    // Reset Actions button
    html.querySelector('[data-action="reset-actions"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#onResetActions();
    });

    // Combined Roll button
    html.querySelector('[data-action="combined-roll"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#onCombinedRoll();
    });

    // Mega Evolution button
    html.querySelector('[data-action="mega-evolve"]')?.addEventListener("click", (e) => {
      e.preventDefault();
      this.#onMegaEvolve();
    });
  }

  /* ---------------------------------------- */
  /*  Trainer Actions                          */
  /* ---------------------------------------- */

  /**
   * "Cerca Copertura" - Take Cover action.
   * Delegates to the system's trainerSearchForCover() method.
   * Rolls (Insight + Alert)d6 success pool, on success sets cover to "full".
   */
  async #onTakeCover() {
    const trainer = this.activeActor;
    if (!trainer || trainer.type !== "trainer") return;

    try {
      if (typeof trainer.trainerSearchForCover === "function") {
        await trainer.trainerSearchForCover();
      } else {
        ui.notifications.warn("POKEHUD.Error.SystemMethodNotFound");
      }
    } catch (err) {
      console.error("pok-role-combat-hud | Error in Take Cover:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ActionFailed"));
    }
  }

  /**
   * "Entra in Mischia" / "Esci dalla Mischia" - Toggle Fray action.
   * Delegates to the system's trainerEnterFray() which toggles fray state,
   * manages combatant, and rolls initiative.
   */
  async #onEnterMelee() {
    const trainer = this.activeActor;
    if (!trainer || trainer.type !== "trainer") return;

    try {
      if (typeof trainer.trainerEnterFray === "function") {
        const wasInFray = typeof trainer.isTrainerInFray === "function" && trainer.isTrainerInFray();
        await trainer.trainerEnterFray();

        // If trainer left the fray, remove from turn order
        if (wasInFray && game.combat) {
          const combatant = game.combat.combatants.find(c => c.actor?.id === trainer.id);
          if (combatant) {
            await combatant.delete();
          }
        }

        this.refresh();
      } else {
        ui.notifications.warn("POKEHUD.Error.SystemMethodNotFound");
      }
    } catch (err) {
      console.error("pok-role-combat-hud | Error in Toggle Fray:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ActionFailed"));
    }
  }

  /**
   * "Tiro Combinato" - Combined Roll action.
   * Delegates to the system's rollCombinedDialog() method.
   */
  async #onCombinedRoll() {
    const actor = this.activeActor;
    if (!actor) return;

    try {
      if (typeof actor.rollCombinedDialog === "function") {
        await actor.rollCombinedDialog();
      } else {
        ui.notifications.warn(game.i18n.localize("POKEHUD.Error.SystemMethodNotFound"));
      }
    } catch (err) {
      console.error("pok-role-combat-hud | Error in Combined Roll:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ActionFailed"));
    }
  }

  /**
   * Reset action counter for the active Pokémon.
   * Calls the system's resetActionCounter() method.
   */
  async #onResetActions() {
    const actor = this.activeActor;
    if (!actor || actor.type !== "pokemon") return;

    try {
      if (typeof actor.resetActionCounter === "function") {
        await actor.resetActionCounter();
        ui.notifications.info(game.i18n.format("POKEHUD.Menu.ResetActionsNotify", { name: actor.name }));
        this.refresh();
      } else {
        ui.notifications.warn(game.i18n.localize("POKEHUD.Error.SystemMethodNotFound"));
      }
    } catch (err) {
      console.error("pok-role-combat-hud | Error resetting actions:", err);
      ui.notifications.error(game.i18n.localize("POKEHUD.Error.ActionFailed"));
    }
  }

  /**
   * Mega Evolution for the active Pokémon.
   */
  async #onMegaEvolve() {
    const pokemon = this.activePokemon;
    const trainer = this.trainer;
    if (!pokemon || !trainer) return;
    await this.#megaPanel.megaEvolve(pokemon, trainer);
  }

  /* ---------------------------------------- */
  /*  Panel Management                         */
  /* ---------------------------------------- */

  #togglePanel(panelName) {
    if (this.#activePanel === panelName) {
      this.#closePanel();
    } else {
      this.#activePanel = panelName;
      this.render();
    }
  }

  #closePanel() {
    this.#activePanel = null;
    this.render();
  }

  /* ---------------------------------------- */
  /*  Public API                               */
  /* ---------------------------------------- */

  async showHUD() {
    if (!game.settings.get(MODULE_ID, "enableHud")) return;
    this.#activePanel = null;
    await this.render({ force: true });

    const uiTop = document.getElementById("ui-bottom") ?? document.body;
    if (this.element && !uiTop.contains(this.element)) {
      uiTop.appendChild(this.element);
    }

    document.body.classList.add("poke-hud-active");
  }

  hideHUD() {
    this.#activePanel = null;
    document.body.classList.remove("poke-hud-active");
    this.close();
  }

  toggle() {
    if (this.rendered) {
      this.hideHUD();
    } else {
      this.showHUD();
    }
  }

  refresh() {
    if (this.rendered) {
      this.render();
    }
  }
}
