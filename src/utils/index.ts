import * as types from '../core/types';

export {
  compactJSON,
};

// WARNING: mutates input!
function compactJSON(depGraphJSON: types.DepGraphData): void {
  const countPerPkg: {
    [pkg: string]: number;
  } = {};
  for (const node of depGraphJSON.graph.nodes) {
    if (node.nodeId === depGraphJSON.graph.rootNodeId) {
      continue;
    }
    if (countPerPkg[node.pkgId] === undefined) {
      countPerPkg[node.pkgId] = 0;
      renameNode(depGraphJSON, node.nodeId, node.pkgId);
    } else {
      countPerPkg[node.pkgId]++;
      renameNode(depGraphJSON, node.nodeId, node.pkgId + '|' + countPerPkg[node.pkgId]);
    }
  }
}

function renameNode(depGraphJSON: types.DepGraphData, fromId: string, toId: string): void {
  for (const node of depGraphJSON.graph.nodes) {
    if (node.nodeId === fromId) {
      node.nodeId = toId;
      continue;
    }
    for (const dep of node.deps) {
      if (dep.nodeId === fromId) {
        dep.nodeId = toId;
      }
    }
  }
}
