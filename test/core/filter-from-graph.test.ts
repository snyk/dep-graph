import * as depGraphLib from '../../src';
import * as helpers from '../helpers';
import {
  filterNodesFromGraph,
  filterPackagesFromGraph,
} from '../../src/core/filter-from-graph';
import { PkgInfo } from '../../src';

describe('filter-from-graph', function () {
  let depGraph;

  beforeEach(async () => {
    depGraph = depGraphLib.createFromJSON(
      helpers.loadFixture('goof-graph.json'),
    );
  });

  describe('filterNodesFromGraph', () => {
    describe('should return same depGraph if nodeIdsToFilterOut is empty', () => {
      const testCases = [null, undefined, []];

      it.each(testCases)('%s', async (nodeIdsToFilterOut) => {
        const result = await filterNodesFromGraph(
          depGraph,
          nodeIdsToFilterOut as any,
        );

        expect(result).toBe(depGraph);
      });
    });

    it('should remove direct dependencies', async () => {
      const result = await filterNodesFromGraph(depGraph, ['adm-zip@0.4.7']);

      expect(result.getDepPkgs().length).toEqual(
        depGraph.getDepPkgs().length - 1,
      );

      expect(result.toJSON()).toMatchSnapshot({
        schemaVersion: expect.any(String),
      });
    });

    it('should not mutate original depGraph', async () => {
      const depGraphCloneJson = JSON.parse(JSON.stringify(depGraph.toJSON()));

      await filterNodesFromGraph(depGraph, ['adm-zip@0.4.7']);

      expect(depGraph.toJSON()).toEqual(depGraphCloneJson);
    });

    it("should return same instance if node ids to filter don't exists", async () => {
      const result = await filterNodesFromGraph(depGraph, ['blabla@1.2.3']);

      expect(result).toBe(depGraph);
    });
  });

  describe('filterPackagesFromGraph', () => {
    const admZip = { name: 'adm-zip', version: '0.4.7' };
    const bytes = { name: 'bytes', version: '1.0.0' };
    const testCases = [
      ['one existing name', [admZip.name]],
      ['one existing PkgInfo', [admZip]],
      ['two existing names', [admZip.name, bytes.name]],
      ['two existing PkgInfos', [admZip, bytes]],
    ] as [string, (string | PkgInfo)[]][];

    it.each(testCases)('%s', async (_, pkgs) => {
      const result = await filterPackagesFromGraph(depGraph, pkgs);

      expect(result.getDepPkgs().length).toEqual(
        depGraph.getDepPkgs().length - pkgs.length,
      );
      expect(result.toJSON()).toMatchSnapshot({
        schemaVersion: expect.any(String),
      });
    });

    it('should return an empty graph', async () => {
      const pkgs = depGraph.getDepPkgs();
      const result = await filterPackagesFromGraph(depGraph, pkgs);

      expect(result.getDepPkgs().length).toBe(0);
      expect(result.toJSON()).toMatchSnapshot({
        schemaVersion: expect.any(String),
      });
    });
  });
});
