import { createFromJSON, DepGraphData } from '../../src';
import { loadFixture } from '../helpers';

describe('pkgPathsToRoot', () => {
  it('calculates paths from a package to the root', () => {
    const graphJson: DepGraphData = loadFixture('simple-graph.json');

    const depGraph = createFromJSON(graphJson);

    const paths = depGraph.pkgPathsToRoot({
      name: 'e',
      version: '5.0.0',
    });

    expect(paths).toEqual([
      [
        {
          name: 'e',
          version: '5.0.0',
        },
        {
          name: 'd',
          version: '0.0.1',
        },
        {
          name: 'c',
          version: '1.0.0',
        },
        {
          name: 'a',
          version: '1.0.0',
        },
        {
          name: 'root',
          version: '0.0.0',
        },
      ],
      [
        {
          name: 'e',
          version: '5.0.0',
        },
        {
          name: 'd',
          version: '0.0.2',
        },
        {
          name: 'c',
          version: '1.0.0',
        },
        {
          name: 'b',
          version: '1.0.0',
        },
        {
          name: 'root',
          version: '0.0.0',
        },
      ],
    ]);
  });

  it('can limit the number of paths returned', () => {
    const graphJson: DepGraphData = loadFixture('simple-graph.json');
    const depGraph = createFromJSON(graphJson);
    const limit = 1;

    const pathsWithoutLimit = depGraph.pkgPathsToRoot({
      name: 'e',
      version: '5.0.0',
    });

    const pathsWithlimit = depGraph.pkgPathsToRoot(
      {
        name: 'e',
        version: '5.0.0',
      },
      { limit },
    );

    expect(pathsWithoutLimit.length).toBeGreaterThan(limit);
    expect(pathsWithlimit).toHaveLength(limit);
  });

  describe('cycles', () => {
    const depGraphData = loadFixture('cyclic-complex-dep-graph.json');
    const depGraph = createFromJSON(depGraphData);
    it('returns expected paths for all packages', () => {
      depGraph.getPkgs().forEach((pkg) => {
        const pkgPathsToRoot = depGraph.pkgPathsToRoot(pkg);
        expect(pkgPathsToRoot).toMatchSnapshot(`${pkg.name}@${pkg.version}`);
      });
    });
  });
});
