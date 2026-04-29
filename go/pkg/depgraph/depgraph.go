package depgraph

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"sort"
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
		Labels            Labels             `json:"labels,omitempty"`
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

func (dg *DepGraph) ValidateGraph() error {
	if err := dg.validateRootNotReferenced(); err != nil {
		return fmt.Errorf("failed to validate graph: %w", err)
	}
	return nil
}

func (dg *DepGraph) validateRootNotReferenced() error {
	rootNodeID := dg.Graph.RootNodeID
	for _, node := range dg.Graph.Nodes {
		for _, dep := range node.Deps {
			if dep.NodeID == rootNodeID {
				return fmt.Errorf("dependency graph root %q is referenced as a dependency", rootNodeID)
			}
		}
	}

	return nil
}

// ContentHash returns a deterministic hash of the graph structure for content-addressing.
// Structurally equivalent graphs (same deps, PkgInfo, NodeInfo; root package may differ) must produce the same hash.
// If BuildGraph hasn't been called already on the DepGraph, this function will invoke the method first.
func (dg *DepGraph) ContentHash() []byte {
	if dg.pkgIdx == nil || dg.nodeIdx == nil {
		if err := dg.BuildGraph(); err != nil {
			return nil
		}
	}
	if dg.rootNode == nil {
		// Empty or invalid graph: still return a deterministic hash
		h := sha256.Sum256([]byte("depgraph:empty"))
		return h[:]
	}
	visited := make(map[*Node]struct{})
	w := &bytes.Buffer{}
	dg.hashGraphRecursively(dg.rootNode, visited, w)
	sum := sha256.Sum256(w.Bytes())
	return sum[:]
}

// getPkgIDFromPkg returns a canonical package id (name@version) for sorting and hashing.
func getPkgIDFromPkg(pkg *Pkg) string {
	if pkg == nil {
		return ""
	}
	return getPkgIDFromPkgInfo(&pkg.Info)
}

func (dg *DepGraph) hashGraphRecursively(node *Node, visited map[*Node]struct{}, w *bytes.Buffer) {
	if node == nil {
		return
	}
	if _, ok := visited[node]; ok {
		// Cycle: write deterministic marker (pkgId only, no nodeId)
		w.WriteString("cycle:")
		w.WriteString(getPkgIDFromPkg(node.pkg))
		w.WriteByte(0)
		return
	}
	visited[node] = struct{}{}
	defer func() { delete(visited, node) }()

	if node.pkg != nil && node != dg.rootNode {
		// PkgInfo: name, version, purl (canonical order)
		w.WriteString("pkg:")
		w.WriteString(node.pkg.Info.Name)
		w.WriteByte(0)
		w.WriteString(node.pkg.Info.Version)
		w.WriteByte(0)
		w.WriteString(node.pkg.Info.PackageURL)
		w.WriteByte(0)
		// NodeInfo
		if node.Info != nil {
			w.WriteString("info:")
			if node.Info.VersionProvenance != nil {
				w.WriteString(node.Info.VersionProvenance.Type)
				w.WriteByte(0)
				w.WriteString(node.Info.VersionProvenance.Location)
				w.WriteByte(0)
				if node.Info.VersionProvenance.Property != nil {
					w.WriteString(node.Info.VersionProvenance.Property.Name)
				}
				w.WriteByte(0)
			}
			if len(node.Info.Labels) > 0 {
				keys := make([]string, 0, len(node.Info.Labels))
				for k := range node.Info.Labels {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				for _, k := range keys {
					w.WriteString(k)
					w.WriteByte(0)
					w.WriteString(node.Info.Labels[k])
					w.WriteByte(0)
				}
			}
		}
	}

	// Sort deps by getPkgId (match TS) then recurse
	deps := make([]*Node, len(node.deps))
	copy(deps, node.deps)
	sort.Slice(deps, func(i, j int) bool {
		pi, pj := getPkgIDFromPkg(deps[i].pkg), getPkgIDFromPkg(deps[j].pkg)
		return pi < pj
	})
	for _, dep := range deps {
		dg.hashGraphRecursively(dep, visited, w)
	}
}
