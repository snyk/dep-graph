import * as depGraphLib from '../../../src';

import { canonicalizeDepGraphData } from './support/canonicalize';
import { createDiamondGraphData } from './support/graph-data';

describe('createFromJSON round trips', () => {
  test('reaches a stable representation after serialization', () => {
    const first = depGraphLib.createFromJSON(createDiamondGraphData());
    const second = depGraphLib.createFromJSON(first.toJSON());

    expect(canonicalizeDepGraphData(second.toJSON())).toStrictEqual(
      canonicalizeDepGraphData(first.toJSON()),
    );
    expect(second.equals(first)).toBe(true);
  });

  test('normalizes an older supported schema to the current schema', () => {
    const graph = depGraphLib.createFromJSON(createDiamondGraphData());

    expect(graph.toJSON().schemaVersion).toBe('1.3.0');
  });
});
