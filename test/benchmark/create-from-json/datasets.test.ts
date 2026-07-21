import { createFromJSON } from '../../../src';
import {
  DATASET_CONFIGS,
  createDataset,
  memoryRetainedGraphCount,
} from '../../../benchmark/create-from-json/datasets';

describe('createFromJSON benchmark datasets', () => {
  it.each(DATASET_CONFIGS)(
    'builds a valid $name dataset with stable dimensions',
    (configuration) => {
      const dataset = createDataset(configuration.name);
      const edgeCount = dataset.data.graph.nodes.reduce(
        (count, node) => count + node.deps.length,
        0,
      );

      expect(dataset.nodes).toBe(configuration.nodes);
      expect(dataset.packages).toBe(configuration.packages);
      expect(dataset.edges).toBe(configuration.edges);
      expect(dataset.data.graph.nodes).toHaveLength(configuration.nodes);
      expect(dataset.data.pkgs).toHaveLength(configuration.packages);
      expect(edgeCount).toBe(configuration.edges);
      expect(() => createFromJSON(dataset.data)).not.toThrow();
    },
  );

  test('uses fixed memory sample sizes independent of implementation speed', () => {
    expect(memoryRetainedGraphCount('real-golang-646')).toBe(32);
    expect(memoryRetainedGraphCount('synthetic-5000')).toBe(8);
    expect(memoryRetainedGraphCount('synthetic-20000')).toBe(3);
  });
});
