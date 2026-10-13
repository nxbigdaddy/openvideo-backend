# 短视频AI系统数据库设计

## 1. 设计原则
- 开发期SQLite与生产MySQL共用同一套实体模型与迁移脚本规范。
- 所有业务主表包含审计字段：`created_at`、`updated_at`、`created_by`、`updated_by`。
- 软删除字段统一：`deleted_at`（可空）。
- 租户隔离字段统一：`workspace_id`（系统级表除外）。

## 2. 核心实体清单（12+）
1. `sys_user`
2. `workspace`
3. `workspace_member`
4. `workspace_provider_config`
5. `prompt_template`
6. `prompt_template_version`
7. `project`
8. `story`
9. `story_version`
10. `story_scene`
11. `scene_prompt`
12. `generation_task`
13. `generation_result`
14. `usage_bill`
15. `audit_log`

## 3. 表结构要点
### 3.1 sys_user
- `id` bigint pk
- `email` varchar(120) unique
- `password_hash` varchar(255)
- `status` tinyint（1启用/0禁用）
- 索引：`idx_user_status`

### 3.2 workspace
- `id` bigint pk
- `name` varchar(100)
- `tenant_mode` varchar(20)（shared/dedicated）
- `db_route_key` varchar(64) 可空（独立库路由键）
- 索引：`idx_workspace_tenant_mode`

### 3.3 workspace_provider_config
- `id` bigint pk
- `workspace_id` bigint
- `provider_type` varchar(20)（text/image）
- `provider_name` varchar(50)
- `api_base_url` varchar(255)
- `api_key_encrypted` text
- `model_name` varchar(100)
- `is_default` tinyint
- 唯一约束：`uq_workspace_provider_default(workspace_id, provider_type, is_default)`（逻辑上仅一个默认）

### 3.4 prompt_template / prompt_template_version
- 模板主表存元数据，版本表存正文与变量Schema。
- `prompt_template_version.content` 使用text。
- `status`：draft/published/archived。
- 索引：`idx_template_workspace_type`、`idx_template_version_status`

### 3.5 project
- `id` bigint pk
- `workspace_id` bigint
- `name` varchar(150)
- `source_type` varchar(20)（single/batch/import）
- `status` varchar(20)（active/completed/archived）
- 索引：`idx_project_workspace_status`

### 3.6 story / story_version
- `story` 保存当前发布版本指针 `current_version_id`
- `story_version` 保存内容快照：
  - `title` varchar(200)
  - `summary` text
  - `content` longtext（MySQL）/ text（SQLite）
  - `keywords_json` text
  - `audience` varchar(50)
  - `style` varchar(50)
  - `target_length` int
- 索引：`idx_story_project_status`、`idx_story_version_story_created`

### 3.7 story_scene
- `id` bigint pk
- `story_version_id` bigint
- `scene_no` int
- `duration_sec` int
- `shot_type` varchar(30)
- `scene_desc` text
- `character_action` text
- `narration` text
- 唯一：`uq_scene_story_version_no(story_version_id, scene_no)`

### 3.8 scene_prompt
- `id` bigint pk
- `scene_id` bigint
- `prompt_version` int
- `positive_prompt` text
- `negative_prompt` text
- `params_json` text（模型参数）
- `status` varchar(20)
- 索引：`idx_scene_prompt_scene_status`

### 3.9 generation_task
- `id` bigint pk
- `workspace_id` bigint
- `task_type` varchar(30)（story/scene/prompt）
- `biz_id` bigint（关联业务对象ID）
- `status` varchar(20)
- `retry_count` int
- `max_retry` int
- `priority` int
- `idempotency_key` varchar(120)
- `error_code` varchar(50) 可空
- `error_message` text 可空
- `started_at` datetime 可空
- `finished_at` datetime 可空
- 索引：
  - `idx_task_workspace_status`
  - `idx_task_type_status`
  - `idx_task_idempotency`

### 3.10 generation_result
- `id` bigint pk
- `task_id` bigint
- `provider_name` varchar(50)
- `model_name` varchar(100)
- `request_payload_json` longtext/text
- `response_payload_json` longtext/text
- `token_input` int
- `token_output` int
- `elapsed_ms` int
- 索引：`idx_result_task`

### 3.11 usage_bill
- `id` bigint pk
- `workspace_id` bigint
- `task_id` bigint
- `provider_type` varchar(20)
- `usage_unit` varchar(20)（token/image）
- `usage_amount` decimal(18,6)
- `cost_amount` decimal(18,6)
- `currency` varchar(10)
- `bill_date` date
- 索引：`idx_bill_workspace_date`

### 3.12 audit_log
- `id` bigint pk
- `workspace_id` bigint 可空
- `operator_user_id` bigint
- `action` varchar(80)
- `target_type` varchar(50)
- `target_id` varchar(64)
- `detail_json` longtext/text
- `ip` varchar(50)
- 索引：`idx_audit_operator_time`、`idx_audit_target`

## 4. 状态流转约束
- `generation_task.status` 仅允许：
  - PENDING -> RUNNING
  - RUNNING -> SUCCESS/FAILED/RETRYING
  - RETRYING -> RUNNING/DEAD_LETTER
  - FAILED -> RETRYING/DEAD_LETTER
- `story.status`：
  - DRAFT -> GENERATED -> REVIEWING -> APPROVED
  - REVIEWING -> REJECTED -> REVIEWING

## 5. 索引策略
- 高频查询组合索引：
  - `(workspace_id, status, created_at)`
  - `(project_id, status)`
  - `(task_type, status, priority, created_at)`
- 文本检索需求：
  - MySQL可选全文索引（标题/摘要）
  - SQLite开发阶段使用like匹配

## 6. SQLite 与 MySQL 差异处理
- `longtext` 在SQLite映射为 `text`。
- 布尔值统一tinyint映射，避免方言行为差异。
- JSON字段统一text存储，应用层校验Schema。
- 时间统一UTC存储，应用层按用户时区展示。

## 7. 迁移与初始化建议
- 使用TypeORM migration，禁止生产自动synchronize。
- 初始迁移包含：基础权限、字典、默认角色、默认模板（可选）。
- 提供“租户独立库初始化脚本”，复用同一迁移链。
