#!/usr/bin/env -S node -r ts-node/register/transpile-only

import { createFromJSON } from '../src';
import benny from 'benny';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixturePath = join(__dirname, 'fixtures', 'big-golang-graph.json');
const fixture = JSON.parse(readFileSync(fixturePath, { encoding: 'utf-8' }));
const depGraph = createFromJSON(fixture);

benny.suite(
  'pkgPathsToRoot',

  benny.add('with limit of 1', () =>
    depGraph.pkgPathsToRoot(
      {
        name: 'github.com/hashicorp/golang-lru',
        version: 'v0.5.0',
      },
      { limit: 1 },
    ),
  ),

  benny.add('with limit of 100', () =>
    depGraph.pkgPathsToRoot(
      {
        name: 'github.com/hashicorp/golang-lru',
        version: 'v0.5.0',
      },
      { limit: 100 },
    ),
  ),

  benny.add('with limit of 10,000', () =>
    depGraph.pkgPathsToRoot(
      {
        name: 'github.com/hashicorp/golang-lru',
        version: 'v0.5.0',
      },
      { limit: 10_000 },
    ),
  ),

  benny.cycle(),
  benny.complete(),
  benny.save({ file: 'pkgPathsToRoot', version: '1.0.0' }),
);
