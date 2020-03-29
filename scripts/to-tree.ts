#!/usr/bin/env ts-node
// tslint:disable:no-console

import * as fs from 'fs';
import { legacy, createFromJSON } from '../src';

const [STDIN, STDOUT] = [0, 1];

const pkgType = process.argv[2];
if (!pkgType) {
  console.error('requires package type argument. e.g. npm');
  console.log('usage: cat graph.json | npx ts-node to-tree.ts npm > tree.json');
  process.exit(1);
}

async function go() {
  const graphData = JSON.parse(fs.readFileSync(STDIN).toString());
  const graph = createFromJSON(graphData);
  const tree = await legacy.graphToDepTree(graph, pkgType);
  fs.writeSync(STDOUT, JSON.stringify(tree));
}

go().catch(console.error);
