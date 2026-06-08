package providers

import (
	"encoding/json"
	"io"
	"strings"
	"testing"
)

// findErrorEvent 返回首个 Claude 风格 error 事件的 error 对象（type=="error"）。
func findErrorEvent(events []string) (map[string]interface{}, bool) {
	for _, event := range events {
		for _, line := range strings.Split(event, "\n") {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			var data map[string]interface{}
			if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &data); err != nil {
				continue
			}
			if data["type"] != "error" {
				continue
			}
			if errObj, ok := data["error"].(map[string]interface{}); ok {
				return errObj, true
			}
			return map[string]interface{}{}, true
		}
	}
	return nil, false
}

func hasEventOfType(events []string, blockType string, deltaType string) bool {
	for _, event := range events {
		for _, line := range strings.Split(event, "\n") {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			var data map[string]interface{}
			if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &data); err != nil {
				continue
			}
			if blockType != "" {
				if cb, ok := data["content_block"].(map[string]interface{}); ok && cb["type"] == blockType {
					return true
				}
			}
			if deltaType != "" {
				if d, ok := data["delta"].(map[string]interface{}); ok && d["type"] == deltaType {
					return true
				}
			}
		}
	}
	return false
}

func runResponsesStream(t *testing.T, body string) []string {
	t.Helper()
	provider := &ResponsesProvider{}
	eventChan, errChan, err := provider.HandleStreamResponse(io.NopCloser(strings.NewReader(body)))
	if err != nil {
		t.Fatalf("HandleStreamResponse returned error: %v", err)
	}
	events := collectStreamEvents(eventChan)
	select {
	case streamErr := <-errChan:
		if streamErr != nil {
			t.Fatalf("unexpected stream error: %v", streamErr)
		}
	default:
	}
	return events
}

// 上游以 200 + SSE 返回认证错误体（event: error）：应转成可被 DetectStreamBlacklistError 识别的 Claude error 事件。
func TestResponsesProvider_HandleStreamResponse_EmitsClaudeErrorOnUpstreamErrorEvent(t *testing.T) {
	body := `event: error
data: {"type":"error","error":{"type":"authentication_error","message":"invalid api key"}}

`
	events := runResponsesStream(t, body)
	errObj, ok := findErrorEvent(events)
	if !ok {
		t.Fatalf("expected a Claude error event, got: %v", events)
	}
	if errObj["type"] != "authentication_error" {
		t.Fatalf("error.type = %v, want authentication_error", errObj["type"])
	}
	if !strings.Contains(toString(errObj["message"]), "invalid api key") {
		t.Fatalf("error.message = %v, want to contain 'invalid api key'", errObj["message"])
	}
}

// new-api 风格：response.failed 携带嵌套 response.error。
func TestResponsesProvider_HandleStreamResponse_EmitsClaudeErrorOnResponseFailed(t *testing.T) {
	body := `event: response.failed
data: {"type":"response.failed","response":{"status":"failed","error":{"code":"insufficient_quota","message":"insufficient account balance"}}}

`
	events := runResponsesStream(t, body)
	errObj, ok := findErrorEvent(events)
	if !ok {
		t.Fatalf("expected a Claude error event, got: %v", events)
	}
	if !strings.Contains(toString(errObj["message"]), "balance") {
		t.Fatalf("error.message = %v, want balance text", errObj["message"])
	}
}

// 顶层非标准错误体（new-api 直接吐 {"error":"..."} 字符串 + type=error）。
func TestResponsesProvider_HandleStreamResponse_EmitsClaudeErrorOnTopLevelStringError(t *testing.T) {
	body := `data: {"type":"error","error":"当前 API 不支持所选模型 gpt-5.5"}

`
	events := runResponsesStream(t, body)
	errObj, ok := findErrorEvent(events)
	if !ok {
		t.Fatalf("expected a Claude error event, got: %v", events)
	}
	if !strings.Contains(toString(errObj["message"]), "gpt-5.5") {
		t.Fatalf("error.message = %v, want to contain gpt-5.5", errObj["message"])
	}
}

// 纯空流（上游 200 但只有空行/无可识别事件）：不应注入 error，保持空流语义以走现状 failover。
func TestResponsesProvider_HandleStreamResponse_TrulyEmptyStreamHasNoEvents(t *testing.T) {
	body := "\n\n: keep-alive\n\n"
	events := runResponsesStream(t, body)
	if len(events) != 0 {
		t.Fatalf("expected no events for truly empty stream, got: %v", events)
	}
}

// 仅含无法转换的良性事件（created/in_progress + 未知类型）但无内容：注入 upstream_unconvertible error 以提供诊断线索。
func TestResponsesProvider_HandleStreamResponse_UnconvertibleOnlyStreamEmitsDiagnosticError(t *testing.T) {
	body := `event: response.created
data: {"type":"response.created","response":{"status":"in_progress"}}

event: response.some_future_event
data: {"type":"response.some_future_event","foo":"bar"}

`
	events := runResponsesStream(t, body)
	errObj, ok := findErrorEvent(events)
	if !ok {
		t.Fatalf("expected diagnostic error event, got: %v", events)
	}
	if errObj["type"] != "upstream_unconvertible" {
		t.Fatalf("error.type = %v, want upstream_unconvertible", errObj["type"])
	}
	if !strings.Contains(toString(errObj["message"]), "response.some_future_event") {
		t.Fatalf("diagnostic should name unknown event, got: %v", errObj["message"])
	}
}

// incomplete（被 max_tokens 截断）应映射到 stop_reason=max_tokens。
func TestResponsesProvider_HandleStreamResponse_IncompleteMapsToMaxTokens(t *testing.T) {
	body := `event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"partial"}

event: response.completed
data: {"type":"response.completed","response":{"status":"incomplete","usage":{"input_tokens":3,"output_tokens":1}}}

`
	events := runResponsesStream(t, body)
	usage := extractMessageDeltaUsage(t, events)
	if usage == nil {
		t.Fatalf("missing message_delta usage")
	}
	// stop_reason 在 message_delta.delta 内
	var stopReason string
	for _, event := range events {
		for _, line := range strings.Split(event, "\n") {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			var data map[string]interface{}
			if json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &data) != nil {
				continue
			}
			if data["type"] != "message_delta" {
				continue
			}
			if d, ok := data["delta"].(map[string]interface{}); ok {
				stopReason = toString(d["stop_reason"])
			}
		}
	}
	if stopReason != "max_tokens" {
		t.Fatalf("stop_reason = %q, want max_tokens", stopReason)
	}
}

// reasoning-only 流（只有思考、无 output_text）：应转成 thinking 块，不被当作空流。
func TestResponsesProvider_HandleStreamResponse_ReasoningOnlyProducesThinkingBlock(t *testing.T) {
	body := `event: response.reasoning_summary_text.delta
data: {"type":"response.reasoning_summary_text.delta","delta":"thinking hard"}

event: response.completed
data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":3,"output_tokens":2}}}

`
	events := runResponsesStream(t, body)
	if !hasEventOfType(events, "thinking", "") {
		t.Fatalf("expected a thinking content_block_start, got: %v", events)
	}
	if !hasEventOfType(events, "", "thinking_delta") {
		t.Fatalf("expected a thinking_delta, got: %v", events)
	}
}

// reasoning + text 混合：thinking 块应先于 text 块，且各自正确开合。
func TestResponsesProvider_HandleStreamResponse_ReasoningThenTextOrdering(t *testing.T) {
	body := `event: response.reasoning_summary_text.delta
data: {"type":"response.reasoning_summary_text.delta","delta":"let me think"}

event: response.output_text.delta
data: {"type":"response.output_text.delta","delta":"answer"}

event: response.completed
data: {"type":"response.completed","response":{"status":"completed","usage":{"input_tokens":3,"output_tokens":2}}}

`
	events := runResponsesStream(t, body)

	// 收集 content_block_start 的类型顺序
	var blockTypes []string
	for _, event := range events {
		for _, line := range strings.Split(event, "\n") {
			if !strings.HasPrefix(line, "data: ") {
				continue
			}
			var data map[string]interface{}
			if json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &data) != nil {
				continue
			}
			if data["type"] != "content_block_start" {
				continue
			}
			if cb, ok := data["content_block"].(map[string]interface{}); ok {
				blockTypes = append(blockTypes, toString(cb["type"]))
			}
		}
	}
	if len(blockTypes) < 2 || blockTypes[0] != "thinking" || blockTypes[1] != "text" {
		t.Fatalf("block order = %v, want [thinking text ...]", blockTypes)
	}
}
