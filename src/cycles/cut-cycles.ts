import { eventLoopSpinner } from 'event-loop-spinner';
import { buildEdge } from './edges';
import { DepGraph, DepGraphInternal, NodeInfo } from '../core/types';
import { DepGraphBuilder } from '..';
import { findCycle } from './find-cycles';
import { getGraphMaps, EdgesMap, NodeId } from './get-graph-maps';

export async function cutCycles(depGraph: DepGraph) {
  if (!(depGraph as DepGraphInternal).hasCycles()) {
    return depGraph;
  }
  const { nodesMap, edgesMap, pkgsInfoMap } = getGraphMaps(depGraph);

  const removedEdgesMap: EdgesMap = new Map();
  let cycle = getCycle(edgesMap);

  while (cycle) {
    const from = cycle[0];
    const to = cycle[cycle.length - 1];
    edgesMap.set(
      from,
      edgesMap.get(from)!.filter((nodeId) => nodeId !== to),
    );

    const index = nodesMap
      .get(from)!
      .deps.findIndex(({ nodeId }) => nodeId === to);

    if (!removedEdgesMap.has(from)) removedEdgesMap.set(from, []);
    removedEdgesMap.get(from)!.push(buildEdge(index, to));
    cycle = getCycle(edgesMap);

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  const rootPkg = depGraph.rootPkg;
  const depGraphBuilder = new DepGraphBuilder(depGraph.pkgManager, rootPkg);

  for (const { nodeId, info, pkgId } of nodesMap.values()) {
    if (nodeId === 'root-node') continue;

    let nodeInfo: NodeInfo | undefined;
    if (removedEdgesMap.get(nodeId)) {
      nodeInfo = info ? { ...info } : {};
      nodeInfo.labels = nodeInfo.labels || {};
      nodeInfo.labels['removed-cyclic-deps'] = removedEdgesMap
        .get(nodeId)!
        .join();
    }
    depGraphBuilder.addPkgNode(pkgsInfoMap.get(pkgId)!, nodeId, nodeInfo);

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  for (const [from, toNode] of edgesMap.entries()) {
    toNode.forEach((toNodeId) => depGraphBuilder.connectDep(from, toNodeId));

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  return depGraphBuilder.build();
}

function getCycle(graph: EdgesMap): NodeId[] | null {
  return findCycle<NodeId>('root-node', (nodeId) => graph.get(nodeId)!);
}
