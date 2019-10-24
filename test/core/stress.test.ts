import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('stress tests', () => {
  test('pkgPathsToRoot() does not cause stack overflow for large dep-graphs', async () => {
    const graph = depGraphLib.createFromJSON(
      helpers.loadFixture('massive-dep-graph.json'),
    );
    const vulns: string[] = helpers.loadFixture(
      'massive-dep-graph-packages.json',
    );

    const lastPath = vulns[vulns.length - 1];
    const result = graph.pkgPathsToRoot({ name: lastPath, version: '1.2.3' });
    expect(result).toBeDefined();
  });
});
