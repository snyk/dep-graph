import * as depGraphLib from '../../src';
import { graphToDepTree } from '../../src/legacy';

const dependencyName = 'needle';

async function generateLargeGraph(width: number) {
  const builder = new depGraphLib.DepGraphBuilder(
    { name: 'npm' },
    { name: 'root', version: '1.2.3' },
  );
  const rootNodeId = 'root-node';

  const deepDependency = { name: dependencyName, version: '1.2.3' };
  const deepDependency2 = { name: dependencyName + 2, version: '1.2.3' };

  builder.addPkgNode(deepDependency, dependencyName);
  builder.addPkgNode(deepDependency2, deepDependency2.name);
  builder.connectDep(rootNodeId, dependencyName);
  builder.connectDep(deepDependency.name, deepDependency2.name);

  for (let j = 0; j < width / 2; j++) {
    const shallowName = `id-${j}`;
    const shallowDependency = { name: shallowName, version: '1.2.3' };

    builder.addPkgNode(shallowDependency, shallowName);
    builder.connectDep(rootNodeId, shallowName);
    builder.connectDep(shallowName, dependencyName);
  }

  for (let j = 0; j < width / 2; j++) {
    const shallowName = `second-${j}`;
    const shallowDependency = { name: shallowName, version: '1.2.3' };

    builder.addPkgNode(shallowDependency, shallowName);
    builder.connectDep(deepDependency2.name, shallowName);
  }

  return builder.build();
}

describe('stress tests', () => {
  test('graphToDepTree() with memoization (without deduplicateWithinTopLevelDeps) succeed for large dep-graphs', async () => {
    const graph = await generateLargeGraph(125000);

    const depTree = await graphToDepTree(graph, 'gomodules', {
      deduplicateWithinTopLevelDeps: false,
    });
    expect(depTree).toBeDefined();
  });
});
