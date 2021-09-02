import { PartitionedCycles } from './cycles';

type NodeId = string;

type CacheMap<T> = Map<
  NodeId,
  {
    item: T;

    // the cycleNodeIds holds the nodes ids in a cycle
    // i.e. for the cyclic graph "1->2->3->4->2", for nodeId=2 the cycleNodeIds will be "3,4"
    // if nodeId exists in cycleNodeIds, don't use cached item version
    cycleNodeIds?: Set<NodeId>;
  }
>;

// This class adds cache when traversing over the graph
// It will cache the item
export class TraversalCache<T> {
  private map: CacheMap<T> = new Map();

  public set(nodeId: NodeId, item: T, partitionedCycles?: PartitionedCycles) {
    if (!partitionedCycles) {
      this.map.set(nodeId, { item });
      return;
    }
    const { cyclesStartWithThisNode, cyclesWithThisNode } = partitionedCycles;
    if (cyclesStartWithThisNode?.length > 0) {
      // add explaination
      const cycleNodeIds = new Set<NodeId>(...cyclesStartWithThisNode);
      this.map.set(nodeId, { item, cycleNodeIds });
    } else if (!cyclesWithThisNode?.length) {
      // add explaination
      this.map.set(nodeId, { item });
    }
    // Don't cache nodes in cycles (cyclesWithThisNode.length > 0)
  }

  public get(nodeId: NodeId, ancestors: NodeId[]): T | null {
    if (!this.map.has(nodeId)) return null;

    const { item, cycleNodeIds } = this.map.get(nodeId)!;
    if (!cycleNodeIds) return item;

    const ancestorsArePartOfTheCycle = ancestors.some((nodeId) =>
      cycleNodeIds.has(nodeId),
    );

    return ancestorsArePartOfTheCycle ? null : item;
  }
}
