import Graph = require('./graph');
import { isAcyclic } from './alg/is-acyclic';
import { postorder } from './alg/postorder';

export { Graph };
export const alg = {
  isAcyclic,
  postorder,
};
