import { generateLargeGraph } from '../helpers';
import * as glob from 'glob';
import * as path from 'path';
import { createFromJSON } from '../../src';

describe('pkgPathsToRoot limit', () => {
  const range = Array(10)
    .fill(1)
    .map((_, i) => i + 1);

  describe('generated graph', () => {
    const pkg = {
      name: 'some-name',
      version: '1.2.3',
    };
    const graph = generateLargeGraph(10, pkg.name);

    it.each(range)('pkgPathsToRoot() with %s limit', (limit) => {
      const result = graph.pkgPathsToRoot(pkg, limit);
      expect(result).toHaveLength(limit);
    });
  });

  describe('fixtures', () => {
    const fixturesPath = path.resolve(__dirname, '../fixtures');
    const testCases = glob
      .sync(path.resolve(fixturesPath, '*-graph.json'))
      .map((fullPath) => path.relative(fixturesPath, fullPath));

    describe.each(testCases)('%s', (fixturePath) => {
      const fullFixturePath = path.resolve(fixturesPath, fixturePath);
      const depGraphJson = require(fullFixturePath);
      const depGraph = createFromJSON(depGraphJson);

      describe.each(depGraph.getPkgs())('%o', (pkg) => {
        it.each(range)('pkgPathsToRoot() with %s limit', (limit) => {
          const result = depGraph.pkgPathsToRoot(pkg, limit);
          expect(result.length).toBeLessThanOrEqual(limit);
          expect(result.length).toMatchSnapshot();
        });
      });
    });
  });
});
