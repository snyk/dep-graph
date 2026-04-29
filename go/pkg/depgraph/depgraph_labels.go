package depgraph

import (
	"bytes"
	"encoding/json"
	"fmt"
)

type Labels map[string]string

func (l *Labels) UnmarshalJSON(data []byte) error {
	var raw map[string]json.RawMessage
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	if err := dec.Decode(&raw); err != nil {
		return fmt.Errorf("could not decode labels: %w", err)
	}

	if raw == nil {
		*l = nil
		return nil
	}

	labels := make(Labels, len(raw))
	for k, v := range raw {
		s, skipLabel, err := coerceLabelValue(k, v)
		if err != nil {
			return err
		}
		if skipLabel {
			continue
		}
		labels[k] = s
	}
	*l = labels
	return nil
}

const (
	keepLabel = false
	skipLabel = true
)

func coerceLabelValue(key string, raw json.RawMessage) (string, bool, error) {
	// encoding/json strips surrounding whitespace from RawMessage values
	switch raw[0] {
	case '"': // string
		var s string
		if err := json.Unmarshal(raw, &s); err != nil {
			return "", keepLabel, fmt.Errorf("could not decode label %q: %w", key, err)
		}
		return s, keepLabel, nil
	case 't', 'f': // boolean
		var b bool
		if err := json.Unmarshal(raw, &b); err != nil {
			return "", keepLabel, fmt.Errorf("could not decode label %q: %w", key, err)
		}
		if b {
			return "true", keepLabel, nil
		}
		return "false", keepLabel, nil
	case 'n': // null - omit the key entirely
		return "", skipLabel, nil
	case '{', '[': // object or array - unsupported
		return "", keepLabel, fmt.Errorf("unsupported label value type for key %q", key)
	default: // number
		var n json.Number
		if err := json.Unmarshal(raw, &n); err != nil {
			return "", keepLabel, fmt.Errorf("could not decode label %q: %w", key, err)
		}
		return n.String(), keepLabel, nil
	}
}
