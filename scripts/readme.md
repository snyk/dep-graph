### Note

Scripts are written in TypeScript. To run them use `npx ts-node`.

Examples:

```bash
cat test/fixtures/goof-dep-tree.json | npx ts-node ./scripts/to-graph.ts npm
cat test/fixtures/goof-graph.json | npx ts-node ./scripts/to-tree.ts npm
```
