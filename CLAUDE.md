# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:8080 (hot reload)
npm run build     # Type-check with tsc then bundle with Vite into dist/
npm run preview   # Serve the dist/ build locally
npx tsc --noEmit  # Type-check only, no output
```

There are no tests or linters configured.

## Architecture

This is a single-file Phaser 3 game written in TypeScript, bundled by Vite.

**Entry point:** `index.html` loads `src/game.ts` as an ES module. At the bottom of `game.ts`, a `Phaser.Game` config is defined and instantiated directly — there is no separate main/entry file.

**Game structure:** All logic lives in one class, `GameScene extends Phaser.Scene`, in `src/game.ts`. There is only one scene. The Phaser lifecycle follows the standard `preload → create → update` loop.

**World vs. camera:** The game world is 3200×2400 px. The camera follows the player with a deadzone (`Zelda-style` scrolling). All game-world objects use world coordinates; UI elements (hearts, D-pad, action buttons) use `setScrollFactor(0)` to pin them to the viewport.

**Physics:** Arcade physics with zero gravity. The player and villain are `Phaser.Physics.Arcade.Image` objects. House collision zones are static `Zone` objects added via `physics.add.existing(zone, true)`.

**Rendering:** All visual elements (houses, villain, UI buttons) are drawn with `Phaser.GameObjects.Graphics`. The villain texture is generated programmatically into the texture cache via `gfx.generateTexture('villain', w, h)` during `create()`.

**Key state on GameScene:**
- `player` / `villain` — arcade physics images
- `dpad` — `{ up, down, left, right: boolean }` set by touch buttons
- `interiorElements` — array of objects shown in the house-interior overlay, `null` when closed; player movement is frozen while non-null
- `houseZones` / `houseDoors` / `houseDoorButtons` / `houseDoorGraphics` — parallel arrays indexed by house number (0–9)
- `playerHealth` / `villainHealth` — each point = one full heart; 0.5 increments for half-hearts

**Mobile support:** The game targets mobile-first with a D-pad and action buttons rendered in-scene. Safe-area insets (`env(safe-area-inset-*)`) are read at `create()` time and stored on the scene for UI placement. Multi-touch is enabled via `this.input.addPointer(3)`.

**Assets:** Static files in `assets/` are served by Vite as-is. The only asset currently is `assets/images/main-character.png` (the player sprite).
