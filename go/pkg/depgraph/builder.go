package depgraph

import (
	"errors"
	"fmt"

	"github.com/elliotchance/orderedmap/v3"
)

type Builder struct {
	schemaVersion string
	rootNodeID    string
	rootPkgID     string
	pkgManager    *PkgManager
	pkgs          *orderedmap.OrderedMap[string, *Pkg]
	nodes         *orderedmap.OrderedMap[string, *Node]
}

const (
	schemaVersion = "1.3.0"
	rootNodeID    = "root-node"
)

func NewBuilder(pkgManager *PkgManager, rootPkg *PkgInfo) (*Builder, error) {
	if pkgManager == nil {
		return nil, errors.New("cannot create builder without a package manager")
	}

	if rootPkg == nil {
		rootPkg = &PkgInfo{
			Name:    "_root",
			Version: "unknown",
		}
	}

	b := &Builder{
		schemaVersion: schemaVersion,
		pkgManager:    pkgManager,
		rootNodeID:    rootNodeID,
		rootPkgID:     getPkgID(rootPkg),
		pkgs:          orderedmap.NewOrderedMap[string, *Pkg](),
		nodes:         orderedmap.NewOrderedMap[string, *Node](),
	}

	b.addNode(b.rootNodeID, rootPkg)

	return b, nil
}

func (b *Builder) Build() *DepGraph {
	dg := &DepGraph{
		SchemaVersion: b.schemaVersion,
		PkgManager:    *b.pkgManager,
		Pkgs:          b.GetPkgs(),
		rootPkg:       b.pkgs.GetOrDefault(b.rootPkgID, nil),
		pkgIdx:        make(map[string]*Pkg),
		Graph: Graph{
			RootNodeID: b.rootNodeID,
			Nodes:      make([]Node, b.nodes.Len()),
		},
	}

	var i int
	for _, node := range b.nodes.AllFromFront() {
		nodeID := node.NodeID
		pkgID := node.PkgID
		deps := node.Deps
		info := node.Info
		pkg := b.pkgs.GetOrDefault(pkgID, nil)

		dg.pkgIdx[pkg.ID] = pkg
		dg.Graph.Nodes[i] = Node{
			NodeID: nodeID,
			PkgID:  pkgID,
			Info:   info,
			Deps:   deps,
		}

		i++
	}

	return dg
}

func (b *Builder) GetPkgManager() *PkgManager {
	return b.pkgManager
}

func (b *Builder) GetPkgs() []Pkg {
	pkgs := make([]Pkg, 0, b.pkgs.Len())

	for _, pkg := range b.pkgs.AllFromFront() {
		pkgs = append(pkgs, *pkg)
	}

	return pkgs
}

func (b *Builder) GetRootNode() *Node {
	return b.nodes.GetOrDefault(b.rootNodeID, nil)
}

type nodeOpt = func(*Node)

func WithNodeInfo(info *NodeInfo) nodeOpt {
	return func(node *Node) {
		node.Info = info
	}
}

func (b *Builder) AddNode(nodeID string, pkgInfo *PkgInfo, opts ...nodeOpt) *Node {
	node := b.addNode(nodeID, pkgInfo)

	for _, opt := range opts {
		opt(node)
	}

	return node
}

func (b *Builder) addNode(nodeID string, pkgInfo *PkgInfo) *Node {
	if n, ok := b.nodes.Get(nodeID); ok {
		return n
	}
	pkgID := getPkgID(pkgInfo)

	b.pkgs.Set(pkgID, &Pkg{
		ID:   pkgID,
		Info: *pkgInfo,
	})

	b.nodes.Set(nodeID, &Node{
		NodeID: nodeID,
		PkgID:  pkgID,
		Deps:   make([]Dependency, 0),
	})

	return b.nodes.GetOrDefault(nodeID, nil)
}

func (b *Builder) ConnectNodes(parentNodeID, childNodeID string) error {
	parentNode, ok := b.nodes.Get(parentNodeID)
	if !ok {
		return fmt.Errorf("cound not find parent node %s", parentNodeID)
	}

	childNode, ok := b.nodes.Get(childNodeID)
	if !ok {
		return fmt.Errorf("cound not find child node %s", childNodeID)
	}

	parentNode.Deps = append(parentNode.Deps, Dependency{
		NodeID: childNode.NodeID,
	})

	return nil
}

func getPkgID(pkgInfo *PkgInfo) string {
	return fmt.Sprintf("%s@%s", pkgInfo.Name, pkgInfo.Version)
}
