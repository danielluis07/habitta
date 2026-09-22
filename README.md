# Habitta

Habitta is a fictional architecture studio. This site is its portfolio of imagined residential concepts: three buildings, Crest, Contour and Grove, each with one featured residence, in a single district above the clouds.

- Domain terms: [`CONTEXT.md`](CONTEXT.md)
- Visual system: [`DESIGN.md`](DESIGN.md)
- Runtime models, export contract and budgets: [`docs/runtime-assets.md`](docs/runtime-assets.md)
- District scene, journey boundary and verification: [`docs/district-scene.md`](docs/district-scene.md)
- Product spec: [#12](https://github.com/danielluis07/habitta/issues/12)

## Development

The project runs on [Bun](https://bun.sh) and Next.js.

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tests

```bash
bun run test
```

This runs Bun's test runner with Testing Library in a happy-dom environment (configured in `bunfig.toml`). The journey tests in `tests/` render the real page in simple view, with the 3D scene swapped out at its lazy, client-only module boundary (`components/district-scene/scene.tsx`).

Concept content lives in one typed module, `lib/collection.ts`.

Runtime models live in `public/models/`. Check all GLBs, scene bindings and asset budgets with `bun run models:validate`; this also runs before `bun run build`. `bun run models:generate` regenerates the four development placeholders and overwrites those files. See the [asset contract](docs/runtime-assets.md) before replacing them with final exports.
