package depgraph

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDepGraph_UnmarshalJSON_RealWorldExample(t *testing.T) {
	payload := []byte(`{
		"schemaVersion": "1.1.0",
		"pkgManager": {"name": "cocoapods"},
		"pkgs": [
			{"id": "root@1.0.0", "info": {"name": "root", "version": "1.0.0"}}
		],
		"graph": {
			"rootNodeId": "root-node",
			"nodes": [
				{
					"nodeId": "root-node",
					"pkgId": "root@1.0.0",
					"deps": [],
					"info": {
						"labels": {
							"externalSourceBranch": 300,
							"normal": "value"
						}
					}
				}
			]
		}
	}`)

	dg, err := UnmarshalJSON(payload)
	require.NoError(t, err)

	require.NotNil(t, dg.Graph.Nodes[0].Info)
	assert.Equal(t, Labels{
		"externalSourceBranch": "300",
		"normal":               "value",
	}, dg.Graph.Nodes[0].Info.Labels)
}

func TestLabels_UnmarshalJSON(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    Labels
		wantErr string // substring match; empty means no error
	}{
		// happy paths
		{name: "empty object", input: `{}`, want: Labels{}},
		{name: "top-level null", input: `null`, want: nil},
		{name: "string value", input: `{"k":"v"}`, want: Labels{"k": "v"}},
		{name: "empty string value", input: `{"k":""}`, want: Labels{"k": ""}},
		{name: "unicode string", input: `{"k":"héllo"}`, want: Labels{"k": "héllo"}},
		{
			name:  "padded whitespace around values",
			input: "{\n\t\"num\":   300  ,\n\t\"str\" :\t\"value\" ,\n\t\"bool\":\n\t\ttrue ,\n\t\"nul\" : null\n}",
			want:  Labels{"num": "300", "str": "value", "bool": "true"},
		},

		// numeric coercion (the reported bug)
		{name: "integer", input: `{"k":300}`, want: Labels{"k": "300"}},
		{name: "negative integer", input: `{"k":-1}`, want: Labels{"k": "-1"}},
		{name: "float", input: `{"k":1.5}`, want: Labels{"k": "1.5"}},
		{name: "scientific notation", input: `{"k":1e10}`, want: Labels{"k": "1e10"}},
		{
			name:  "large int preserved",
			input: `{"k":12345678901234567890}`,
			want:  Labels{"k": "12345678901234567890"},
		},

		// bool / null
		{name: "true", input: `{"k":true}`, want: Labels{"k": "true"}},
		{name: "false", input: `{"k":false}`, want: Labels{"k": "false"}},
		{name: "null value omits key", input: `{"k":null}`, want: Labels{}},
		{
			name:  "only null values yields empty map",
			input: `{"a":null,"b":null}`,
			want:  Labels{},
		},

		// mixed
		{
			name:  "mixed types",
			input: `{"a":1,"b":"x","c":true,"d":null}`,
			want:  Labels{"a": "1", "b": "x", "c": "true"},
		},

		// errors
		{
			name:    "object value",
			input:   `{"k":{"x":1}}`,
			wantErr: `unsupported label value type for key "k"`,
		},
		{
			name:    "array value",
			input:   `{"k":[1,2]}`,
			wantErr: `unsupported label value type for key "k"`,
		},
		{
			name:    "invalid json",
			input:   `{`,
			wantErr: "could not decode labels",
		},
		{
			name:    "top-level array",
			input:   `[1,2]`,
			wantErr: "could not decode labels",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var got Labels
			err := got.UnmarshalJSON([]byte(tc.input))

			if tc.wantErr != "" {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tc.wantErr)
				return
			}

			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}
