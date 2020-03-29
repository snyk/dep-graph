import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('directDepsLeadingTo', () => {
  const depGraph = depGraphLib.createFromJSON(
    helpers.loadFixture('goof-graph.json'),
  );

  test('it gets the package itself if it is a direct dependency', () => {
    const pkg = { name: 'consolidate', version: '0.14.5' };

    expect(depGraph.directDepsLeadingTo(pkg)).toEqual([pkg]);
  });

  test('it gets the direct deps leading to a package, respecting the version', () => {
    const pkgA = { name: 'bluebird', version: '2.9.26' };
    const pkgB = { name: 'bluebird', version: '3.5.2' };

    const expectedDepsA = [{ name: 'mongoose', version: '4.2.4' }];
    const expectedDepsB = [
      { name: 'consolidate', version: '0.14.5' },
      { name: 'tap', version: '5.8.0' },
    ];

    const directDepsForA = depGraph.directDepsLeadingTo(pkgA);
    const directDepsForB = depGraph.directDepsLeadingTo(pkgB);

    expect(directDepsForA).toEqual(expectedDepsA);
    expect(directDepsForB).toEqual(expectedDepsB);
    expect(directDepsForA).not.toEqual(directDepsForB);
  });

  test('it gets the correct direct deps for a deep dependency', () => {
    const pkg = { name: 'isarray', version: '0.0.1' };
    const expected = [
      { name: 'express-fileupload', version: '0.0.5' },
      { name: 'mongoose', version: '4.2.4' },
      { name: 'tap', version: '5.8.0' },
    ];

    expect(depGraph.directDepsLeadingTo(pkg)).toEqual(expected);
  });

  test('it works with a cyclic dep-graph', () => {
    const cyclic = depGraphLib.createFromJSON(
      helpers.loadFixture('cyclic-dep-graph.json'),
    );
    const pkg = { name: 'baz', version: '4' };
    const expected = [{ name: 'foo', version: '2' }];

    expect(cyclic.directDepsLeadingTo(pkg)).toEqual(expected);
  });
});
