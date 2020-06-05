import Graph = require('./graph');
import isAcyclic = require('./alg/is-acyclic');
import postorder = require('./alg/postorder');

export { Graph };
export const alg = {
  isAcyclic,
  postorder,
};
