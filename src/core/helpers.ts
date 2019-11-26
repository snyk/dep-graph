export type Index = Record<string, Set<string>>;

export function addToIndex(index: Index, key: string, value: string)  {
  if (!index[key]) {
    index[key] = new Set();
  }
  index[key].add(value);
}
