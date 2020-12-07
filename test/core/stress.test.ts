import { generateLargeGraph } from '../helpers';

describe('stress tests', () => {
  test('pkgPathsToRoot() does not cause stack overflow for large dep-graphs', () => {
    const graph = generateLargeGraph(125000);

    const result = graph.pkgPathsToRoot({
      name: 'needle',
      version: '1.2.3',
    });
    expect(result).toBeDefined();
  });
});
