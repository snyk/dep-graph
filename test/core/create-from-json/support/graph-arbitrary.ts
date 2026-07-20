import * as fc from 'fast-check';

import { DepGraphData } from '../../../../src';

export const GENERATED_GRAPH_RUNS = 250;
export const VALID_GRAPH_SEEDS = {
  serialization: 0x5eed1001,
  queries: 0x5eed1002,
  roundTrip: 0x5eed1003,
} as const;

interface ValidGraphArbitraryOptions {
  minNodes?: number;
  maxNodes?: number;
}

interface GeneratedGraphShape {
  versions: Array<[number, number, number]>;
  includePurls: boolean[];
  packageOrder: number[];
  parentChoices: number[];
  extraEdges: Array<[number, number]>;
  extraPackageChoices: number[];
  nodeInfoVariants: number[];
  nodeOrder: number[];
  includeManagerVersion: boolean;
  includeRepository: boolean;
}

export function validGraphDataArbitrary({
  minNodes = 1,
  maxNodes = 24,
}: ValidGraphArbitraryOptions = {}): fc.Arbitrary<DepGraphData> {
  return fc
    .integer({ min: minNodes, max: maxNodes })
    .chain((nodeCount) => generatedGraphShapeArbitrary(nodeCount))
    .map(({ nodeCount, shape }) => buildValidGraphData(nodeCount, shape));
}

function generatedGraphShapeArbitrary(
  nodeCount: number,
): fc.Arbitrary<{ nodeCount: number; shape: GeneratedGraphShape }> {
  const packageCount = Math.max(1, Math.ceil(nodeCount / 2));
  const extraInstanceCount = nodeCount - packageCount;

  return fc
    .record({
      versions: fc.array(
        fc.tuple(
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 20 }),
          fc.integer({ min: 0, max: 20 }),
        ),
        { minLength: packageCount, maxLength: packageCount },
      ),
      includePurls: fixedLengthArray(fc.boolean(), packageCount),
      packageOrder: fixedLengthArray(fc.nat(), packageCount),
      parentChoices: fixedLengthArray(fc.nat(), Math.max(0, nodeCount - 1)),
      extraEdges: fc.array(fc.tuple(fc.nat(), fc.nat()), {
        maxLength: nodeCount * 2,
      }),
      extraPackageChoices: fixedLengthArray(fc.nat(), extraInstanceCount),
      nodeInfoVariants: fixedLengthArray(
        fc.integer({ min: 0, max: 4 }),
        nodeCount,
      ),
      nodeOrder: fixedLengthArray(fc.nat(), nodeCount),
      includeManagerVersion: fc.boolean(),
      includeRepository: fc.boolean(),
    })
    .map((shape) => ({ nodeCount, shape }));
}

function fixedLengthArray<T>(
  arbitrary: fc.Arbitrary<T>,
  length: number,
): fc.Arbitrary<T[]> {
  return fc.array(arbitrary, { minLength: length, maxLength: length });
}

function buildValidGraphData(
  nodeCount: number,
  shape: GeneratedGraphShape,
): DepGraphData {
  const packageCount = shape.versions.length;
  const packages = shape.versions.map(([major, minor, patch], index) => {
    const name = `pkg-${index}`;
    const version = `${major}.${minor}.${patch}`;
    const info = {
      name,
      version,
      ...(shape.includePurls[index]
        ? { purl: `pkg:npm/${name}@${version}` }
        : {}),
    };

    return { id: `${name}@${version}`, info };
  });

  const packageIndexes = Array.from({ length: nodeCount }, (_, index) =>
    index < packageCount
      ? index
      : shape.extraPackageChoices[index - packageCount] % packageCount,
  );
  const dependencies = Array.from(
    { length: nodeCount },
    () => new Set<number>(),
  );

  for (let child = 1; child < nodeCount; child += 1) {
    const parent = shape.parentChoices[child - 1] % child;
    dependencies[parent].add(child);
  }

  for (const [sourceChoice, targetChoice] of shape.extraEdges) {
    const source = sourceChoice % nodeCount;
    const target = targetChoice % nodeCount;
    if (target !== 0 && source !== target) {
      dependencies[source].add(target);
    }
  }

  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    nodeId: `node-${index}`,
    pkgId: packages[packageIndexes[index]].id,
    ...(buildNodeInfo(shape.nodeInfoVariants[index], index) || {}),
    deps: Array.from(dependencies[index], (target) => ({
      nodeId: `node-${target}`,
    })),
  }));

  return {
    schemaVersion: '1.3.0',
    pkgManager: {
      name: 'npm',
      ...(shape.includeManagerVersion ? { version: '10.0.0' } : {}),
      ...(shape.includeRepository
        ? { repositories: [{ alias: 'generated-registry' }] }
        : {}),
    },
    pkgs: orderByGeneratedKeys(packages, shape.packageOrder, (pkg) => pkg.id),
    graph: {
      rootNodeId: 'node-0',
      nodes: orderByGeneratedKeys(
        nodes,
        shape.nodeOrder,
        (node) => node.nodeId,
      ),
    },
  };
}

function buildNodeInfo(variant: number, index: number) {
  if (variant === 0) return undefined;
  if (variant === 1) return { info: { labels: { scope: 'prod' as const } } };
  if (variant === 2) {
    return {
      info: { labels: { scope: 'dev' as const, pruned: 'true' as const } },
    };
  }
  if (variant === 3) {
    return {
      info: {
        versionProvenance: {
          type: 'generated',
          location: `fixture-${index}.lock`,
          property: { name: `pkg-${index}` },
        },
      },
    };
  }
  return {
    info: {
      labels: { source: `generated-${index}` },
      versionProvenance: {
        type: 'generated',
        location: `fixture-${index}.lock`,
      },
    },
  };
}

function orderByGeneratedKeys<T>(
  values: T[],
  keys: number[],
  tieBreaker: (value: T) => string,
): T[] {
  return values
    .map((value, index) => ({ value, key: keys[index] }))
    .sort((left, right) =>
      left.key === right.key
        ? tieBreaker(left.value).localeCompare(tieBreaker(right.value))
        : left.key - right.key,
    )
    .map(({ value }) => value);
}
