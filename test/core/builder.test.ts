import { DepGraphBuilder } from '../../src';
import { ValidationError } from '../../src/core/errors';

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

  describe('constructor with nodeInfo for root node', () => {
    it('should set nodeInfo on root node when provided', () => {
      const rootPkg = { name: 'my-app', version: '1.0.0' };
      const nodeInfo = {
        labels: {
          'maven:build_scope': 'compile',
        },
      };

      const builderWithNodeInfo = new DepGraphBuilder(
        { name: 'maven' },
        rootPkg,
        nodeInfo,
      );

      const depGraph = builderWithNodeInfo.build();
      const graphJson = depGraph.toJSON();

      const rootNode = graphJson.graph.nodes.find(
        (node) => node.nodeId === 'root-node',
      );

      expect(rootNode).toBeDefined();
      expect(rootNode!.info).toBeDefined();
      expect(rootNode!.info!.labels).toBeDefined();
      expect(rootNode!.info!.labels!['maven:build_scope']).toEqual('compile');
    });

    it('should not set info on root node when nodeInfo is not provided', () => {
      const rootPkg = { name: 'my-app', version: '1.0.0' };

      const builderWithoutNodeInfo = new DepGraphBuilder(
        { name: 'maven' },
        rootPkg,
      );

      const depGraph = builderWithoutNodeInfo.build();
      const graphJson = depGraph.toJSON();

      const rootNode = graphJson.graph.nodes.find(
        (node) => node.nodeId === 'root-node',
      );

      expect(rootNode).toBeDefined();
      expect(rootNode!.info).toBeUndefined();
    });

    it('should preserve root node info alongside dependency node info', () => {
      const rootPkg = { name: 'my-app', version: '1.0.0' };
      const rootNodeInfo = {
        labels: {
          'maven:build_scope': 'compile',
        },
      };

      const builderWithNodeInfo = new DepGraphBuilder(
        { name: 'maven' },
        rootPkg,
        rootNodeInfo,
      );

      // Add a dependency with its own nodeInfo
      const depPkg = { name: 'dep-pkg', version: '2.0.0' };
      const depNodeInfo = {
        labels: {
          'maven:build_scope': 'test',
        },
      };
      builderWithNodeInfo.addPkgNode(depPkg, 'dep-node', depNodeInfo);
      builderWithNodeInfo.connectDep('root-node', 'dep-node');

      const depGraph = builderWithNodeInfo.build();
      const graphJson = depGraph.toJSON();

      // Check root node has its info
      const rootNode = graphJson.graph.nodes.find(
        (node) => node.nodeId === 'root-node',
      );
      expect(rootNode!.info!.labels!['maven:build_scope']).toEqual('compile');

      // Check dependency node has its own info
      const depNode = graphJson.graph.nodes.find(
        (node) => node.nodeId === 'dep-node',
      );
      expect(depNode!.info!.labels!['maven:build_scope']).toEqual('test');
    });

    it('should handle nodeInfo with multiple labels', () => {
      const rootPkg = { name: 'my-app', version: '1.0.0' };
      const nodeInfo = {
        labels: {
          'maven:build_scope': 'compile',
          scope: 'prod' as const,
        },
      };

      const builderWithNodeInfo = new DepGraphBuilder(
        { name: 'maven' },
        rootPkg,
        nodeInfo,
      );

      const depGraph = builderWithNodeInfo.build();
      const graphJson = depGraph.toJSON();

      const rootNode = graphJson.graph.nodes.find(
        (node) => node.nodeId === 'root-node',
      );

      expect(rootNode!.info!.labels!['maven:build_scope']).toEqual('compile');
      expect(rootNode!.info!.labels!['scope']).toEqual('prod');
    });

    it('should handle empty labels object in nodeInfo', () => {
      const rootPkg = { name: 'my-app', version: '1.0.0' };
      const nodeInfo = {
        labels: {},
      };

      const builderWithNodeInfo = new DepGraphBuilder(
        { name: 'maven' },
        rootPkg,
        nodeInfo,
      );

      const depGraph = builderWithNodeInfo.build();
      const graphJson = depGraph.toJSON();

      const rootNode = graphJson.graph.nodes.find(
        (node) => node.nodeId === 'root-node',
      );

      // With empty labels, info should still be present but empty
      expect(rootNode!.info).toBeDefined();
      expect(rootNode!.info!.labels).toEqual({});
    });
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

    it('should throw error if invalid package URL is defined', () => {
      const pkgToAdd = {
        name: 'json',
        version: '1.0.0',
        purl: 'this-is:not/a-/purl',
      };
      expect(() => {
        builder.addPkgNode(pkgToAdd, pkgToAdd.name);
      }).toThrow(ValidationError);
    });
    it('should throw error if package URL defines different name', () => {
      const pkgToAdd = {
        name: 'json',
        version: '1.0.0',
        purl: 'pkg:rpm/yaml@1.0.0',
      };
      expect(() => {
        builder.addPkgNode(pkgToAdd, pkgToAdd.name);
      }).toThrow(ValidationError);
    });
    it('should throw error if package URL defines different version', () => {
      const pkgToAdd = {
        name: 'json',
        version: '1.0.0',
        purl: 'pkg:rpm/json@1.0.1',
      };
      expect(() => {
        builder.addPkgNode(pkgToAdd, pkgToAdd.name);
      }).toThrow(ValidationError);
    });
    it('successfully adds package with package URL', () => {
      const pkgToAdd = {
        name: 'json',
        version: '1.0.0',
        purl: 'pkg:rpm/rhel/json@1.0.0?repositories=a,b,c',
      };
      builder.addPkgNode(pkgToAdd, pkgToAdd.name);
      const packageAdded = builder
        .getPkgs()
        .find(
          (pkg) =>
            pkg.name === pkgToAdd.name && pkg.version === pkgToAdd.version,
        );
      expect(packageAdded).toEqual(pkgToAdd);
    });
    it('successfully handles maven special case', () => {
      const pkgToAdd = {
        name: 'com.namespace:foo',
        version: '1.0.0',
        purl: 'pkg:maven/com.namespace/foo@1.0.0',
      };
      builder.addPkgNode(pkgToAdd, pkgToAdd.name);
      const packageAdded = builder
        .getPkgs()
        .find(
          (pkg) =>
            pkg.name === pkgToAdd.name && pkg.version === pkgToAdd.version,
        );
      expect(packageAdded).toEqual(pkgToAdd);
    });
    it('fails on missing group id on maven package', () => {
      // the groupId in maven is the namespace in purl.
      const pkgToAdd = {
        name: 'foo',
        version: '1.0.0',
        purl: 'pkg:maven/com.namespace/foo@1.0.0',
      };
      expect(() => {
        builder.addPkgNode(pkgToAdd, pkgToAdd.name);
      }).toThrow(ValidationError);
    });
    it('fails on different group id on maven package', () => {
      // the groupId in maven is the namespace in purl.
      const pkgToAdd = {
        name: 'com.namespace:foo',
        version: '1.0.0',
        purl: 'pkg:maven/com.other/foo@1.0.0',
      };
      expect(() => {
        builder.addPkgNode(pkgToAdd, pkgToAdd.name);
      }).toThrow(ValidationError);
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
