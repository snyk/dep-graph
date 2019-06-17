import * as depGraphLib from '../../src';
import * as helpers from '../helpers';

describe('equals', () => {
  test('same graphs', async () => {
    const a = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple.json'));
    const b = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple-different-root.json'));

    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);

    expect(a.equals(b, true)).toBe(false);
    expect(b.equals(a, true)).toBe(false);
  });

  test('different minor version', async () => {
    const a = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple.json'));
    const b = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple-different-minor-verion.json'));

    expect(a.equals(b)).toBe(false);
    expect(b.equals(a)).toBe(false);
  });

  test('additional dependency', async () => {
    const a = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple.json'));
    const b = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple-one-more-child.json'));

    expect(a.equals(b)).toBe(false);
    expect(b.equals(a)).toBe(false);
  });

  test('additional label', async () => {
    const a = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple.json'));
    const b = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple-with-label.json'));

    expect(a.equals(b)).toBe(false);
    expect(b.equals(a)).toBe(false);
  });

  test('different nodes order', async () => {
    const a = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple.json'));
    const b = depGraphLib.createFromJSON(helpers.loadFixture('equals/simple-wrong-nodes-order.json'));

    expect(a.equals(b)).toBe(false);
    expect(b.equals(a)).toBe(false);
  });

  test('same graphs with cycles', async () => {
    const a = depGraphLib.createFromJSON(helpers.loadFixture('equals/with-cycle.json'));
    const b = depGraphLib.createFromJSON(helpers.loadFixture('equals/with-cycle.json'));

    expect(a.equals(b)).toBe(true);
    expect(b.equals(a)).toBe(true);
  });

  test('different graphs with cycles', async () => {
    const a = depGraphLib.createFromJSON(helpers.loadFixture('equals/with-cycle.json'));
    const b = depGraphLib.createFromJSON(helpers.loadFixture('equals/with-cycle-2.json'));

    expect(a.equals(b)).toBe(false);
    expect(b.equals(a)).toBe(false);
  });
});
