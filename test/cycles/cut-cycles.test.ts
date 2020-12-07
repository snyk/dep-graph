import { cutCycles } from '../../src/cycles/cut-cycles';
import { reconnectCycles } from '../../src/cycles/reconnect-cycles';
import * as depGraphLib from '../../src';
import { DepGraph, PkgInfo } from '../../src';
import { generateLargeGraph } from '../helpers';
import { NodeId } from '../../src/cycles/get-graph-maps';

describe('cut and reconnect cycles', () => {
  const cyclicDepGraph = generateDepGraphWithCycles(10);
  const nonCyclicDepGraph = generateLargeGraph(100);

  it('cyclic graph', async () => validate(cyclicDepGraph));

  it('non cyclic graph', async () => validate(nonCyclicDepGraph));
});

async function validate(depGraph: DepGraph) {
  const depGraphWithoutCycles = await cutCycles(depGraph);
  expect(depGraphWithoutCycles.toJSON()).toMatchSnapshot();

  const revertedDepGraph = await reconnectCycles(depGraphWithoutCycles);
  expect(depGraph.toJSON()).toEqual(revertedDepGraph.toJSON());
}

function generateDepGraphWithCycles(numberOfCycles: number): DepGraph {
  // This creates a graph where each node is a child of the previous node and also connected to the root node
  // I.e. Root, A, B,c : Root -> A, A -> Root, A -> B, B -> Root, B -> C, B -> Root
  // Total of 3 cycles: Root->A->Root, Root->A->B->Root, Root->A->B->C->Root
  const builder = new depGraphLib.DepGraphBuilder(
    { name: 'npm' },
    { name: 'root', version: '1.2.3' },
  );
  const rootNodeId: NodeId = 'root-node';

  let lastNodeId: NodeId = rootNodeId;

  for (let j = 0; j < numberOfCycles; j++) {
    const newNodeId: NodeId = `id-${j}`;
    const newNodePkgInfo: PkgInfo = { name: newNodeId, version: '1.2.3' };

    builder.addPkgNode(newNodePkgInfo, newNodeId);
    builder.connectDep(lastNodeId, newNodeId);
    builder.connectDep(newNodeId, rootNodeId);

    lastNodeId = newNodeId;
  }

  return builder.build();
}
