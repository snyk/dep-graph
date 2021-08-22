import { PartitionedCycles } from './cycles';

type NodeId = string;

export type MemoizationMap<T> = Map<
  NodeId,
  {
    item: T;

    // the cycleNodeIds holds the nodes ids in a cycle
    // i.e. for the cyclic graph "1->2->3->4->2", for nodeId=2 the cycleNodeIds will be "3,4"
    // if nodeId exists in cycleNodeIds, don't use memoized item version
    cycleNodeIds?: Set<NodeId>;
  }
>;

export function memoize<T>(
  nodeId: NodeId,
  memoizationMap: MemoizationMap<T>,
  item: T,
  partitionedCycles: PartitionedCycles,
) {
  const { cyclesStartWithThisNode, cyclesWithThisNode } = partitionedCycles;
  if (cyclesStartWithThisNode.length > 0) {
    const cycleNodeIds = new Set<NodeId>(...cyclesStartWithThisNode);
    memoizationMap.set(nodeId, { item, cycleNodeIds });
  } else if (cyclesWithThisNode.length === 0) {
    memoizationMap.set(nodeId, { item });
  }
  // Don't memoize nodes in cycles (cyclesWithThisNode.length > 0)
}

export function getMemoizedItem<T>(
  nodeId: NodeId,
  ancestors: NodeId[],
  memoizationMap: MemoizationMap<T>,
): T | null {
  if (!memoizationMap.has(nodeId)) return null;

  const { item, cycleNodeIds } = memoizationMap.get(nodeId)!;
  if (!cycleNodeIds) return item;

  const ancestorsArePartOfTheCycle = ancestors.some((nodeId) =>
    cycleNodeIds.has(nodeId),
  );

  return ancestorsArePartOfTheCycle ? null : item;
}
