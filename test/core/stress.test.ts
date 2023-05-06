import * as depGraphLib from '../../src';

const dependencyName = 'needle';

async function generateLargeGraph(width: number) {
  const builder = new depGraphLib.DepGraphBuilder(
    { name: 'npm' },
    { name: 'root', version: '1.2.3' },
  );
  const rootNodeId = 'root-node';

  const deepDependency = { name: dependencyName, version: '1.2.3' };

  builder.addPkgNode(deepDependency, dependencyName);
  builder.connectDep(rootNodeId, dependencyName);

  for (let j = 0; j < width; j++) {
    const shallowName = `id-${j}`;
    const shallowDependency = { name: shallowName, version: '1.2.3' };

    builder.addPkgNode(shallowDependency, shallowName);
    builder.connectDep(rootNodeId, shallowName);
    builder.connectDep(shallowName, dependencyName);
  }

  return builder.build();
}

describe('stress tests', () => {
  test('pkgPathsToRoot() does not cause stack overflow for large dep-graphs', async () => {
    const graph = await generateLargeGraph(125000);

    const result = graph.pkgPathsToRoot({
      name: dependencyName,
      version: '1.2.3',
    });
    expect(result).toBeDefined();
  });
  test('countPathsToRoot() is cached', async () => {
    const graph = await generateLargeGraph(100_000);
    let start = Date.now();
    graph.countPathsToRoot({
      name: dependencyName,
      version: '1.2.3',
    });
    const firstCallDuration = Date.now() - start;
    start = Date.now();
    graph.countPathsToRoot({
      name: dependencyName,
      version: '1.2.3',
    });
    const secondCallDuration = Date.now() - start;
    // the second call must be *significantly* faster than the first
    expect(secondCallDuration).toBeLessThan(firstCallDuration * 0.2);
  });
});
