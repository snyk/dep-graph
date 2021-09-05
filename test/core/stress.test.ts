import { generateLargeGraph } from '../helpers';

const dependencyName = 'needle';

describe('stress tests', () => {
  test('pkgPathsToRoot() does not cause stack overflow for large dep-graphs', () => {
    const graph = generateLargeGraph(125000, dependencyName);

    const result = graph.pkgPathsToRoot({
      name: dependencyName,
      version: '1.2.3',
    });
    expect(result).toBeDefined();
  });
});
