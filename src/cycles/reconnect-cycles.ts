import { splitEdge } from './edges';
import { DepGraph, DepGraphBuilder } from '..';
import { eventLoopSpinner } from 'event-loop-spinner';
import { getGraphMaps, EdgesMap } from './get-graph-maps';

export async function reconnectCycles(depGraph: DepGraph) {
  const { nodesMap, edgesMap, pkgsInfoMap } = getGraphMaps(depGraph);

  const edgesToReconnect: EdgesMap = new Map();

  const rootPkg = depGraph.rootPkg;
  const depGraphBuilder = new DepGraphBuilder(depGraph.pkgManager, rootPkg);

  for (const { nodeId, info, pkgId } of nodesMap.values()) {
    if (nodeId === 'root-node') continue;
    let nodeInfo = info;
    if (info?.labels && info?.labels['removed-cyclic-deps']) {
      const cyclicEdges = info.labels['removed-cyclic-deps'].split(',').sort();
      if (!edgesToReconnect.has(nodeId)) edgesToReconnect.set(nodeId, []);
      cyclicEdges.forEach((to) => edgesToReconnect.get(nodeId)!.push(to));
      delete info.labels['removed-cyclic-deps'];
      if (Object.keys(info.labels).length === 0) {
        delete info.labels;
      }
      if (Object.keys(info).length === 0) {
        nodeInfo = undefined;
      }
    }
    depGraphBuilder.addPkgNode(pkgsInfoMap.get(pkgId)!, nodeId, nodeInfo);

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  const edges: EdgesMap = new Map();

  for (const [from, toNode] of edgesMap.entries()) {
    if (!edges.has(from)) edges.set(from, []);
    toNode.forEach((toNodeId) => edges.get(from)!.push(toNodeId));

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  for (const [from, toNode] of edgesToReconnect.entries()) {
    if (!edges.has(from)) edges.set(from, []);
    toNode
      .map(splitEdge)
      .sort((a, b) => a.index - b.index)
      .forEach(({ index, to }) => edges.get(from)!.splice(+index, 0, to));

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  for (const [from, toArr] of edges.entries()) {
    toArr.forEach((toNodeId) => depGraphBuilder.connectDep(from, toNodeId));

    if (eventLoopSpinner.isStarving()) {
      await eventLoopSpinner.spin();
    }
  }

  return depGraphBuilder.build();
}
