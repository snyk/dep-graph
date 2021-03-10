type NodeId = string;
type Cycle = NodeId[];

export type Cycles = Cycle[];

export type PartitionedCycles = {
  cyclesStartWithThisNode: Cycle[];
  cyclesWithThisNode: Cycle[];
};

export function getCycle(ancestors: NodeId[], nodeId: NodeId): Cycle | null {
  if (!ancestors.includes(nodeId)) {
    return null;
  }

  // first item is where the cycle starts and ends.
  return ancestors.slice(ancestors.indexOf(nodeId));
}

export function partitionCycles(
  nodeId: NodeId,
  allCyclesTheNodeIsPartOf: Cycle[],
): PartitionedCycles {
  const cyclesStartWithThisNode: Cycle[] = [];
  const cyclesWithThisNode: Cycle[] = [];

  for (const cycle of allCyclesTheNodeIsPartOf) {
    const nodeStartsCycle = cycle[0] === nodeId;
    if (nodeStartsCycle) {
      cyclesStartWithThisNode.push(cycle);
    } else {
      cyclesWithThisNode.push(cycle);
    }
  }
  return { cyclesStartWithThisNode, cyclesWithThisNode };
}
