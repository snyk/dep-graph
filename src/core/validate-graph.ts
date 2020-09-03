import * as graphlib from 'graphlib';
import { ValidationError } from './errors';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new ValidationError(msg);
  }
}

export function validateGraph(
  graph: graphlib.Graph,
  rootNodeId: string,
  pkgs: { [pkgId: string]: any },
  pkgNodes: { [nodeId: string]: Set<string> },
) {
  assert(
    (graph.predecessors(rootNodeId) || []).length === 0,
    `"${rootNodeId}" is not really the root`,
  );
  const reachableFromRoot = graphlib.alg.postorder(graph, [rootNodeId]);
  const nodeIds = graph.nodes();

  assert(
    JSON.stringify(nodeIds.sort()) === JSON.stringify(reachableFromRoot.sort()),
    'not all graph nodes are reachable from root',
  );

  const pkgIds = Object.keys(pkgs);
  const pkgsWithoutInstances = pkgIds.filter(
    (pkgId) => !pkgNodes[pkgId] || pkgNodes[pkgId].size === 0,
  );
  assert(pkgsWithoutInstances.length === 0, 'not all pkgs have instance nodes');
}
