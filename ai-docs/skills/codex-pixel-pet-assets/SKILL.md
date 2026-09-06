---
name: codex-pixel-pet-assets
description: Create and integrate original pixel pet artwork for AI Pixel Office while preserving the existing catalog concepts, renderer contract, and local asset boundaries.
---

# Codex Pixel Pet Assets

Use this skill when creating new pet artwork, converting the procedural catalog to image assets, or preparing a custom pet pack.

## Project context

- `packages/pet/src/catalog.ts` is the source of truth for the built-in pet identities, species, palettes, patterns, and accessories
- The current procedural renderer uses a 16x16 logical pixel layout and should remain available as a fallback during migration
- Pixi renders the office scene; renderer changes must preserve the existing pet state and anchor behavior
- A generated concept sheet is a visual reference, not a production sprite sheet

## Asset strategy

Prefer one finished spritesheet and manifest per pet for fixed catalog characters:

```text
assets/pets/<pet-id>/
  manifest.json
  spritesheet.png
  preview.png
```

Use layered PNG parts only when the user explicitly wants an in-app combinator that assembles body, face, clothing, or accessories. Do not introduce a layer system solely to add a fixed catalog character.

Keep `procedural`, `spritesheet`, and future `layered` assets behind a renderer boundary. Missing or invalid image assets must fall back to the procedural renderer instead of preventing the office from loading.

## Generation workflow

1. Read the matching `PetDesign` entries and preserve their species, palette, pattern, and accessory concept
2. Establish one visual reference character and lock the pixel scale, outline, baseline, and palette before generating the catalog
3. Generate concept art first; do not treat a multi-character concept sheet as final animation art
4. Generate or prepare individual transparent frames with a shared cell size and anchor
5. Pack frames into a spritesheet and write a manifest mapping `idle`, `working`, `review`, and `failed` states to frame indices
6. Validate dimensions, transparency, frame bounds, file size, and fallback behavior
7. Update the pet gallery preview before wiring the asset into the office renderer

When preserving the existing UI silhouette is the priority, use [`scripts/bake-procedural-pets.mjs`](./scripts/bake-procedural-pets.mjs). It opens the gallery, invokes the same `plotPet()` renderer used by `PetPreview`, and writes 54×54 transparent PNGs to the package and web public asset folders. This keeps image-backed views visually aligned while retaining the procedural renderer as a fallback.

## Image generation constraints

- Request genuinely transparent backgrounds and preserve alpha
- Use hard-edged pixel art, no anti-aliasing, no gradients, and a limited palette
- Keep every frame on the same baseline and within the same logical cell
- Generate one distinct character or state at a time when production consistency matters
- Use a concept sheet for review only; it commonly has spacing, background, and frame consistency issues
- Do not add text, labels, logos, or watermarks to game assets

## Manifest contract

At minimum, record the asset path, logical frame size, render scale, anchor, and state frame lists. Keep manifest parsing separate from image loading so malformed user packs can be rejected safely.

```json
{
  "id": "pet-id",
  "displayName": "표시 이름",
  "sprite": "spritesheet.png",
  "frameWidth": 16,
  "frameHeight": 16,
  "scale": 3,
  "anchor": { "x": 8, "y": 15 },
  "animations": {
    "idle": { "frames": [0], "fps": 1 },
    "working": { "frames": [1, 2], "fps": 4 },
    "review": { "frames": [3], "fps": 1 },
    "failed": { "frames": [4], "fps": 1 }
  }
}
```

## Verification

- Compare each generated character with its `PetDesign` entry
- Confirm all frames share cell size, baseline, anchor, and nearest-neighbor rendering
- Preview transparent pixels against both light and dark backgrounds
- Keep the gallery preview and renderer fallback working when an asset is missing
- Run the smallest relevant package typecheck and gallery or renderer smoke check

Do not delete the procedural renderer or rewrite the full catalog during an asset experiment. Make one reference pet work end to end before migrating the rest.
