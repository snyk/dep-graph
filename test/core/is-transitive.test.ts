import { createFromJSON, DepGraphData } from '../../src';
import { loadFixture } from '../helpers';
import * as depGraphLib from '../../src';

describe('isTransitive', () => {
  it('checks direct', () => {
    const graphJson: DepGraphData = loadFixture('simple-graph.json');

    const depGraph = createFromJSON(graphJson);

    expect(depGraph.isTransitive({ name: 'a', version: '1.0.0' })).toBe(false);
    expect(depGraph.isTransitive({ name: 'b', version: '1.0.0' })).toBe(false);
    expect(depGraph.isTransitive({ name: 'e', version: '5.0.0' })).toBe(true);
    expect(depGraph.isTransitive({ name: 'd', version: '0.0.1' })).toBe(true);
    expect(depGraph.isTransitive({ name: 'd', version: '0.0.2' })).toBe(true);
    expect(depGraph.isTransitive({ name: 'c', version: '1.0.0' })).toBe(true);
  });

  it('assume non-transitive if any directly depends', () => {
    const builder = new depGraphLib.DepGraphBuilder(
      { name: 'npm' },
      { name: 'root', version: '1.2.3' },
    );
    const rootNodeId = 'root-node';

    // root depends on 'a' and 'b', 'b' depends again on 'a'.
    builder.addPkgNode({ name: 'a', version: '1.0.0' }, 'a|1');
    builder.connectDep(rootNodeId, 'a|1');

    builder.addPkgNode({ name: 'b', version: '1.0.0' }, 'b');
    builder.connectDep(rootNodeId, 'b');

    builder.addPkgNode({ name: 'a', version: '1.0.0' }, 'a|2');
    builder.connectDep('b', 'a|2');

    const depGraph = builder.build();

    expect(depGraph.isTransitive({ name: 'a', version: '1.0.0' })).toBe(false);
    expect(depGraph.isTransitive({ name: 'b', version: '1.0.0' })).toBe(false);
  });
});
