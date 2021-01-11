import { DepGraphBuilder } from '../../src';

describe('builder', () => {
  let builder;

  beforeEach(() => {
    builder = new DepGraphBuilder({ name: 'poetry' });
  });

  test('empty graph', async () => {
    const depGraph = builder.build();
    expect(depGraph.pkgManager.name).toEqual('poetry');
    expect(depGraph.rootPkg).toHaveProperty('name');
    expect(depGraph.getPkgs()).toHaveLength(1);
    expect(depGraph.getDepPkgs()).toHaveLength(0);
  });

  describe('when using addPkgNode', () => {
    it('should throw error if trying to add root node in dependencies', () => {
      const pkgToAdd = { name: 'json' };
      expect(() => {
        builder.addPkgNode(pkgToAdd, 'root-node');
      }).toThrow(Error);
    });

    it('should add the package to the relevant properties and graph', () => {
      const pkgToAdd = { name: 'json', version: '1.0.0' };
      builder.addPkgNode(pkgToAdd, pkgToAdd.name);

      const packageAdded = builder
        .getPkgs()
        .find(
          (pkg) =>
            pkg.name === pkgToAdd.name && pkg.version === pkgToAdd.version,
        );
      expect(packageAdded).toBeDefined();
    });
  });

  describe('when using connectDep', () => {
    const parentDepNodeId = 'parent-dep';
    const childDepNodeId = 'child-dep';

    beforeEach(() => {
      const parentPkg = { name: 'parent-dep', version: '1.0.0' };
      const childPkg = { name: 'child-dep', version: '1.0.0' };
      builder.addPkgNode(parentPkg, parentDepNodeId);
      builder.addPkgNode(childPkg, childDepNodeId);
    });

    it('should throw an error if the parent node does not exist', () => {
      expect(() => {
        builder.connectDep('non-existent-dep', childDepNodeId);
      }).toThrow(Error);
    });

    it('should throw an error if the child node does not exist', () => {
      expect(() => {
        builder.connectDep(parentDepNodeId, 'non-existent-dep');
      }).toThrow(Error);
    });

    it('should connect two dependencies in graph', () => {
      builder.connectDep(parentDepNodeId, childDepNodeId);
      const actualGraph = builder.build();
      const graphJson = actualGraph.toJSON().graph;
      const parentDepInGraph = graphJson.nodes.find(
        (dep) => dep.nodeId === parentDepNodeId,
      );
      expect(parentDepInGraph.deps.length).toBe(1);
      expect(
        parentDepInGraph.deps.find((dep) => dep.nodeId === childDepNodeId),
      ).toBeDefined();
    });
  });
});
