const DELIMITER = `@@`;

export function buildEdge(index: number, to: string) {
  return `${index}${DELIMITER}${to}`;
}

export function splitEdge(edge: string) {
  const [index, to] = edge.split(DELIMITER);
  return { index: parseInt(index, 0), to };
}
