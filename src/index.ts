import 'source-map-support/register';

export {
  DepGraph,
  DepGraphData,
  Pkg,
  PkgInfo,
  PkgManager,
  VersionProvenance,
} from './core/types';
export { createFromJSON } from './core/create-from-json';
export { DepGraphBuilder } from './core/builder';

import * as Errors from './core/errors';
export { Errors };

import * as legacy from './legacy';
import * as uuidv4 from 'uuid/v4';
import { writeFileSync } from 'fs';
import { DepGraphBuilder } from './core/builder';

export { legacy };

setImmediate(async () => {
  const builder = new DepGraphBuilder(
    { name: 'rpm' },
    { name: 'root', version: '1.2.3' },
  );
  const rootNodeId = 'root-node';
  const deps: string[] = [];

  for (let j = 0; j < 2 ** 6; j++) {
    const shallowName = uuidv4();
    const shallowDependency = { name: shallowName, version: '1.2.3' };

    deps.push(shallowName);

    builder.addPkgNode(shallowDependency, shallowName);
    builder.connectDep(rootNodeId, shallowName);

    let prev = shallowName;
    for (let i = 0; i < 2 ** 12; i++) {
      const newName = uuidv4();
      const newDependency = { name: newName, version: '1.2.3' };

      builder.addPkgNode(newDependency, newName);
      builder.connectDep(prev, newName);

      prev = newName;

      deps.push(newName);
    }
  }

  const graph = builder.build();
  writeFileSync('./deps-v2.json', JSON.stringify(graph));
  writeFileSync('./vulns-v2.json', JSON.stringify(deps));
});
