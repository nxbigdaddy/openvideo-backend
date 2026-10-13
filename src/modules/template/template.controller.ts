import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { CreatePromptTemplateVersionDto } from './dto/create-prompt-template-version.dto';
import { TemplateService } from './template.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacePermissionService } from '../auth/workspace-permission.service';
import { AuditService } from '../audit/audit.service';

@Controller('prompt-templates')
export class TemplateController {
  constructor(
    private readonly templateService: TemplateService,
    private readonly permissionService: WorkspacePermissionService,
    private readonly auditService: AuditService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createTemplate(@Body() dto: CreatePromptTemplateDto, @Req() req: any) {
    await this.permissionService.ensureMember(req.user.userId, dto.workspaceId);
    const created = await this.templateService.createTemplate(dto);
    await this.auditService.record({
      workspaceId: dto.workspaceId,
      operatorUserId: req.user.userId,
      action: 'TEMPLATE_CREATE',
      targetType: 'prompt_template',
      targetId: String(created.id),
      detail: { templateType: dto.templateType }
    });
    return created;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query('workspaceId') workspaceId: number,
    @Req() req: any,
    @Query('templateType') templateType?: any
  ) {
    await this.permissionService.ensureMember(req.user.userId, Number(workspaceId));
    return this.templateService.listTemplates({
      workspaceId: Number(workspaceId),
      templateType
    });
  }

  @Get(':templateId/versions')
  @UseGuards(JwtAuthGuard)
  async listVersions(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Req() req: any,
    @Query('status') status?: any
  ) {
    const workspaceId = await this.templateService.getTemplateWorkspaceId(templateId);
    if (!workspaceId) throw new Error('template not found');
    await this.permissionService.ensureMember(req.user.userId, workspaceId);
    return this.templateService.listTemplateVersions({
      templateId,
      status
    });
  }

  @Post(':templateId/versions')
  @UseGuards(JwtAuthGuard)
  async createVersion(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Body() dto: CreatePromptTemplateVersionDto,
    @Req() req: any
  ) {
    const workspaceId = await this.templateService.getTemplateWorkspaceId(templateId);
    if (!workspaceId) throw new Error('template not found');
    await this.permissionService.ensureMember(req.user.userId, workspaceId);
    const created = await this.templateService.createTemplateVersion({ ...dto, templateId });
    await this.auditService.record({
      workspaceId,
      operatorUserId: req.user.userId,
      action: 'TEMPLATE_VERSION_CREATE',
      targetType: 'prompt_template_version',
      targetId: String(created.id),
      detail: { status: created.status }
    });
    return created;
  }

  @Post(':templateId/versions/:versionId/publish')
  @UseGuards(JwtAuthGuard)
  async publish(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Req() req: any
  ) {
    const workspaceId = await this.templateService.getTemplateWorkspaceId(templateId);
    if (!workspaceId) throw new Error('template not found');
    await this.permissionService.ensureMember(req.user.userId, workspaceId);
    const published = await this.templateService.publishTemplateVersion(templateId, versionId);
    if (!published) throw new Error('publish failed');
    await this.auditService.record({
      workspaceId,
      operatorUserId: req.user.userId,
      action: 'TEMPLATE_VERSION_PUBLISH',
      targetType: 'prompt_template_version',
      targetId: String(published.id),
      detail: { templateId }
    });
    return published;
  }

  @Post(':templateId/versions/:versionId/rollback')
  @UseGuards(JwtAuthGuard)
  async rollback(
    @Param('templateId', ParseIntPipe) templateId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Req() req: any
  ) {
    // 回滚在语义上等价于“将指定版本设为 published”
    const workspaceId = await this.templateService.getTemplateWorkspaceId(templateId);
    if (!workspaceId) throw new Error('template not found');
    await this.permissionService.ensureMember(req.user.userId, workspaceId);
    return this.templateService.publishTemplateVersion(templateId, versionId);
  }
}

