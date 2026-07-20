import { DepGraphData } from '../../../../src';

export function cloneDepGraphData(data: DepGraphData): DepGraphData {
  return JSON.parse(JSON.stringify(data));
}

export function canonicalizeDepGraphData(data: DepGraphData): DepGraphData {
  const canonical = cloneDepGraphData(data);

  canonical.pkgs.sort((a, b) => a.id.localeCompare(b.id));
  canonical.graph.nodes.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  for (const node of canonical.graph.nodes) {
    node.deps.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  }

  return canonical;
}
