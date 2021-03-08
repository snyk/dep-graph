const { createFromJSON } = require('../dist');

const b = require('benny');
const fs = require('fs');

const doc = JSON.parse(fs.readFileSync(process.argv[2], { encoding: 'utf-8' }));

b.suite(
  'createFromJSON',

  b.add('parsing arg', () => createFromJSON(doc)),

  b.cycle(),
  b.complete(),
  b.save({ file: 'reduce', version: '1.0.0' }),
);
