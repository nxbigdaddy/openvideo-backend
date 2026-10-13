import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { WorkspaceEntity } from '../modules/workspace/entities/workspace.entity';
import { WorkspaceProviderConfigEntity } from '../modules/workspace/entities/workspace-provider-config.entity';
import { ProjectEntity } from '../modules/project/entities/project.entity';
import { StoryEntity } from '../modules/story/entities/story.entity';
import { StoryVersionEntity } from '../modules/story/entities/story-version.entity';
import { StorySceneEntity } from '../modules/storyboard/entities/story-scene.entity';
import { ScenePromptEntity } from '../modules/prompt/entities/scene-prompt.entity';
import { GenerationTaskEntity } from '../modules/job/entities/generation-task.entity';
import { GenerationResultEntity } from '../modules/job/entities/generation-result.entity';
import { PromptTemplateEntity } from '../modules/template/entities/prompt-template.entity';
import { PromptTemplateVersionEntity } from '../modules/template/entities/prompt-template-version.entity';
import { UsageBillEntity } from '../modules/billing/entities/usage-bill.entity';
import { AuditLogEntity } from '../modules/audit/entities/audit-log.entity';
import { SysUserEntity } from '../modules/auth/entities/sys-user.entity';
import { WorkspaceMemberEntity } from '../modules/auth/entities/workspace-member.entity';

export function getTypeOrmOptions(): TypeOrmModuleOptions {
  const dbType = (process.env.DB_TYPE ?? 'sqlite') as 'sqlite' | 'mysql';
  const entities = [
    WorkspaceEntity,
    WorkspaceProviderConfigEntity,
    ProjectEntity,
    StoryEntity,
    StoryVersionEntity,
    StorySceneEntity,
    ScenePromptEntity,
    GenerationTaskEntity,
    GenerationResultEntity,
    PromptTemplateEntity,
    PromptTemplateVersionEntity,
    UsageBillEntity,
    AuditLogEntity,
    SysUserEntity,
    WorkspaceMemberEntity
  ];

  if (dbType === 'mysql') {
    return {
      type: 'mysql',
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: parseInt(process.env.DB_PORT ?? '3306', 10),
      username: process.env.DB_USER ?? 'root',
      password: YOUR_PASSWORD ?? 'root',
      database: process.env.DB_NAME ?? 'openvideo2026',
      entities,
      synchronize: true
    };
  }

  return {
    type: 'sqlite',
    database: process.env.DB_SQLITE_PATH ?? 'data/dev.sqlite',
    entities,
    synchronize: true
  };
}
