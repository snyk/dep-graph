import { DepGraphBuilder } from '../../src';

describe('empty graph', () => {
  const builder = new DepGraphBuilder({name: 'pip'});

  const depGraph = builder.build();

  test('use it', async () => {
    expect(depGraph.pkgManager.name).toEqual('pip');
    expect(depGraph.rootPkg).toHaveProperty('name');
    expect(depGraph.getPkgs()).toHaveLength(1);
    expect(depGraph.getDepPkgs()).toHaveLength(0);
  });
});
