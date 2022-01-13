#!/usr/bin/env -S node -r ts-node/register/transpile-only

import { createFromJSON } from '../src';
import benny from 'benny';
import { readFileSync } from 'fs';

const doc = JSON.parse(readFileSync(process.argv[2], { encoding: 'utf-8' }));

benny.suite(
  'createFromJSON',

  benny.add('parsing arg', () => createFromJSON(doc)),

  benny.cycle(),
  benny.complete(),
  benny.save({ file: 'reduce', version: '1.0.0' }),
);
