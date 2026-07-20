import { createDataset } from './datasets';
import { measureEventLoopDelay } from './metrics/event-loop-delay';
import { measureMemory } from './metrics/memory';
import { measureThroughput } from './metrics/throughput';
import { CreateFromJSON, DatasetName, MetricName, MetricResult } from './types';

interface WorkerRequest {
  metric: MetricName;
  dataset: DatasetName;
  throughputTargetMs: number;
  eventLoopTargetMs: number;
  rounds: number;
  implementationPath: string;
}

async function main(): Promise<void> {
  const request = parseRequest(process.argv[2]);
  const dataset = createDataset(request.dataset);
  const createFromJSON = await loadCreateFromJSON(request.implementationPath);
  let result: MetricResult;

  if (request.metric === 'throughput') {
    result = measureThroughput(
      dataset,
      request.throughputTargetMs,
      request.rounds,
      createFromJSON,
    );
  } else if (request.metric === 'event-loop-delay') {
    result = await measureEventLoopDelay(
      dataset,
      request.eventLoopTargetMs,
      request.rounds,
      createFromJSON,
    );
  } else if (request.metric === 'memory') {
    result = measureMemory(dataset, createFromJSON);
  } else {
    throw new Error(
      `unknown createFromJSON benchmark metric: ${request.metric}`,
    );
  }

  process.stdout.write(JSON.stringify(result));
}

async function loadCreateFromJSON(
  implementationPath: string,
): Promise<CreateFromJSON> {
  const implementation = (await import(implementationPath)) as {
    createFromJSON?: CreateFromJSON;
  };
  if (typeof implementation.createFromJSON !== 'function') {
    throw new Error(
      `implementation does not export createFromJSON: ${implementationPath}`,
    );
  }
  return implementation.createFromJSON;
}

function parseRequest(serializedRequest: string | undefined): WorkerRequest {
  if (!serializedRequest) {
    throw new Error('createFromJSON benchmark worker request is missing');
  }
  return JSON.parse(serializedRequest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
