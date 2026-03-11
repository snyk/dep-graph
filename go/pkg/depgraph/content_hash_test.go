package depgraph

import (
	_ "embed"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Fixtures from test/fixtures/equals/ — structurally same or different for ContentHash tests.
var (
	//go:embed testdata/equals/simple.json
	contentHashSimple []byte
	//go:embed testdata/equals/simple-different-root.json
	contentHashSimpleDifferentRoot []byte
	//go:embed testdata/equals/simple-one-more-child.json
	contentHashSimpleOneMoreChild []byte
	//go:embed testdata/equals/simple-with-label.json
	contentHashSimpleWithLabel []byte
	//go:embed testdata/equals/different-node-id-a.json
	contentHashDifferentNodeIDA []byte
	//go:embed testdata/equals/different-node-id-b.json
	contentHashDifferentNodeIDB []byte
	//go:embed testdata/equals/simple-wrong-nodes-order-a.json
	contentHashWrongOrderA []byte
	//go:embed testdata/equals/simple-wrong-nodes-order-b.json
	contentHashWrongOrderB []byte
	//go:embed testdata/equals/simple-different-minor-version.json
	contentHashDifferentMinorVersion []byte
	//go:embed testdata/equals/cycles/simple-a.json
	contentHashCyclesSimpleA []byte
	//go:embed testdata/equals/cycles/simple-b.json
	contentHashCyclesSimpleB []byte
	//go:embed testdata/equals/cycles/one-node-cycle-a.json
	contentHashCyclesOneNodeA []byte
	//go:embed testdata/equals/cycles/one-node-cycle-b.json
	contentHashCyclesOneNodeB []byte
)

func mustParseContentHash(t *testing.T, data []byte) *DepGraph {
	t.Helper()
	dg, err := UnmarshalJSON(data)
	require.NoError(t, err)
	return dg
}

// --- ContentHash tests ---

func TestContentHash_StructurallySameGraphs_SameHash(t *testing.T) {
	// Same dependency structure, different root pkg version (simple vs simple-different-root)
	a := mustParseContentHash(t, contentHashSimple)
	b := mustParseContentHash(t, contentHashSimpleDifferentRoot)

	hashA := a.ContentHash()
	hashB := b.ContentHash()

	require.NotNil(t, hashA)
	require.NotNil(t, hashB)
	assert.Equal(t, hashA, hashB, "structurally same graphs must produce same content hash")
}

func TestContentHash_SameGraphDifferentNodeIDs_SameHash(t *testing.T) {
	a := mustParseContentHash(t, contentHashDifferentNodeIDA)
	b := mustParseContentHash(t, contentHashDifferentNodeIDB)

	assert.Equal(t, a.ContentHash(), b.ContentHash())
}

func TestContentHash_UnequalGraphs_DifferentHash(t *testing.T) {
	a := mustParseContentHash(t, contentHashSimple)
	b := mustParseContentHash(t, contentHashSimpleOneMoreChild)

	assert.NotEqual(t, a.ContentHash(), b.ContentHash())
}

func TestContentHash_Deterministic_SameGraphSameHash(t *testing.T) {
	a := mustParseContentHash(t, contentHashSimple)

	h1 := a.ContentHash()
	h2 := a.ContentHash()

	assert.Equal(t, h1, h2)
}

func TestContentHash_DifferentStructure_DifferentHash(t *testing.T) {
	a := mustParseContentHash(t, contentHashSimple)
	b := mustParseContentHash(t, contentHashSimpleWithLabel)

	assert.NotEqual(t, a.ContentHash(), b.ContentHash(), "graphs with different structure (e.g. extra label) must have different hash")
}

func TestContentHash_DifferentMinorVersion_DifferentHash(t *testing.T) {
	// simple vs simple-different-minor-version: same shape but different package versions (e.g. d@0.0.1/0.0.2 vs d@0.0.7)
	a := mustParseContentHash(t, contentHashSimple)
	b := mustParseContentHash(t, contentHashDifferentMinorVersion)

	assert.NotEqual(t, a.ContentHash(), b.ContentHash(), "graphs with different package versions must have different hashes")
}

func TestContentHash_WrongNodesOrderAAndB_DifferentHash(t *testing.T) {
	// wrong-nodes-order-a: a->c|1->d, b->c|2->e; wrong-nodes-order-b: a->c|2->e, b->c|1->d (which c leads to d vs e is swapped)
	a := mustParseContentHash(t, contentHashWrongOrderA)
	b := mustParseContentHash(t, contentHashWrongOrderB)

	assert.NotEqual(t, a.ContentHash(), b.ContentHash(), "graphs that differ by which branch reaches d vs e must have different hashes")
}

func TestContentHash_EmptyGraph_ReturnsNonNil(t *testing.T) {
	dg := New()
	require.NoError(t, dg.BuildGraph())

	h := dg.ContentHash()
	require.NotNil(t, h)
	assert.NotEmpty(t, h)
}

// --- ContentHash tests with cycle fixtures ---

func TestContentHash_SameGraphWithCycles_SameHash(t *testing.T) {
	// Same graph with cycle (root -> a -> b -> c -> a) loaded twice
	a := mustParseContentHash(t, contentHashCyclesSimpleA)
	b := mustParseContentHash(t, contentHashCyclesSimpleA)

	hashA := a.ContentHash()
	hashB := b.ContentHash()

	require.NotNil(t, hashA)
	require.NotNil(t, hashB)
	assert.Equal(t, hashA, hashB, "same graph with cycles must produce same hash when loaded twice")
}

func TestContentHash_DifferentGraphsWithCycles_DifferentHash(t *testing.T) {
	// simple-a: root -> a -> b -> c -> a; simple-b: root -> a -> b -> c -> [a, b]
	a := mustParseContentHash(t, contentHashCyclesSimpleA)
	b := mustParseContentHash(t, contentHashCyclesSimpleB)

	assert.NotEqual(t, a.ContentHash(), b.ContentHash(), "different cyclic graphs must have different hashes")
}

func TestContentHash_OneNodeCycleVsNoCycle_DifferentHash(t *testing.T) {
	// one-node-cycle-a: root -> A -> A (self-loop); one-node-cycle-b: root -> A -> B (no cycle)
	a := mustParseContentHash(t, contentHashCyclesOneNodeA)
	b := mustParseContentHash(t, contentHashCyclesOneNodeB)

	assert.NotEqual(t, a.ContentHash(), b.ContentHash(), "graph with self-loop vs graph without cycle must have different hashes")
}
