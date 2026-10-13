# 短视频AI系统API规范

## 1. 统一约定
- Base URL：`/api/v1`
- 鉴权：`Authorization: Bearer <token>`
- 内容类型：`application/json`
- 分页参数：`page`、`pageSize`（默认20）
- 响应结构：
  - 成功：`{ code: 0, message: "ok", data: ... }`
  - 失败：`{ code: <error_code>, message: "...", requestId: "..." }`

## 2. 错误码分层
- `1xxx` 参数与校验错误
- `2xxx` 权限与认证错误
- `3xxx` 业务状态错误
- `4xxx` 外部模型错误
- `5xxx` 系统与基础设施错误

示例：
- `1001` 参数缺失
- `2001` 未登录
- `2003` 无权限访问工作区
- `3005` 任务状态不允许当前操作
- `4002` 模型超时
- `5001` 数据库错误

## 3. 认证与工作区
### 3.1 登录
- `POST /auth/login`
- req：`{ email, password }`
- resp：`{ accessToken, refreshToken, userInfo }`

### 3.2 切换工作区
- `POST /workspaces/switch`
- req：`{ workspaceId }`
- resp：当前工作区上下文

## 4. Provider配置接口
### 4.1 新增配置
- `POST /provider-configs`
- req：
```json
{
  "workspaceId": 1001,
  "providerType": "text",
  "providerName": "openai-compatible",
  "apiBaseUrl": "https://api.example.com/v1",
  "apiKey": "sk-***",
  "modelName": "gpt-4.1-mini",
  "isDefault": true
}
```
- resp：配置ID与掩码密钥

### 4.2 列表查询
- `GET /provider-configs?providerType=text`

## 5. 模板接口
### 5.1 创建模板
- `POST /prompt-templates`
- req：`{ name, templateType, description }`

### 5.2 新建模板版本
- `POST /prompt-templates/{templateId}/versions`
- req：`{ content, variablesSchemaJson, status }`

### 5.3 发布模板版本
- `POST /prompt-templates/{templateId}/versions/{versionId}/publish`

## 6. 项目与故事接口
### 6.1 创建项目
- `POST /projects`
- req：`{ name, sourceType }`

### 6.2 批量创建故事并生成
- `POST /stories/batch-generate`
- req：
```json
{
  "projectId": 9001,
  "titles": ["雨夜旧站台", "失而复得的录音带"],
  "options": {
    "targetLength": 1200,
    "style": "悬疑",
    "audience": "18-35",
    "language": "zh-CN",
    "structure": "三幕式"
  }
}
```
- resp：`{ batchId, taskIds: [...] }`

### 6.3 获取故事详情
- `GET /stories/{storyId}`

### 6.4 人工编辑故事版本
- `POST /stories/{storyId}/versions`
- req：`{ title, summary, content, changeNote }`

## 7. 分镜与提示词接口
### 7.1 生成分镜
- `POST /stories/{storyId}/generate-scenes`
- req：`{ sceneCountHint, templateVersionId }`

### 7.2 查询分镜列表
- `GET /stories/{storyId}/scenes`

### 7.3 为分镜生成提示词
- `POST /scenes/{sceneId}/generate-prompts`
- req：`{ imageProviderConfigId, stylePreset, size }`

### 7.4 编辑提示词
- `PATCH /scene-prompts/{promptId}`
- req：`{ positivePrompt, negativePrompt, paramsJson }`

## 8. 任务与执行接口
### 8.1 查询任务详情
- `GET /tasks/{taskId}`

### 8.2 重试任务
- `POST /tasks/{taskId}/retry`

### 8.3 批量查询任务状态
- `POST /tasks/status:batchGet`
- req：`{ taskIds: [...] }`

## 9. 成本与审计接口
### 9.1 账单列表
- `GET /usage-bills?workspaceId=1001&from=2026-03-01&to=2026-03-31`

### 9.2 成本汇总
- `GET /usage-bills/summary?groupBy=providerType`

### 9.3 审计日志查询
- `GET /audit-logs?action=UPDATE_PROVIDER_CONFIG&page=1&pageSize=20`

## 10. 幂等与重放防护
- 对写操作支持 `Idempotency-Key` 头。
- 服务端将 key + userId + path 存储短期记录（Redis，TTL 24h）。
- 命中重复请求时直接返回首次结果。

## 11. 安全与输入约束
- 所有输入执行DTO校验与长度限制。
- 禁止前端传入 `workspaceId` 覆盖当前上下文（仅管理员特殊接口例外）。
- 模型响应必须经Schema校验后再落库。
