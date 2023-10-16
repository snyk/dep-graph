import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('countPathsToRoot', () => {
  describe('basic', () => {
    const depGraphData = helpers.loadFixture('plain-dep-graph.json');
    const depGraph = depGraphLib.createFromJSON(depGraphData);

    it('returns expected path counts for all packages', () => {
      const counts: Record<string, number> = {};
      for (const pkg of depGraph.getPkgs()) {
        counts[`${pkg.name}@${pkg.version}`] = depGraph.countPathsToRoot(pkg);
      }
      expect(counts).toEqual({
        'root@0.0.0': 1,
        'e@5.0.0': 7,
        'd@0.0.1': 1,
        'c@1.0.0': 2,
        'a@1.0.0': 1,
        'd@0.0.2': 2,
        'b@1.0.0': 1,
        'i@2.1.0': 4,
        'h@0.0.1': 3,
        'g@1.0.0': 2,
        'f@1.0.0': 1,
      });
    });

    it('returns limited path counts for all packages', () => {
      const counts: Record<string, number> = {};
      for (const pkg of depGraph.getPkgs()) {
        counts[`${pkg.name}@${pkg.version}`] = depGraph.countPathsToRoot(pkg, {
          limit: 2,
        });
      }
      expect(counts).toEqual({
        'root@0.0.0': 1,
        'e@5.0.0': 2,
        'd@0.0.1': 1,
        'c@1.0.0': 2,
        'a@1.0.0': 1,
        'd@0.0.2': 2,
        'b@1.0.0': 1,
        'i@2.1.0': 2,
        'h@0.0.1': 2,
        'g@1.0.0': 2,
        'f@1.0.0': 1,
      });
    });
  });

  describe('large', () => {
    const depGraphData = helpers.loadFixture('goof-graph.json');

    it('returns expected path counts for all packages', () => {
      const depGraph = depGraphLib.createFromJSON(depGraphData);
      const counts: Record<string, number> = {};
      for (const pkg of depGraph.getPkgs()) {
        counts[`${pkg.name}@${pkg.version}`] = depGraph.countPathsToRoot(pkg);
      }
      expect(counts).toMatchSnapshot();
    });

    it('returns limited path counts for all packages', () => {
      const depGraph = depGraphLib.createFromJSON(depGraphData);
      for (const pkg of depGraph.getPkgs()) {
        expect(
          depGraph.countPathsToRoot(pkg, { limit: 2 }),
        ).toBeLessThanOrEqual(2);
      }
    });

    it('returns identical limited paths counts with and without internal cache', () => {
      // One: run with a limit on a fresh dep-graph
      const depGraph = depGraphLib.createFromJSON(depGraphData);
      const countsWithoutCache: Record<string, number> = {};
      for (const pkg of depGraph.getPkgs()) {
        countsWithoutCache[`${pkg.name}@${pkg.version}`] =
          depGraph.countPathsToRoot(pkg, { limit: 2 });
      }

      // Two: run without a limit on a new dep-graph
      const depGraphB = depGraphLib.createFromJSON(depGraphData);
      for (const pkg of depGraphB.getPkgs()) {
        depGraphB.countPathsToRoot(pkg);
      }

      // Three: Use that same dep-graph instance to run with a limit
      const countsWithCache: Record<string, number> = {};
      for (const pkg of depGraphB.getPkgs()) {
        countsWithCache[`${pkg.name}@${pkg.version}`] =
          depGraphB.countPathsToRoot(pkg, { limit: 2 });
      }
      expect(countsWithCache).toEqual(countsWithoutCache);
    });
  });

  describe('cycles', () => {
    const depGraphData = helpers.loadFixture('cyclic-complex-dep-graph.json');
    const depGraph = depGraphLib.createFromJSON(depGraphData);

    it('returns 1 for the root node', () => {
      expect(depGraph.countPathsToRoot(depGraph.rootPkg)).toBe(1);
    });

    it.each`
      name   | version | expected
      ${'a'} | ${'1'}  | ${1}
      ${'b'} | ${'2'}  | ${1}
      ${'c'} | ${'3'}  | ${1}
      ${'d'} | ${'4'}  | ${1}
      ${'e'} | ${'5'}  | ${3}
      ${'f'} | ${'6'}  | ${3}
      ${'g'} | ${'7'}  | ${3}
    `('returns $expected for $name@$version', ({ name, version, expected }) => {
      expect(depGraph.countPathsToRoot({ name, version })).toBe(expected);
    });

    it.each(depGraph.getPkgs())(`equals pkgPathsToRoot(%s).length`, (pkg) => {
      expect(depGraph.countPathsToRoot(pkg)).toBe(
        depGraph.pkgPathsToRoot(pkg).length,
      );
    });
  });
});
