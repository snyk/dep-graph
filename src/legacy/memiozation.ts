import { DepTree } from './index';
import { PartitionedCycles } from './cycles';

type NodeId = string;

export type MemoizationMap = Map<
  NodeId,
  {
    depTree: DepTree;

    // the cycleNodeIds holds the nodes ids in a cycle
    // i.e. for the cyclic graph "1->2->3->4->2", for nodeId=2 the cycleNodeIds will be "3,4"
    // if nodeId exists in cycleNodeIds, don't use memoized depTree version
    cycleNodeIds?: Set<NodeId>;
  }
>;

export function memoize(
  nodeId: NodeId,
  memoizationMap: MemoizationMap,
  depTree: DepTree,
  partitionedCycles: PartitionedCycles,
) {
  const { cyclesStartWithThisNode, cyclesWithThisNode } = partitionedCycles;
  if (cyclesStartWithThisNode.length > 0) {
    const cycleNodeIds = new Set<NodeId>(...cyclesStartWithThisNode);
    memoizationMap.set(nodeId, { depTree, cycleNodeIds });
  } else if (cyclesWithThisNode.length === 0) {
    memoizationMap.set(nodeId, { depTree });
  }
  // Don't memoize nodes in cycles (cyclesWithThisNode.length > 0)
}

export function getMemoizedDepTree(
  nodeId: NodeId,
  ancestors: NodeId[],
  memoizationMap: MemoizationMap,
): DepTree | null {
  if (!memoizationMap.has(nodeId)) return null;

  const { depTree, cycleNodeIds } = memoizationMap.get(nodeId)!;
  if (!cycleNodeIds) return depTree;

  const ancestorsArePartOfTheCycle = ancestors.some((nodeId) =>
    cycleNodeIds.has(nodeId),
  );

  return ancestorsArePartOfTheCycle ? null : depTree;
}
