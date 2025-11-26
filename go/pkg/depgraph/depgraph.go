package depgraph

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type (
	DepGraph struct {
		SchemaVersion string     `json:"schemaVersion"`
		PkgManager    PkgManager `json:"pkgManager"`
		Pkgs          []Pkg      `json:"pkgs"`
		Graph         Graph      `json:"graph"`

		rootPkg  *Pkg             `json:"-"`
		rootNode *Node            `json:"-"`
		pkgIdx   map[string]*Pkg  `json:"-"`
		nodeIdx  map[string]*Node `json:"-"`
	}

	PkgManager struct {
		Name         string       `json:"name"`
		Version      string       `json:"version,omitempty"`
		Repositories []Repository `json:"repositories,omitempty"`
	}

	Repository struct {
		Alias string `json:"alias"`
	}

	Pkg struct {
		ID   string  `json:"id"`
		Info PkgInfo `json:"info"`

		nodes []*Node
	}

	PkgInfo struct {
		Name       string `json:"name"`
		Version    string `json:"version,omitempty"`
		PackageURL string `json:"purl,omitempty"`
	}

	Graph struct {
		RootNodeID string `json:"rootNodeId"`
		Nodes      []Node `json:"nodes"`
	}

	Node struct {
		NodeID string       `json:"nodeId"`
		PkgID  string       `json:"pkgId"`
		Info   *NodeInfo    `json:"info,omitempty"`
		Deps   []Dependency `json:"deps"`

		pkg  *Pkg
		deps []*Node
	}

	NodeInfo struct {
		VersionProvenance *VersionProvenance `json:"versionProvenance,omitempty"`
		Labels            map[string]string  `json:"labels,omitempty"`
	}

	Dependency struct {
		NodeID string `json:"nodeId"`
	}

	VersionProvenance struct {
		Type     string    `json:"type"`
		Location string    `json:"location"`
		Property *Property `json:"property,omitempty"`
	}

	Property struct {
		Name string `json:"name"`
	}
)

func New() *DepGraph {
	return &DepGraph{
		Pkgs: make([]Pkg, 0),
		Graph: Graph{
			Nodes: make([]Node, 0),
		},
	}
}

func UnmarshalJSON(data []byte) (*DepGraph, error) {
	dg := new(DepGraph)
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()

	if err := dec.Decode(&dg); err != nil {
		return nil, fmt.Errorf("could not decode DepGraph: %w", err)
	}

	if err := dg.BuildGraph(); err != nil {
		return nil, fmt.Errorf("invalid graph: %w", err)
	}

	return dg, nil
}

func (dg *DepGraph) MarshalJSON() ([]byte, error) {
	data, err := json.Marshal(*dg)
	if err != nil {
		return nil, fmt.Errorf("could not encode DepGraph: %w", err)
	}
	return data, nil
}

func (dg *DepGraph) GetRootPkg() *Pkg {
	if dg.rootPkg != nil {
		return dg.rootPkg
	}

	for _, dep := range dg.Graph.Nodes {
		if dep.NodeID != dg.Graph.RootNodeID {
			continue
		}

		for _, pkg := range dg.Pkgs {
			if pkg.ID != dep.PkgID {
				continue
			}

			dg.rootPkg = &pkg
			break
		}
	}

	return dg.rootPkg
}

func (dg *DepGraph) GetPkg(id string) (*Pkg, bool) {
	if dg.pkgIdx == nil {
		panic("prior call to DepGraph.BuildGraph required")
	}

	if pkg, ok := dg.pkgIdx[id]; ok {
		return pkg, ok
	}

	return nil, false
}

func (dg *DepGraph) BuildGraph() error {
	dg.indexPkgs()
	if err := dg.indexNodes(); err != nil {
		return fmt.Errorf("failed to build graph: %w", err)
	}
	return nil
}

func (dg *DepGraph) GetPathsToPkg(id string) ([][]string, error) {
	if dg.pkgIdx == nil || dg.nodeIdx == nil {
		panic("prior call to DepGraph.BuildGraph required")
	}

	pkg, ok := dg.pkgIdx[id]
	if !ok {
		return nil, fmt.Errorf("unknown package %q", id)
	}

	var paths [][]string
	for _, node := range pkg.nodes {
		path := dg.findPath(dg.rootNode, node, make(map[*Node]struct{}))
		if path != nil {
			var p []string
			for _, node := range path {
				p = append(p, node.PkgID)
			}
			paths = append(paths, p)
		}
	}

	return paths, nil
}

func (dg *DepGraph) findPath(start, end *Node, visited map[*Node]struct{}) []*Node {
	path := []*Node{start}

	// base case: if we reached end already, we can return it.
	if start == end {
		return path
	}

	// check for cycle
	if _, ok := visited[start]; ok {
		return nil
	}

	visited[start] = struct{}{}

	// recurse through dependencies
	for _, dep := range start.deps {
		p := dg.findPath(dep, end, visited)
		if p != nil {
			return append([]*Node{start}, p...)
		}
	}

	// reached the end without a match
	return nil
}

func (dg *DepGraph) indexPkgs() {
	if dg.pkgIdx != nil {
		return
	}

	dg.pkgIdx = make(map[string]*Pkg)
	for i := range dg.Pkgs {
		dg.pkgIdx[dg.Pkgs[i].ID] = &dg.Pkgs[i]
	}
}

func (dg *DepGraph) indexNodes() error {
	dg.nodeIdx = make(map[string]*Node)
	for i := range dg.Graph.Nodes {
		node := &dg.Graph.Nodes[i]

		// index node
		dg.nodeIdx[node.NodeID] = node

		// set root node
		if node.NodeID == dg.Graph.RootNodeID {
			dg.rootNode = node
		}

		// reference package
		pkg, ok := dg.GetPkg(node.PkgID)
		if !ok {
			return fmt.Errorf("node %q references unknown package %q", node.NodeID, node.PkgID)
		}

		node.pkg = pkg
		pkg.nodes = append(pkg.nodes, node)
	}

	for _, node := range dg.nodeIdx {
		for _, dep := range node.Deps {
			depNode, ok := dg.nodeIdx[dep.NodeID]
			if !ok {
				return fmt.Errorf("node %q depends on unknown node %q", node.NodeID, dep.NodeID)
			}
			node.deps = append(node.deps, depNode)
		}
	}

	return nil
}
