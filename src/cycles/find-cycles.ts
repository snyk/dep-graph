// This file is a modification of https://github.com/jcoreio/find-cycle/blob/master/directed.js
// It adds typescript support and get only one startNode (instead of multiple)

export function findCycle<Node>(
  startNode: Node,
  getChildrenNodes: (node: Node) => Node[],
) {
  function getChildrenIterator(node): Iterator<Node> {
    const nodes = getChildrenNodes(node) || [];
    return nodes[Symbol.iterator]();
  }

  const visited = new Set<Node>([startNode]);
  const nodeStack: Node[] = [startNode];
  const connectedNodeStack: Iterator<Node>[] = [getChildrenIterator(startNode)];
  const nodeIndexes = new Map<Node, number>([[startNode, 0]]);

  while (nodeStack.length) {
    const connectedNodes = connectedNodeStack[connectedNodeStack.length - 1];

    const next = connectedNodes.next();
    if (next.done) {
      connectedNodeStack.pop();
      const removedNode = nodeStack.pop()!;
      nodeIndexes.delete(removedNode);
      continue;
    }
    const nextNode = next.value;
    const cycleStartIndex = nodeIndexes.get(nextNode);
    if (cycleStartIndex != null) {
      // found a cycle!
      return nodeStack.slice(cycleStartIndex).reverse();
    }
    if (visited.has(nextNode)) continue;
    visited.add(nextNode);
    nodeIndexes.set(nextNode, nodeStack.length);
    nodeStack.push(nextNode);
    connectedNodeStack.push(getChildrenIterator(nextNode));
  }

  return null;
}
