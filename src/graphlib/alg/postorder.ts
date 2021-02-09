import { dfs } from './dfs';
import { Graph } from '../graph';

export function postorder(g: Graph, vs: string[]): string[] {
  return dfs(g, vs, 'post');
}
