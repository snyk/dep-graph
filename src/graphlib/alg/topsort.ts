import * as each from 'lodash.foreach';
import * as has from 'lodash.has';
import * as size from 'lodash.size';

export function topsort(g) {
  const visited = {};
  const stack = {};
  const results: any[] = [];

  function visit(node) {
    if (has(stack, node)) {
      throw new CycleException();
    }

    if (!has(visited, node)) {
      stack[node] = true;
      visited[node] = true;
      each(g.predecessors(node), visit);
      delete stack[node];
      results.push(node);
    }
  }

  each(g.sinks(), visit);

  if (size(visited) !== g.nodeCount()) {
    throw new CycleException();
  }

  return results;
}

export class CycleException extends Error {}
