/* tslint:disable:no-console */
import * as depGraphLib from './index';
import * as childProcess from 'child_process';

const NODE_INFO =
  "** heapTotal and heapUsed refer to V8's memory usage.\n" +
  '** external refers to the memory usage of C++ objects bound to JavaScript objects managed by V8.\n' +
  '** rss, Resident Set Size, is the amount of space occupied in the main memory device (that is a subset of the total allocated memory) for the process, including all C++ and JavaScript objects and code.\n';
const TESTS_AMOUNT = 20;
const CHAIN_SIZE = 2e4;
const SEPARATOR = '===========';
const reshapeToMB = (n) => Math.round((n / 1024 / 1024) * 100) / 100;
const generateName = (i) => `A${i}A`;
const generateIthPkg = (i) => ({
  name: generateName(i),
  version: '2',
  dependencies: {},
});
const generateChainGraph = (n = CHAIN_SIZE) => {
  let previous;
  for (let i = 0; i < n; i++) {
    const pkg = generateIthPkg(i);
    if (previous) {
      pkg.dependencies = previous;
    }
    previous = pkg;
  }
  return previous;
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// const dumpMemory = (memory: NodeJS.MemoryUsage) => {
//   const parsed = Object.entries(memory)
//     .map(([key, val]) => {
//       return `${key} ${reshapeToMB(val)} MB`;
//     })
//     .join('\n');
//   console.log(SEPARATOR + '\n' + parsed + '\n' + SEPARATOR);
// };

const runTest = async (): Promise<Array<any>> => {
  const depTree = generateChainGraph(2e3);
  const pre: NodeJS.MemoryUsage = process.memoryUsage();
  const hrstart = process.hrtime();
  await depGraphLib.legacy.depTreeToGraph(depTree, 'dontcare');
  const hrend = process.hrtime(hrstart);
  const post: NodeJS.MemoryUsage = process.memoryUsage();

  // @ts-ignore
  const diff: NodeJS.MemoryUsage = Object.keys(pre).reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: post[curr] - pre[curr],
    }),
    {},
  );
  const execTime = hrend[0] * 1000 + hrend[1] / 1e6;

  // @ts-ignore
  process.send([diff, execTime]);
  return [diff, execTime];
};
const runPerformance = async (n) => {
  const results: Array<Array<any>> = [];
  let aliveChildren = n;
  for (let i = 0; i < n; i++) {
    console.log('Dispatching test #' + i);
    const child = childProcess.fork(__filename, ['child']);
    child.on('message', (m) => {
      results.push(m);
    });
    child.on('close', () => {
      aliveChildren--;
    });
  }
  while (aliveChildren > 0) {
    console.log('has more children, waiting');
    await sleep(1000);
  }
  console.log('All kids are dead! Lets continue');
  console.log('Crunching numbers...');
  const avgExecTime = results
    .map(([, execTime]): number => execTime)
    .reduce((acc, curr) => acc + curr, 0);

  const aggregatedResultsVector = results
    .map(([diff]): object => diff)
    .reduce((acc, curr) => {
      Object.keys(curr).forEach((k) => {
        if (!acc[k]) {
          acc[k] = 0;
        }
        acc[k] += curr[k];
      });
      return acc;
    }, {});
  const avgMemUsage = Object.keys(aggregatedResultsVector).reduce(
    (acc, key) => {
      acc[key] = aggregatedResultsVector[key] / n;
      acc[key] = reshapeToMB(acc[key]) + ' MB';
      return acc;
    },
    {},
  );
  console.log(SEPARATOR);
  console.log(`AVERAGE RESULTS AFTER ${n} TESTS`);
  console.log(`Average exec time: ${avgExecTime / n}ms`);
  console.log('Average memory usage:');
  console.log(JSON.stringify(avgMemUsage, null, 4));
  console.log(SEPARATOR);
  console.log(NODE_INFO);
};

const N = Number(process.argv[2]);
if (!!N) {
  runPerformance(N);
} else {
  runTest().then((d) => {
    // Just waiting a bit
  });
}
