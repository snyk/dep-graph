import * as depGraphLib from '../../../src';

import { cloneDepGraphData } from './support/canonicalize';
import { createDiamondGraphData } from './support/graph-data';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

describe('createFromJSON input immutability', () => {
  test.each([true, false])(
    'does not mutate its input when shouldValidate is %s',
    (shouldValidate) => {
      const graphData = createDiamondGraphData();
      const before = cloneDepGraphData(graphData);
      deepFreeze(graphData);

      expect(() =>
        depGraphLib.createFromJSON(graphData, { shouldValidate }),
      ).not.toThrow();
      expect(graphData).toStrictEqual(before);
    },
  );
});
