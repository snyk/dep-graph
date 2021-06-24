import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('cycles', () => {
  let depGraph;
  let toor;
  let foo;
  let bar;
  let baz;

  beforeEach(() => {
    const cyclicDepGraphData = helpers.loadFixture('cyclic-dep-graph.json');
    cyclicDepGraphData.graph.nodes
      .find((x) => x.nodeId === 'foo@2|x')
      .deps.push({ nodeId: 'baz@4|x' });
    depGraph = depGraphLib.createFromJSON(cyclicDepGraphData);
    [toor, foo, bar, baz] = depGraph.getPkgs();
  });

  test('pkgPathsToRoot - should work with cycles', () => {
    depGraph.getPkgs().forEach((pkg) => {
      const pkgPathsToRoot = depGraph.pkgPathsToRoot(pkg);

      expect(pkgPathsToRoot).toMatchSnapshot(`${pkg.name}@${pkg.version}`);
    });
  });

  describe('countPathsToRoot - should work with cycles', () => {
    it('toor', () => expect(depGraph.countPathsToRoot(toor)).toBe(1));
    it('foo', () => expect(depGraph.countPathsToRoot(foo)).toBe(1));
    it('bar', () => expect(depGraph.countPathsToRoot(bar)).toBe(1));
    it('baz', () => expect(depGraph.countPathsToRoot(baz)).toBe(2));
  });
});
