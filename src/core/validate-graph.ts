import * as _ from 'lodash';
import { ValidationError } from './errors';
import { DepGraphData2 } from './types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new ValidationError(msg);
  }
}

export function validateGraph(data: DepGraphData2) {

  const seen = new Set<string>();
  const toProcess = new Set<string>([data.rootNodeId]);
  const pkgIdsFromNodes = new Set<string>();

  while (toProcess.size > 0) {
    const nodeId = toProcess.keys().next().value;
    toProcess.delete(nodeId);
    seen.add(nodeId);
    const node = data.nodes[nodeId];
    pkgIdsFromNodes.add(node.pkgId);
    for (const childNodeId of Object.keys(node.deps)) {
      if (!seen.has(childNodeId)) {
        toProcess.add(childNodeId);
      }
      assert(childNodeId !== data.rootNodeId, `"${data.rootNodeId}" is not really the root`);
    }
  }

  assert(JSON.stringify(Object.keys(data.nodes).sort()) === JSON.stringify(Array.from(seen).sort()),
    'not all graph nodes are reachable from root');

  assert(JSON.stringify(Object.keys(data.pkgs).sort()) === JSON.stringify(Array.from(pkgIdsFromNodes).sort()),
    'not all pkgs have instance nodes');
}
