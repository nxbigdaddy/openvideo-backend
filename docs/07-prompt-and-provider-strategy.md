# 短视频AI系统 Prompt 与 Provider 策略

## 1. 目标
- 通过统一Provider适配层，支持多厂商模型可插拔。
- 通过模板版本化，保证输出风格稳定、可迭代、可回溯。

## 2. Provider分层
- ProviderRegistry：注册与发现可用Provider。
- ProviderAdapter：标准化调用接口。
- ProviderPolicy：路由、降级、熔断与预算策略。

## 3. 统一接口定义（逻辑）
- 文本生成：
  - 输入：systemPrompt、userPrompt、temperature、maxTokens、jsonSchema。
  - 输出：content、tokenUsage、finishReason、providerMeta。
- 图像提示词生成：
  - 输入：sceneData、stylePreset、audience、safetyPolicy。
  - 输出：positivePrompt、negativePrompt、params。

## 4. Prompt模板体系
- 模板类型：
  - STORY_GENERATION
  - SCENE_GENERATION
  - IMAGE_PROMPT_GENERATION
- 模板版本字段：
  - `version_no`
  - `content`
  - `variables_schema_json`
  - `status`（draft/published）
  - `change_log`

## 5. 变量注入规范
- 必填变量：
  - 故事：`title`, `style`, `audience`, `targetLength`, `language`, `structure`
  - 分镜：`storyContent`, `sceneCountHint`, `shotStyle`
  - 提示词：`sceneDesc`, `characterAction`, `lightingStyle`, `cameraShot`
- 缺失变量阻断执行并返回 `1001`。

## 6. 输出格式约束
- 强制要求模型输出JSON并校验Schema。
- 失败处理：
  - 首次解析失败 -> 自动修复提示再请求1次。
  - 二次失败 -> 标记FAILED并进入重试/人工。

## 7. 质量控制策略
- Prompt中嵌入“受众适配”与“风格一致性”检查指令。
- 对生成结果做规则校验：
  - 字数区间
  - 敏感词检查
  - 镜头连贯性检查（scene_no连续）

## 8. 安全策略
- 敏感提示词过滤（注入攻击、越权指令、隐私泄露）。
- 输出安全分类：
  - pass：直接入库
  - review：人工复核
  - reject：直接拒绝

## 9. 路由与降级
- 主Provider失败时自动切备用Provider（同类型）。
- 降级顺序可按workspace配置。
- 切换时写审计与任务事件，便于复盘。

## 10. 预算与成本策略
- 按workspace定义每日token与费用上限。
- 达阈值策略：
  - 软阈值：提示告警，继续执行
  - 硬阈值：暂停新任务，仅允许管理员解锁

## 11. 示例模板（结构示意）
```text
你是资深短视频编剧，请根据以下参数生成故事：
- 标题：{{title}}
- 风格：{{style}}
- 受众：{{audience}}
- 目标字数：{{targetLength}}
- 结构：{{structure}}
输出必须是JSON，包含 title/summary/content/keywords。
```

## 12. 演进路线
- 增加多语言模板包（中/英/日）。
- 引入自动评分器（可读性、情绪强度、转化潜力）。
- 加入用户偏好学习，实现个性化Prompt参数推荐。
