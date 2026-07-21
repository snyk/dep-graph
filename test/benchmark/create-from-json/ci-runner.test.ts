import {
  balancedVariantOrders,
  benchmarkEnvironment,
  installRevisionDependencies,
  parseCiOptions,
  resolveBaseRevision,
} from '../../../benchmark/create-from-json/ci';

describe('createFromJSON performance CI runner', () => {
  test('balances every variant across every execution position', () => {
    const orders = balancedVariantOrders(12);

    for (const variant of ['baseline-a', 'baseline-b', 'candidate'] as const) {
      expect(orders.filter((order) => order[0] === variant)).toHaveLength(4);
      expect(orders.filter((order) => order[1] === variant)).toHaveLength(4);
      expect(orders.filter((order) => order[2] === variant)).toHaveLength(4);
    }
  });

  test('requires enough cycles for the configured confidence', () => {
    expect(() => parseCiOptions(['--cycles', '11'])).toThrow(/at least 12/);
  });

  test('accepts an explicit base revision and output directory', () => {
    expect(
      parseCiOptions(['--base', 'abc123', '--output', 'benchmark/results/ci']),
    ).toEqual(
      expect.objectContaining({
        baseRevision: 'abc123',
        outputDirectory: 'benchmark/results/ci',
      }),
    );
  });

  test('uses the candidate merge base with the GitHub PR target', () => {
    const git = jest
      .fn()
      .mockReturnValueOnce('')
      .mockReturnValueOnce('base-sha');

    expect(
      resolveBaseRevision(
        '/repo',
        undefined,
        'https://github.com/snyk/dep-graph/pull/168',
        git,
      ),
    ).toBe('base-sha');
    expect(git).toHaveBeenNthCalledWith(1, '/repo', [
      'fetch',
      '--no-tags',
      'origin',
      'refs/pull/168/merge',
    ]);
    expect(git).toHaveBeenNthCalledWith(2, '/repo', [
      'merge-base',
      'HEAD',
      'FETCH_HEAD^1',
    ]);
  });

  test('honours an explicit base without fetching a PR merge ref', () => {
    const git = jest.fn().mockReturnValue('base-sha');

    expect(
      resolveBaseRevision(
        '/repo',
        'accepted-revision',
        'https://github.com/snyk/dep-graph/pull/168',
        git,
      ),
    ).toBe('base-sha');
    expect(git).toHaveBeenCalledWith('/repo', [
      'rev-parse',
      'accepted-revision^{commit}',
    ]);
  });

  test('rejects a malformed CircleCI pull request URL', () => {
    expect(() =>
      resolveBaseRevision('/repo', undefined, 'not-a-pull-request', jest.fn()),
    ).toThrow(/invalid CIRCLE_PULL_REQUEST/);
  });

  test('fails closed when a CircleCI branch build has no PR base', () => {
    expect(() =>
      resolveBaseRevision('/repo', undefined, undefined, jest.fn(), true),
    ).toThrow(/CircleCI requires/);
  });

  test('keeps HEAD^ as the local default', () => {
    const git = jest.fn().mockReturnValue('parent-sha');

    expect(resolveBaseRevision('/repo', undefined, undefined, git, false)).toBe(
      'parent-sha',
    );
    expect(git).toHaveBeenCalledWith('/repo', ['rev-parse', 'HEAD^']);
  });

  test('installs dependencies inside the baseline revision worktree', () => {
    const execute = jest.fn();

    installRevisionDependencies('/tmp/base-worktree', execute);

    expect(execute).toHaveBeenCalledWith('npm', ['install'], {
      cwd: '/tmp/base-worktree',
      stdio: 'inherit',
    });
  });

  test('does not let the candidate dependency tree override base imports', () => {
    const environment = benchmarkEnvironment('/candidate', {
      NODE_PATH: '/candidate/node_modules',
      PATH: '/usr/bin',
    });

    expect(environment).toEqual({
      PATH: '/usr/bin',
      TS_NODE_PROJECT: '/candidate/benchmark/tsconfig.json',
    });
  });
});
