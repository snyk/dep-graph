import * as fc from 'fast-check';

import { createFromJSON, Errors } from '../../../../src';
import {
  GENERATED_INVALID_GRAPH_RUNS,
  INVALID_GRAPH_MUTATIONS,
  invalidGraphDataArbitrary,
} from '../support/invalid-mutations';

describe('createFromJSON generated invalid graphs', () => {
  it.each(INVALID_GRAPH_MUTATIONS)(
    'rejects a $description',
    ({ kind, expectedMessage, seed }) => {
      fc.assert(
        fc.property(invalidGraphDataArbitrary(kind), (input) => {
          let thrown: unknown;
          try {
            createFromJSON(input);
          } catch (error) {
            thrown = error;
          }

          expect(thrown).toBeInstanceOf(Errors.ValidationError);
          expect((thrown as Error).message).toContain(expectedMessage);
        }),
        { numRuns: GENERATED_INVALID_GRAPH_RUNS, seed },
      );
    },
  );
});
