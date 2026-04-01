/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-this-alias */
import * as constant from 'lodash.constant';
import * as each from 'lodash.foreach';
import * as _filter from 'lodash.foreach';
import * as isEmpty from 'lodash.isempty';
import * as isFunction from 'lodash.isfunction';
import * as isUndefined from 'lodash.isundefined';
import * as reduce from 'lodash.reduce';
import * as union from 'lodash.union';
import * as values from 'lodash.values';

const DEFAULT_EDGE_NAME = '\x00';
const GRAPH_NODE = '\x00';
const EDGE_KEY_DELIM = '\x01';

export interface GraphOptions {
  directed?: boolean; // default: true.
  multigraph?: boolean; // default: false.
  compound?: boolean; // default: false.
}

type NodeId = string;
type EdgeId = string;

export interface Edge {
  v: NodeId;
  w: NodeId;
  /** The name that uniquely identifies a multi-edge. */
  name?: string;
}

/** Map counting edges from the current node to neighbouring nodes */
type AdjacencyCounts = Record<NodeId, number>;

// Implementation notes:
//
//  * Node id query functions should return string ids for the nodes
//  * Edge id query functions should return an "edgeObj", edge object, that is
//    composed of enough information to uniquely identify an edge: {v, w, name}.
//  * Internally we use an "edgeId", a stringified form of the edgeObj, to
//    reference edges. This is because we need a performant way to look these
//    edges up and, object properties, which have string keys, are the closest
//    we're going to get to a performant hashtable in JavaScript.

export class Graph {
  _isDirected;
  _isMultigraph;
  _isCompound;
  _label;

  _defaultNodeLabelFn;
  _defaultEdgeLabelFn;

  _nodes: Record<NodeId, unknown>;

  _parent;
  _children;

  _in: Record<NodeId, Record<EdgeId, Edge>>;
  _preds: Record<NodeId, AdjacencyCounts>;
  _out: Record<NodeId, Record<EdgeId, Edge>>;
  _sucs: Record<NodeId, AdjacencyCounts>;
  _edgeObjs: Record<EdgeId, Edge>;
  _edgeLabels: Record<EdgeId, unknown>;

  constructor(opts: GraphOptions) {
    this._isDirected = opts?.directed ?? true;
    this._isMultigraph = opts?.multigraph ?? false;
    this._isCompound = opts?.compound ?? false;

    // Label for the graph itself
    this._label = undefined;

    // Defaults to be set when creating a new node
    this._defaultNodeLabelFn = constant(undefined);

    // Defaults to be set when creating a new edge
    this._defaultEdgeLabelFn = constant(undefined);

    // v -> label
    this._nodes = {};

    if (this._isCompound) {
      // v -> parent
      this._parent = {};

      // v -> children
      this._children = {};
      this._children[GRAPH_NODE] = {};
    }

    // v -> edgeObj
    this._in = {};

    // u -> v -> Number
    this._preds = {};

    // v -> edgeObj
    this._out = {};

    // v -> w -> Number
    this._sucs = {};

    // e -> edgeObj
    this._edgeObjs = {};

    // e -> label
    this._edgeLabels = {};
  }

  /* === Graph functions ========= */

  isDirected(): boolean {
    return this._isDirected;
  }

  isMultigraph(): boolean {
    return this._isMultigraph;
  }

  isCompound(): boolean {
    return this._isCompound;
  }

  setGraph(label) {
    this._label = label;
    return this;
  }

  graph() {
    return this._label;
  }

  /* === Node functions ========== */

  setDefaultNodeLabel(newDefault) {
    if (!isFunction(newDefault)) {
      newDefault = constant(newDefault);
    }
    this._defaultNodeLabelFn = newDefault;
    return this;
  }

  nodeCount(): number {
    return this.nodes().length;
  }

  nodes(): string[] {
    return Object.keys(this._nodes);
  }

  sources(): NodeId[] {
    const self = this;
    return _filter(this.nodes(), (v: NodeId) => {
      return isEmpty(self._in[v]);
    });
  }

  sinks(): NodeId[] {
    const self = this;
    return _filter(this.nodes(), (v: NodeId) => {
      return isEmpty(self._out[v]);
    });
  }

  setNodes(vs: NodeId[], value?: unknown): Graph {
    const args = arguments;
    const self = this;
    each(vs, (v: NodeId) => {
      if (args.length > 1) {
        self.setNode(v, value);
      } else {
        self.setNode(v);
      }
    });
    return this;
  }

  setNode(v: NodeId, value?: unknown): Graph {
    if (v in this._nodes) {
      if (arguments.length > 1) {
        this._nodes[v] = value;
      }
      return this;
    }

    this._nodes[v] = arguments.length > 1 ? value : this._defaultNodeLabelFn(v);
    if (this._isCompound) {
      this._parent[v] = GRAPH_NODE;
      this._children[v] = {};
      this._children[GRAPH_NODE][v] = true;
    }
    this._in[v] = {};
    this._preds[v] = {};
    this._out[v] = {};
    this._sucs[v] = {};
    return this;
  }

  node(v: NodeId): unknown {
    return this._nodes[v];
  }

  hasNode(v: string): boolean {
    return v in this._nodes;
  }

  removeNode(v: NodeId): Graph {
    const self = this;
    if (v in this._nodes) {
      const removeEdge = (e: EdgeId) => {
        self.removeEdge(self._edgeObjs[e]);
      };
      delete this._nodes[v];
      if (this._isCompound) {
        this._removeFromParentsChildList(v);
        delete this._parent[v];
        each(this.children(v), function (child) {
          self.setParent(child);
        });
        delete this._children[v];
      }
      each(Object.keys(this._in[v]), removeEdge);
      delete this._in[v];
      delete this._preds[v];
      each(Object.keys(this._out[v]), removeEdge);
      delete this._out[v];
      delete this._sucs[v];
    }
    return this;
  }

  setParent(v, parent?) {
    if (!this._isCompound) {
      throw new Error('Cannot set parent in a non-compound graph');
    }

    if (isUndefined(parent)) {
      parent = GRAPH_NODE;
    } else {
      // Coerce parent to string
      parent += '';
      for (
        let ancestor = parent;
        !isUndefined(ancestor);
        ancestor = this.parent(ancestor)
      ) {
        if (ancestor === v) {
          throw new Error(
            'Setting ' +
              parent +
              ' as parent of ' +
              v +
              ' would create a cycle',
          );
        }
      }

      this.setNode(parent);
    }

    this.setNode(v);
    this._removeFromParentsChildList(v);
    this._parent[v] = parent;
    this._children[parent][v] = true;
    return this;
  }

  _removeFromParentsChildList(v) {
    delete this._children[this._parent[v]][v];
  }

  parent(v) {
    if (this._isCompound) {
      const parent = this._parent[v];
      if (parent !== GRAPH_NODE) {
        return parent;
      }
    }
  }

  children(v) {
    if (isUndefined(v)) {
      v = GRAPH_NODE;
    }

    if (this._isCompound) {
      const children = this._children[v];
      if (children) {
        return Object.keys(children);
      }
    } else if (v === GRAPH_NODE) {
      return this.nodes();
    } else if (this.hasNode(v)) {
      return [];
    }
  }

  predecessors(v: NodeId): NodeId[] {
    const predsV = this._preds[v];
    if (!predsV) return [];
    return Object.keys(predsV);
  }

  successors(v: NodeId): NodeId[] {
    const sucsV = this._sucs[v];
    if (!sucsV) return [];
    return Object.keys(sucsV);
  }

  neighbors(v: NodeId): NodeId[] {
    return union(this.predecessors(v), this.successors(v));
  }

  isLeaf(v: NodeId): boolean {
    let neighbors;
    if (this.isDirected()) {
      neighbors = this.successors(v);
    } else {
      neighbors = this.neighbors(v);
    }
    return neighbors.length === 0;
  }

  filterNodes(filter: (v: NodeId) => boolean): Graph {
    const copy = new Graph({
      directed: this._isDirected,
      multigraph: this._isMultigraph,
      compound: this._isCompound,
    });

    copy.setGraph(this.graph());

    const self = this;
    each(this._nodes, function (value, v) {
      if (filter(v)) {
        copy.setNode(v, value);
      }
    });

    each(this._edgeObjs, function (e) {
      if (copy.hasNode(e.v) && copy.hasNode(e.w)) {
        copy.setEdge(e, self.edge(e));
      }
    });

    const parents = {};

    function findParent(v) {
      const parent = self.parent(v);
      if (parent === undefined || copy.hasNode(parent)) {
        parents[v] = parent;
        return parent;
      } else if (parent in parents) {
        return parents[parent];
      } else {
        return findParent(parent);
      }
    }

    if (this._isCompound) {
      each(copy.nodes(), function (v) {
        copy.setParent(v, findParent(v));
      });
    }

    return copy;
  }

  /* === Edge functions ========== */

  setDefaultEdgeLabel(newDefault) {
    if (!isFunction(newDefault)) {
      newDefault = constant(newDefault);
    }
    this._defaultEdgeLabelFn = newDefault;
    return this;
  }

  edgeCount(): number {
    return this.edges().length;
  }

  edges(): Edge[] {
    return values(this._edgeObjs);
  }

  setPath(vs, value) {
    const self = this;
    const args = arguments;
    reduce(vs, function (v, w) {
      if (args.length > 1) {
        self.setEdge(v, w, value);
      } else {
        self.setEdge(v, w);
      }
      return w;
    });
    return this;
  }

  /*
   * setEdge(v, w, [value, [name]])
   * setEdge({ v, w, [name] }, [value])
   */
  setEdge(v: string, w: string, label?: any, name?: string): Graph;
  setEdge(edge: Edge, label?: any): Graph;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setEdge(...args: any[]) {
    let v, w, name, value;
    let valueSpecified = false;
    const arg0 = arguments[0];

    if (typeof arg0 === 'object' && arg0 !== null && 'v' in arg0) {
      v = arg0.v;
      w = arg0.w;
      name = arg0.name;
      if (arguments.length === 2) {
        value = arguments[1];
        valueSpecified = true;
      }
    } else {
      v = arg0;
      w = arguments[1];
      name = arguments[3];
      if (arguments.length > 2) {
        value = arguments[2];
        valueSpecified = true;
      }
    }

    v = '' + v;
    w = '' + w;
    if (!isUndefined(name)) {
      name = '' + name;
    }

    const e = edgeArgsToId(this._isDirected, v, w, name);
    if (e in this._edgeLabels) {
      if (valueSpecified) {
        this._edgeLabels[e] = value;
      }
      return this;
    }

    if (!isUndefined(name) && !this._isMultigraph) {
      throw new Error('Cannot set a named edge when isMultigraph = false');
    }

    // It didn't exist, so we need to create it.
    // First ensure the nodes exist.
    this.setNode(v);
    this.setNode(w);

    this._edgeLabels[e] = valueSpecified
      ? value
      : this._defaultEdgeLabelFn(v, w, name);

    const edgeObj = edgeArgsToObj(this._isDirected, v, w, name);
    // Ensure we add undirected edges in a consistent way.
    v = edgeObj.v;
    w = edgeObj.w;

    this._edgeObjs[e] = edgeObj;
    incrementOrInitEntry(this._preds[w], v);
    incrementOrInitEntry(this._sucs[v], w);
    this._in[w][e] = edgeObj;
    this._out[v][e] = edgeObj;
    return this;
  }

  edge(v: NodeId, w?: NodeId, name?: string): unknown {
    const e =
      arguments.length === 1
        ? edgeObjToId(this._isDirected, arguments[0])
        : edgeArgsToId(this._isDirected, v, w, name);
    return this._edgeLabels[e];
  }

  hasEdge(v: NodeId, w: NodeId, name?: string): boolean {
    const e =
      arguments.length === 1
        ? edgeObjToId(this._isDirected, arguments[0])
        : edgeArgsToId(this._isDirected, v, w, name);
    return e in this._edgeLabels;
  }

  removeEdge(v: Edge | NodeId, w?: NodeId, name?: string): Graph {
    const e =
      arguments.length === 1
        ? edgeObjToId(this._isDirected, arguments[0])
        : edgeArgsToId(this._isDirected, v, w, name);
    const edge = this._edgeObjs[e];
    if (edge) {
      v = edge.v;
      w = edge.w;
      delete this._edgeLabels[e];
      delete this._edgeObjs[e];
      decrementOrRemoveEntry(this._preds[w], v);
      decrementOrRemoveEntry(this._sucs[v], w);
      delete this._in[w][e];
      delete this._out[v][e];
    }
    return this;
  }

  inEdges(v: NodeId, u?: NodeId): Edge[] {
    const inV = this._in[v];
    if (inV) {
      const edges = values(inV);
      if (!u) {
        return edges;
      }
      return _filter(edges, function (edge) {
        return edge.v === u;
      });
    }
    return [];
  }

  outEdges(v: NodeId, w?: NodeId): Edge[] {
    const outV = this._out[v];
    if (outV) {
      const edges = values(outV);
      if (!w) {
        return edges;
      }
      return _filter(edges, function (edge) {
        return edge.w === w;
      });
    }
    return [];
  }

  nodeEdges(v: NodeId, w?: NodeId): Edge[] {
    return this.inEdges(v, w).concat(this.outEdges(v, w));
  }
}

function incrementOrInitEntry(map: AdjacencyCounts, k: NodeId): void {
  if (map[k]) {
    map[k]++;
  } else {
    map[k] = 1;
  }
}

function decrementOrRemoveEntry(map: AdjacencyCounts, k: NodeId): void {
  if (!--map[k]) {
    delete map[k];
  }
}

function edgeArgsToId(isDirected, v_, w_, name) {
  let v = '' + v_;
  let w = '' + w_;
  if (!isDirected && v > w) {
    const tmp = v;
    v = w;
    w = tmp;
  }
  return (
    v +
    EDGE_KEY_DELIM +
    w +
    EDGE_KEY_DELIM +
    (isUndefined(name) ? DEFAULT_EDGE_NAME : name)
  );
}

function edgeArgsToObj(isDirected, v_, w_, name): Edge {
  let v = '' + v_;
  let w = '' + w_;
  if (!isDirected && v > w) {
    const tmp = v;
    v = w;
    w = tmp;
  }
  const edgeObj: Edge = { v: v, w: w };
  if (name) {
    edgeObj.name = name;
  }
  return edgeObj;
}

function edgeObjToId(isDirected, edgeObj) {
  return edgeArgsToId(isDirected, edgeObj.v, edgeObj.w, edgeObj.name);
}
