import * as each from 'lodash.foreach';
import { Graph } from '../graph';

/*
 * A helper that preforms a pre- or post-order traversal on the input graph
 * and returns the nodes in the order they were visited. If the graph is
 * undirected then this algorithm will navigate using neighbors. If the graph
 * is directed then this algorithm will navigate using successors.
 *
 * Order must be one of "pre" or "post".
 */
export function dfs(g: Graph, vs: string[], order: 'pre' | 'post'): string[] {
  if (!Array.isArray(vs)) {
    vs = [vs];
  }

  const navigation = (g.isDirected() ? g.successors : g.neighbors).bind(g);

  const acc: string[] = [];
  const visited: { [v: string]: boolean } = {};
  each(vs, (v) => {
    if (!g.hasNode(v)) {
      throw new Error('Graph does not have node: ' + v);
    }

    doDfs(g, v, order === 'post', visited, navigation, acc);
  });
  return acc;
}

function doDfs(g, v: string, postorder, visited, navigation, acc) {
  if (!(v in visited)) {
    visited[v] = true;

    if (!postorder) {
      acc.push(v);
    }
    each(navigation(v), function (w) {
      doDfs(g, w, postorder, visited, navigation, acc);
    });
    if (postorder) {
      acc.push(v);
    }
  }
}
