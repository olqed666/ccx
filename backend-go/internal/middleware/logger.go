package middleware

import (
	"net/http"
	"strings"

	"github.com/BenedictKing/ccx/internal/config"
	"github.com/gin-gonic/gin"
)

// 默认跳过日志的路径前缀（仅 GET 请求）
var defaultSkipPrefixes = []string{
	"/health",
	"/api/messages/channels",
	"/api/responses/channels",
	"/api/gemini/channels",
	"/api/messages/global/stats",
	"/api/responses/global/stats",
	"/api/gemini/global/stats",
}

// FilteredLogger 创建一个可过滤路径的 Logger 中间件
// 仅对 GET 请求且匹配 skipPrefixes 前缀的路径跳过日志输出
// POST/PUT/DELETE 等管理操作始终记录日志以保留审计跟踪
func FilteredLogger(envCfg *config.EnvConfig, skipPrefixes ...string) gin.HandlerFunc {
	// 如果 QuietPollingLogs 为 false，使用标准 Logger
	if !envCfg.QuietPollingLogs {
		return gin.Logger()
	}

	if len(skipPrefixes) == 0 {
		skipPrefixes = defaultSkipPrefixes
	}

	return gin.LoggerWithConfig(gin.LoggerConfig{
		Skip: func(c *gin.Context) bool {
			path := c.Request.URL.Path

			// CORS 预检不改变服务状态；排障按钮读取 Responses 渠道日志时会触发该预检，静默避免刷屏。
			if c.Request.Method == http.MethodOptions && isResponsesChannelLogsPath(path) {
				return true
			}

			// 只跳过 GET 请求，保留其他方法的审计日志
			if c.Request.Method != http.MethodGet {
				return false
			}

			for _, prefix := range skipPrefixes {
				if strings.HasPrefix(path, prefix) {
					return true
				}
			}
			return false
		},
	})
}

func isResponsesChannelLogsPath(path string) bool {
	return strings.HasPrefix(path, "/api/responses/channels/") && strings.HasSuffix(path, "/logs")
}
