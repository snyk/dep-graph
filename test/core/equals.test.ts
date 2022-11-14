import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('equals', () => {
  test('same graphs', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple-different-root.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(true);
    expect(b.equals(a, { compareRoot: false })).toBe(true);

    expect(a.equals(b)).toBe(false);
    expect(b.equals(a, { compareRoot: true })).toBe(false);
  });

  test('different minor version', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple-different-minor-verion.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(false);
    expect(b.equals(a, { compareRoot: false })).toBe(false);
  });

  test('additional dependency', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple-one-more-child.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(false);
    expect(b.equals(a, { compareRoot: false })).toBe(false);
  });

  test('additional label', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple-with-label.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(false);
    expect(b.equals(a, { compareRoot: false })).toBe(false);
  });

  test('different nodes order', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple-wrong-nodes-order-a.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple-wrong-nodes-order-b.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(false);
    expect(b.equals(a, { compareRoot: false })).toBe(false);
  });

  test('same graphs with cycles', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/cycles/simple-a.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/cycles/simple-a.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(true);
    expect(b.equals(a, { compareRoot: false })).toBe(true);
  });

  test('different graphs with cycles', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/cycles/simple-a.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/cycles/simple-b.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(false);
    expect(b.equals(a, { compareRoot: false })).toBe(false);
  });

  test('different graphs one node cycle', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/cycles/one-node-cycle-a.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/cycles/one-node-cycle-b.json'),
    );

    expect(a.equals(b)).toBe(false);
    expect(b.equals(a)).toBe(false);
  });

  test('other is a different internal implementation', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/simple.json'),
    );
    const b = {
      toJSON() {
        return helpers.loadFixture('equals/simple.json');
      },
    } as any;

    expect(a.equals(b)).toBe(true);
  });

  test('same graphs with different node IDs', async () => {
    const a = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/different-node-id-a.json'),
    );
    const b = depGraphLib.createFromJSON(
      helpers.loadFixture('equals/different-node-id-b.json'),
    );

    expect(a.equals(b, { compareRoot: false })).toBe(true);
    expect(b.equals(a, { compareRoot: false })).toBe(true);
  });

  test('same graphs with different minor schema version', async () => {
    const a = depGraphLib.createFromJSON({
      ...helpers.loadFixture('equals/simple.json'),
      schemaVersion: '1.2.0',
    });
    const b = depGraphLib.createFromJSON({
      ...helpers.loadFixture('equals/simple.json'),
      schemaVersion: '1.3.0',
    });

    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);
  });
});
