package handlers

import (
	"testing"

	"github.com/BenedictKing/ccx/internal/config"
)

func TestCompatDiagnoseThinkingPassbackDefaults(t *testing.T) {
	tests := []struct {
		name    string
		channel *config.UpstreamConfig
		baseURL string
		want    bool
	}{
		{
			name: "deepseek channel by name",
			channel: &config.UpstreamConfig{
				Name:        "deepseek-xtpamp",
				ServiceType: "claude",
			},
			baseURL: "https://api.example.com/anthropic",
			want:    true,
		},
		{
			name: "volc ark by base url",
			channel: &config.UpstreamConfig{
				Name:        "ark-cn-beijing-volces-119tdg",
				ServiceType: "claude",
			},
			baseURL: "https://ark.cn-beijing.volces.com/api/coding#",
			want:    true,
		},
		{
			name: "glm by model mapping",
			channel: &config.UpstreamConfig{
				ServiceType: "claude",
				ModelMapping: map[string]string{
					"sonnet": "glm-5.2",
				},
			},
			baseURL: "https://api.example.com/messages",
			want:    true,
		},
		{
			name: "anthropic standard channel",
			channel: &config.UpstreamConfig{
				Name:        "anthropic",
				ServiceType: "claude",
			},
			baseURL: "https://api.anthropic.com",
			want:    false,
		},
		{
			name: "openrouter aggregate channel",
			channel: &config.UpstreamConfig{
				Name:        "deepseek via openrouter",
				ServiceType: "claude",
			},
			baseURL: "https://openrouter.ai/api",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldPassbackThinkingBlocksByDefault(tt.channel, tt.baseURL)
			if got != tt.want {
				t.Fatalf("shouldPassbackThinkingBlocksByDefault() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestCompatDiagnoseSystemRoleNormalizeDefaults(t *testing.T) {
	tests := []struct {
		name    string
		channel *config.UpstreamConfig
		baseURL string
		want    bool
	}{
		{
			name: "deepseek channel",
			channel: &config.UpstreamConfig{
				Name:        "deepseek-xtpamp",
				ServiceType: "claude",
			},
			baseURL: "https://api.deepseek.com/anthropic",
			want:    true,
		},
		{
			name: "mimo channel",
			channel: &config.UpstreamConfig{
				Name:        "mimo",
				ServiceType: "claude",
			},
			baseURL: "https://api.xiaomimimo.com/anthropic",
			want:    true,
		},
		{
			name: "qianfan channel",
			channel: &config.UpstreamConfig{
				ServiceType: "claude",
			},
			baseURL: "https://qianfan.baidubce.com/anthropic/coding",
			want:    true,
		},
		{
			name: "anthropic standard channel",
			channel: &config.UpstreamConfig{
				Name:        "anthropic",
				ServiceType: "claude",
			},
			baseURL: "https://api.anthropic.com",
			want:    false,
		},
		{
			name: "runapi aggregate channel",
			channel: &config.UpstreamConfig{
				Name:        "runapi deepseek",
				ServiceType: "claude",
			},
			baseURL: "https://runapi.co/v1",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := shouldNormalizeSystemRoleToTopLevelByDefault(tt.channel, tt.baseURL)
			if got != tt.want {
				t.Fatalf("shouldNormalizeSystemRoleToTopLevelByDefault() = %v, want %v", got, tt.want)
			}
		})
	}
}
