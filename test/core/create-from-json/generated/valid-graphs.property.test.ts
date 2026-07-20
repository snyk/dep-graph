import * as fc from 'fast-check';

import { createFromJSON } from '../../../../src';
import { DepGraphInternal } from '../../../../src/core/types';
import { canonicalizeDepGraphData } from '../support/canonicalize';
import {
  GENERATED_GRAPH_RUNS,
  VALID_GRAPH_SEEDS,
  validGraphDataArbitrary,
} from '../support/graph-arbitrary';

describe('createFromJSON generated valid graphs', () => {
  it('preserves the complete serialized graph', () => {
    fc.assert(
      fc.property(validGraphDataArbitrary(), (input) => {
        const output = createFromJSON(input).toJSON();

        expect(canonicalizeDepGraphData(output)).toEqual(
          canonicalizeDepGraphData(input),
        );
      }),
      { numRuns: GENERATED_GRAPH_RUNS, seed: VALID_GRAPH_SEEDS.serialization },
    );
  });

  it('builds queryable package and edge relationships', () => {
    fc.assert(
      fc.property(validGraphDataArbitrary(), (input) => {
        const graph = createFromJSON(input) as DepGraphInternal;
        const packagesById = new Map(input.pkgs.map((pkg) => [pkg.id, pkg]));

        for (const node of input.graph.nodes) {
          expect(graph.getNodePkg(node.nodeId)).toEqual(
            packagesById.get(node.pkgId)?.info,
          );
          expect(graph.getNodeDepsNodeIds(node.nodeId).sort()).toEqual(
            node.deps.map((dep) => dep.nodeId).sort(),
          );

          const expectedParents = input.graph.nodes
            .filter((candidate) =>
              candidate.deps.some((dep) => dep.nodeId === node.nodeId),
            )
            .map((candidate) => candidate.nodeId)
            .sort();
          expect(graph.getNodeParentsNodeIds(node.nodeId).sort()).toEqual(
            expectedParents,
          );
        }
      }),
      { numRuns: GENERATED_GRAPH_RUNS, seed: VALID_GRAPH_SEEDS.queries },
    );
  });

  it('is stable across a second create/serialize round trip', () => {
    fc.assert(
      fc.property(validGraphDataArbitrary(), (input) => {
        const first = createFromJSON(input);
        const second = createFromJSON(first.toJSON());

        expect(second.equals(first)).toBe(true);
        expect(canonicalizeDepGraphData(second.toJSON())).toEqual(
          canonicalizeDepGraphData(first.toJSON()),
        );
      }),
      { numRuns: GENERATED_GRAPH_RUNS, seed: VALID_GRAPH_SEEDS.roundTrip },
    );
  });
});
