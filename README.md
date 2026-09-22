# Habitta

Habitta is a fictional architecture studio. This site is its portfolio of imagined residential concepts: three buildings, Crest, Contour and Grove, each with one featured residence, in a single district above the clouds.

- Domain terms: [`CONTEXT.md`](CONTEXT.md)
- Visual system: [`DESIGN.md`](DESIGN.md)
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
