import 'source-map-support/register';

export { DepGraphData, DepGraph, PkgManager } from './core/types';
export { createFromJSON } from './core/create-from-json';

import * as legacy from './legacy';
export { legacy };
