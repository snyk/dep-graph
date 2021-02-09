import { topsort, CycleException } from './topsort';
import { Graph } from '../graph';

export function isAcyclic(g: Graph) {
  try {
    topsort(g);
  } catch (e) {
    if (e instanceof CycleException) {
      return false;
    }
    throw e;
  }
  return true;
}
