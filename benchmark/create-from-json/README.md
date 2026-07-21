# createFromJSON performance regression harness

This harness measures the synchronous `createFromJSON` baseline along three
independent dimensions:

- throughput: median CPU operations per second after warmup, with wall time as
  a diagnostic;
- event-loop delay: median synchronous blocking duration for one call, plus
  zero-delay timer and calibrated sustained-batch diagnostics;
- memory: retained heap per constructed graph, plus peak and released deltas.

Each metric/dataset pair runs in a fresh child process. Dataset loading and
generation happen before measurement, and memory workers always start Node.js
with `--expose-gc`. Results are JSON and include runtime, CPU, dataset, sample,
and calibration metadata.

Run the full suite on Node 20:

```sh
npx -p node@20 node -r ts-node/register/transpile-only benchmark/create-from-json/run.ts > current.json
```

Use `--quick` for a smoke run. Narrow a run with comma-separated values:

```sh
npm run benchmark:create-from-json -- --datasets real-golang-646,synthetic-5000 --metrics throughput,event-loop-delay
```

Compare two reports locally:

```sh
npm run benchmark:create-from-json:compare -- baseline.json current.json
```

The blocking CircleCI job does not use an absolute measurement captured on a
developer machine or an older runner. It checks out the commit under test's
GitHub PR base and collects twelve balanced cycles. Every cycle runs two
fresh-process base measurements and one candidate measurement in a rotating
order. This produces 24 baseline samples, 12 candidate samples, and a
same-executor control distribution for every dataset and metric.

The PR base is the merge base between the checked-out candidate and the first
parent of GitHub's merge ref. It is therefore an ancestor of the candidate even
if the target advances, while stacked and multi-commit pull requests are still
compared across their complete change set. An explicit `--base` overrides that
discovery; outside CircleCI the fallback is `HEAD^`. A CircleCI branch build
without PR metadata fails closed instead of silently comparing only the final
commit; the master release build explicitly compares its new commit with
`HEAD^`. The base worktree installs its own dependencies, while the checked-out
candidate uses its own installation, so dependency changes are part of the
comparison.

Run the CI gate locally against a revision with Node 20:

```sh
npx -p node@20 node -r ts-node/register/transpile-only benchmark/create-from-json/ci.ts --base HEAD^
```

The exact one-sided confidence test requires at least 10 of 12 paired cycles to
exceed the allowed regression before it blocks as a regression (at least 98%
actual confidence). The allowance is the greater of the explicit meaningful
regression floor or the current runner's p75 control noise. Repeated control
noise above the metric ceiling blocks as inconclusive instead of weakening the
gate. Raw base/head samples, metadata, the machine-readable decision, the
command log, and a Markdown report are retained as CircleCI artifacts before a
separate step enforces the decision.

Single-call delay is the event-loop regression signal. The sustained batch is
secondary: it shows starvation under load, but its duration is deliberately
calibrated and therefore should not replace the per-call comparison.

Full throughput rounds target one second so even the largest graph contains
enough operations to reduce shared-runner scheduling noise. Quick mode keeps its
short 50 ms target and is never used for the blocking CI decision. Process CPU
time is the regression signal, excluding periods when a shared CI container is
descheduled; wall-clock operation time remains in every raw report. A calibrated
warmup runs for at least 500 ms of active process CPU time and ten calls before
the harness recalibrates the measured rounds, reducing process-to-process V8
optimization variance without counting time when the container is descheduled.

The comparison reports signed change and direction-aware improvement for each
cell. The CI executor is pinned to the Node 20.20.2 image digest. Each sample is
isolated, the execution order balances cache and thermal effects, and memory
retains a fixed number of graphs per dataset so implementation speed cannot
change the allocation sample size.
