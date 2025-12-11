package depgraph

import (
	_ "embed"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//go:embed testdata/snyk_dep_graph.json
var fixedDepGraph []byte

//go:embed testdata/snyk_dep_graph_shared_dep.json
var fixedDepGraphWithSharedDep []byte

//go:embed testdata/snyk_dep_graph_cyclic.json
var fixedDepGraphWithCycles []byte

func TestUnmarshalJSON(t *testing.T) {
	depgraph, err := UnmarshalJSON(fixedDepGraph)
	require.NoError(t, err)

	assert.Equal(t, "1.1.0", depgraph.SchemaVersion)
	assert.Equal(t, PkgManager{Name: "npm"}, depgraph.PkgManager)

	assert.Len(t, depgraph.Pkgs, 3)
	assert.Equal(t, PkgInfo{Name: "demo-app-for-test", Version: "1.1.1"}, depgraph.Pkgs[0].Info)
	assert.Equal(t, PkgInfo{Name: "express", Version: "4.4.0"}, depgraph.Pkgs[1].Info)
	assert.Equal(t, PkgInfo{Name: "ws", Version: "1.0.0"}, depgraph.Pkgs[2].Info)

	assert.Equal(t, "root-node", depgraph.Graph.RootNodeID)
	assert.Len(t, depgraph.Graph.Nodes, 3)
	assert.Equal(t, "root-node", depgraph.Graph.Nodes[0].NodeID)
	assert.Equal(t, []Dependency{{"express@4.4.0"}, {"ws@1.0.0"}}, depgraph.Graph.Nodes[0].Deps)
	assert.Equal(t, "express@4.4.0", depgraph.Graph.Nodes[1].NodeID)
	assert.Equal(t, []Dependency{}, depgraph.Graph.Nodes[1].Deps)
	assert.Equal(t, "ws@1.0.0", depgraph.Graph.Nodes[2].NodeID)
	assert.Equal(t, []Dependency{}, depgraph.Graph.Nodes[2].Deps)
}

func TestNewDepGraph(t *testing.T) {
	depGraph := New()
	assert.NotNil(t, depGraph.Pkgs)
	assert.NotNil(t, depGraph.Graph.Nodes)
}

func TestUnmarshalInvalidJSON(t *testing.T) {
	_, err := UnmarshalJSON([]byte(`{"foo":true}`))
	require.Error(t, err)
	assert.Equal(t, `could not decode DepGraph: json: unknown field "foo"`, err.Error())
}

func TestMarshalJSON(t *testing.T) {
	depGraph, err := UnmarshalJSON(fixedDepGraph)
	require.NoError(t, err)

	data, err := depGraph.MarshalJSON()
	require.NoError(t, err)

	assert.JSONEq(t, string(fixedDepGraph), string(data))
}

func TestMarshalEmptyDepgraph(t *testing.T) {
	depGraph := New()

	data, err := depGraph.MarshalJSON()
	require.NoError(t, err)

	assert.Equal(
		t,
		[]byte(`{"schemaVersion":"","pkgManager":{"name":""},"pkgs":[],"graph":{"rootNodeId":"","nodes":[]}}`),
		data,
	)
}

func TestGetRootPkg_Lazy(t *testing.T) {
	depGraph, err := UnmarshalJSON(fixedDepGraph)
	require.NoError(t, err)

	rootPkg := depGraph.GetRootPkg()

	assert.NotNil(t, rootPkg)
	assert.Equal(t, "demo-app-for-test@1.1.1", rootPkg.ID)
	assert.Equal(t, PkgInfo{
		Name:    "demo-app-for-test",
		Version: "1.1.1",
	}, rootPkg.Info)
}

func TestGetRootPkg_WithRootSet(t *testing.T) {
	depGraph := New()
	depGraph.rootPkg = &Pkg{
		ID:   "some-pkg@0.0.0",
		Info: PkgInfo{Name: "some-pkg", Version: "0.0.0"},
	}

	rootPkg := depGraph.GetRootPkg()

	assert.NotNil(t, rootPkg)
	assert.Equal(t, &Pkg{
		ID: "some-pkg@0.0.0",
		Info: PkgInfo{
			Name:    "some-pkg",
			Version: "0.0.0",
		},
	}, rootPkg)
}

func TestGetPkg(t *testing.T) {
	depGraph, err := UnmarshalJSON(fixedDepGraph)
	require.NoError(t, err)

	pkg, ok := depGraph.GetPkg("ws@1.0.0")
	require.True(t, ok)
	require.NotNil(t, pkg)

	assert.Equal(t, "ws", pkg.Info.Name)
	assert.Equal(t, "1.0.0", pkg.Info.Version)
}

func TestGetPathsToPkg(t *testing.T) {
	depGraph, err := UnmarshalJSON(fixedDepGraphWithSharedDep)
	require.NoError(t, err)

	tc := map[string]struct {
		end      string
		expected [][]string
	}{
		"path to root": {
			end:      "goof@1.0.1",
			expected: [][]string{{"goof@1.0.1"}},
		},
		"path to direct dep": {
			end:      "tap@5.8.0",
			expected: [][]string{{"goof@1.0.1", "tap@5.8.0"}},
		},
		"path to transitive dep": {
			end:      "coveralls@2.13.3",
			expected: [][]string{{"goof@1.0.1", "tap@5.8.0", "coveralls@2.13.3"}},
		},
		"multiple paths to dep": {
			end: "js-yaml@3.6.1",
			expected: [][]string{
				{"goof@1.0.1", "tap@5.8.0", "coveralls@2.13.3", "js-yaml@3.6.1"},
				{"goof@1.0.1", "tap@5.8.0", "nyc@6.6.1", "istanbul@0.4.3", "js-yaml@3.6.1"},
			},
		},
	}

	for name, tt := range tc {
		t.Run(name, func(t *testing.T) {
			paths, err := depGraph.GetPathsToPkg(tt.end)
			require.NoError(t, err)

			require.Len(t, paths, len(tt.expected))
			assert.Equal(t, tt.expected, paths)
		})
	}
}

func TestGetPathsToPkg_Cycles(t *testing.T) {
	depGraph, err := UnmarshalJSON(fixedDepGraphWithCycles)
	require.NoError(t, err)

	paths, err := depGraph.GetPathsToPkg("yargs@17.7.2")
	require.NoError(t, err)

	assert.Equal(t, [][]string{{"simple-app@1.0.0", "trucolor@4.0.4", "term-ng@3.0.4", "yargs@17.7.2"}}, paths)
}

func TestNode_IsPruned(t *testing.T) {
	n := &Node{
		NodeID: "foobar@1.2.3",
		PkgID:  "foobar@1.2.3",
	}

	assert.False(t, n.IsPruned())

	n = &Node{
		NodeID: "foobar@1.2.3|2",
		PkgID:  "foobar@1.2.3",
		Info: &NodeInfo{
			Labels: map[string]string{
				"pruned": "true",
			},
		},
	}

	assert.True(t, n.IsPruned())
}
