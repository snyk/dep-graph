#!/usr/bin/env -S node -r ts-node/register/transpile-only

import { createFromJSON } from '../src';
import benny from 'benny';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturePath = join(__dirname, 'fixtures', 'big-golang-graph.json');
const fixture = JSON.parse(readFileSync(fixturePath, { encoding: 'utf-8' }));
const depGraph = createFromJSON(fixture);

// Get a sample of packages to benchmark
const pkgs = Array.from(depGraph.getPkgs()).slice(0, 5);

benny.suite('countPathsToRoot',

  benny.add('with limit of 100', () => {
    for (const pkg of pkgs) {
      depGraph.countPathsToRoot(pkg, { limit: 100 });
    }
  }),

  benny.add('with limit of 1,000', () => {
    for (const pkg of pkgs) {
      depGraph.countPathsToRoot(pkg, { limit: 1000 });
    }
  }),

  benny.add('with limit of 10,000', () => {
    for (const pkg of pkgs) {
      depGraph.countPathsToRoot(pkg, { limit: 10000 });
    }
  }),

  benny.add('with limit of 20,000', () => {
    for (const pkg of pkgs) {
      depGraph.countPathsToRoot(pkg, { limit: 20000 });
    }
  }),

  // Note: "no limit" case skipped for hyper-dense-graph as it would never complete

  benny.cycle(),
  benny.complete(),
  benny.save({ file: 'countPathsToRoot', version: '1.0.0' }),
);

