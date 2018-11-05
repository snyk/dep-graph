![Snyk logo](https://snyk.io/style/asset/logo/snyk-print.svg)

***

[![Known Vulnerabilities](https://snyk.io/test/npm/@snyk/dep-graph/badge.svg)](https://snyk.io/test/npm/@snyk/dep-graph)

Snyk helps you find, fix and monitor for known vulnerabilities in your dependencies, both on an ad hoc basis and as part of your CI (Build) system.

# Snyk dep-graph

This library provides a time and space efficient representation of a resolved package dependency graph, which can be used to construct, query and de/serialize dep-graphs.

## The Graph

A directed graph, where a node represents a package instance and an edge from node `foo` to node `bar` means `bar` is a dependency of `foo`.

A package (`name@version`) can have several different nodes (i.e. instances) in the graph. This flexibility is useful for some ecosystems, for example:

* in `npm` due to conflict-resolutions by duplication. e.g. try to `npm i tap@5.7` and then run `npm ls` and look for `strip-ansi@3.0.1`. You'll see that in some instances it depends on `ansi-regex@2.0.0` while in others on `ansi-regex@2.1.1`.
* in `maven` due to "exclusion" rules. A dependency `foo` can be declared in the `pom.xml` such that some of it's sub-dependencies are excluded via the `<exclusions>` tag. If the same dependency is required elsewhere without (or with different) exclusions then `foo` can appear in the tree with different sub-trees.

This can also be used to break cycles in the graph, e.g.:

instead of:
```
A -> B -> C -> A
```
can have:
```
A -> B -> C -> A'
```

## API Reference

### `DepGraph`

#### Interface

A dep-graph instance can be queried using the following interface:

```typescript
export interface DepGraph {
  readonly pkgManager: {
    name: string;
    version?: string;
    repositories?: Array<{
      alias: string;
    }>;
  };
  readonly rootPkg: {
    name: string;
    version: string | null;
  };
  getPkgs(): Array<{
    name: string;
    version: string | null;
  }>;
  pkgPathsToRoot(pkg: Pkg): Array<Array<{
    name: string;
    version: string | null;
  }>>;
  toJSON(): DepGraphData;
}
```

### `DepGraphData`

A dep-graph can be serialised into the following format:

```typescript
export interface DepGraphData {
  schemaVersion: string;
  pkgManager: {
    name: string;
    version?: string;
    repositories?: Array<{
      alias: string;
    }>;
  };
  pkgs: Array<{
    id: string;
    info: {
      name: string;
      version: string | null;
    };
  }>;
  graph: {
    rootNodeId: string;
    nodes: Array<{
      nodeId: string;
      pkgId: string;
      deps: Array<{
        nodeId: string;
      }>;
    }>;
  };
}
```

### `createFromJSON`

`DepGraphData` can be used to construct a `DepGraph` instance using `createFromJSON`

### The `legacy` module

A `DepTree` is a legacy structure used by the Snyk CLI to represent dependency trees. Conversion functions in the `legacy` module ease the gradual migration of code that relies on the legacy format.

#### Legacy `DepTree`

A `DepTree` is a recursive structure that is quite similar to the output of `npm list --json`, and (omitting some details) looks like:

```typescript
interface DepTree {
  name: string;
  version: string;
  dependencies: {
    [depName: string]: DepTree
  };
}
```
