package depgraph

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuilder_Basics(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, nil)
	require.NoError(t, err)

	dg := builder.Build()

	assert.Equal(t, "1.3.0", dg.SchemaVersion)
	assert.Equal(t, "golang", dg.PkgManager.Name)
	assert.Len(t, dg.Pkgs, 1)
	assert.Equal(t, "_root", dg.Pkgs[0].Info.Name)
	assert.Equal(t, "unknown", dg.Pkgs[0].Info.Version)
	assert.Equal(t, "root-node", dg.Graph.RootNodeID)
	assert.Len(t, dg.Graph.Nodes, 1)
	assert.Equal(t, "root-node", dg.Graph.Nodes[0].NodeID)
	assert.Equal(t, "_root@unknown", dg.Graph.Nodes[0].PkgID)
	assert.Len(t, dg.Graph.Nodes[0].Deps, 0)
}

func TestBuilder_GetPkgManager(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, nil)
	require.NoError(t, err)

	pkgManager := builder.GetPkgManager()

	assert.Equal(t, "golang", pkgManager.Name)
}

func TestBuilder_RootPkg(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, &PkgInfo{Name: "project", Version: "VERSION"})
	require.NoError(t, err)

	dg := builder.Build()

	assert.Equal(t, "project", dg.Pkgs[0].Info.Name)
	assert.Equal(t, "VERSION", dg.Pkgs[0].Info.Version)
}

func TestBuilder_AddNode(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, nil)
	require.NoError(t, err)

	builder.AddNode("dep@VERSION", &PkgInfo{Name: "dep", Version: "VERSION"})
	dg := builder.Build()

	assert.Len(t, dg.Pkgs, 2)
	assert.Len(t, dg.Graph.Nodes, 2)
}

func TestBuilder_AddNode_Existing(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, nil)
	require.NoError(t, err)

	builder.AddNode("dep@VERSION", &PkgInfo{Name: "dep", Version: "VERSION"})
	firstEntry := builder.nodes.GetOrDefault("dep@VERSION", nil)
	require.NotNil(t, firstEntry)
	assert.Equal(t, firstEntry, builder.AddNode("dep@VERSION", &PkgInfo{Name: "dep", Version: "VERSION"}))
}

func TestBuilder_ConnectNodes(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, nil)
	require.NoError(t, err)

	node := builder.AddNode("dep@VERSION", &PkgInfo{Name: "dep", Version: "VERSION"})
	err = builder.ConnectNodes(builder.rootNodeID, node.NodeID)
	require.NoError(t, err)

	dg := builder.Build()

	require.Len(t, dg.Graph.Nodes, 2)
	require.Len(t, dg.Graph.Nodes[0].Deps, 1)
	require.Equal(t, "root-node", dg.Graph.Nodes[0].NodeID)
	assert.Equal(t, "dep@VERSION", dg.Graph.Nodes[0].Deps[0].NodeID)
}

func TestBuilder_GetRootNode(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, &PkgInfo{Name: "root-pkg", Version: "1.2.3"})
	require.NoError(t, err)

	root := builder.GetRootNode()

	assert.NotNil(t, root)
	assert.Equal(t, "root-node", root.NodeID)
	assert.Equal(t, "root-pkg@1.2.3", root.PkgID)
}

func TestBuilder_Build(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, nil)
	require.NoError(t, err)

	node := builder.AddNode("dep@1.0.0", &PkgInfo{Name: "dep", Version: "1.0.0"})
	node.Info = &NodeInfo{
		VersionProvenance: &VersionProvenance{
			Type:     "file",
			Location: "deps.txt",
			Property: &Property{Name: "dep"},
		},
		Labels: map[string]string{
			"scope": "prod",
		},
	}

	dg := builder.Build()

	assert.NotNil(t, dg.rootPkg)
	assert.Equal(t, &Pkg{ID: "_root@unknown", Info: PkgInfo{Name: "_root", Version: "unknown"}}, dg.rootPkg)

	require.Len(t, dg.Graph.Nodes, 2)
	depNode := dg.Graph.Nodes[1]
	require.NotNil(t, depNode.Info)
	assert.Equal(t, "file", depNode.Info.VersionProvenance.Type)
	assert.Equal(t, "deps.txt", depNode.Info.VersionProvenance.Location)
	assert.Equal(t, "dep", depNode.Info.VersionProvenance.Property.Name)
	assert.Equal(t, "prod", depNode.Info.Labels["scope"])
}

func TestBuilder_Build_GetPkg(t *testing.T) {
	builder, err := NewBuilder(&PkgManager{Name: "golang"}, &PkgInfo{Name: "root-pkg", Version: "1.2.3"})
	require.NoError(t, err)

	dg := builder.Build()

	pkg, ok := dg.GetPkg("root-pkg@1.2.3")
	require.True(t, ok)
	require.NotNil(t, pkg)

	assert.Equal(t, &Pkg{ID: "root-pkg@1.2.3", Info: PkgInfo{Name: "root-pkg", Version: "1.2.3"}}, pkg)
}
