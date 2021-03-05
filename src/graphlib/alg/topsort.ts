import * as each from 'lodash.foreach';
import * as size from 'lodash.size';

import { Graph } from '../graph';

export function topsort(g: Graph): string[] {
  const visited = {};
  const stack = {};
  const results: any[] = [];

  function visit(node: string) {
    if (node in stack) {
      throw new CycleException();
    }

    if (!(node in visited)) {
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
