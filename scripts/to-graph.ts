#!/usr/bin/env ts-node
// tslint:disable:no-console

import * as fs from 'fs';
import { legacy } from '../src';

const [STDIN, STDOUT] = [0, 1];

const pkgManager = process.argv[2];
if (!pkgManager) {
  console.error('requires package manager argument. e.g. npm');
  console.log(
    'usage: cat tree.json | npx ts-node to-graph.ts npm > graph.json',
  );
  process.exit(1);
}

async function go() {
  const depTree = JSON.parse(fs.readFileSync(STDIN).toString());
  const graph = await legacy.depTreeToGraph(depTree, pkgManager);
  fs.writeSync(STDOUT, JSON.stringify(graph));
}

go().catch(console.error);
