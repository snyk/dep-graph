import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('countPathsToRoot', () => {
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
