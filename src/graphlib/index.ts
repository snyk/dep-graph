export { Graph } from './graph';
import { isAcyclic } from './alg/is-acyclic';
import { postorder } from './alg/postorder';

export const alg = {
  isAcyclic,
  postorder,
};
