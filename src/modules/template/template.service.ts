import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PromptTemplateEntity, TemplateType } from './entities/prompt-template.entity';
import {
  PromptTemplateVersionEntity,
  TemplateVersionStatus
} from './entities/prompt-template-version.entity';

export type RenderedPromptOverride = {
  systemPrompt?: string;
  userPrompt: string;
};

@Injectable()
export class TemplateService {
  constructor(
    @InjectRepository(PromptTemplateEntity)
    private readonly templateRepo: Repository<PromptTemplateEntity>,
    @InjectRepository(PromptTemplateVersionEntity)
    private readonly versionRepo: Repository<PromptTemplateVersionEntity>
  ) {}

  async getTemplateWorkspaceId(templateId: number): Promise<number | null> {
    const tpl = await this.templateRepo.findOne({ where: { id: templateId } });
    return tpl?.workspaceId ?? null;
  }

  async createTemplate(input: {
    workspaceId: number;
    templateType: TemplateType;
    name: string;
    description?: string;
  }) {
    const entity = this.templateRepo.create({
      workspaceId: input.workspaceId,
      templateType: input.templateType,
      name: input.name,
      description: input.description
    });
    return this.templateRepo.save(entity);
  }

  async createTemplateVersion(input: {
    templateId: number;
    versionNo?: number;
    systemPrompt?: string;
    userPrompt: string;
    variablesSchemaJson?: string;
    status: TemplateVersionStatus;
  }) {
    const existing = await this.versionRepo.find({
      where: { templateId: input.templateId },
      order: { versionNo: 'DESC' }
    });
    const nextNo = input.versionNo ?? (existing[0]?.versionNo ? existing[0].versionNo + 1 : 1);

    const entity = this.versionRepo.create({
      templateId: input.templateId,
      versionNo: nextNo,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      variablesSchemaJson: input.variablesSchemaJson,
      status: input.status
    });
    return this.versionRepo.save(entity);
  }

  async publishTemplateVersion(templateId: number, versionId: number) {
    const version = await this.versionRepo.findOne({ where: { id: versionId, templateId } });
    if (!version) throw new NotFoundException('template version not found');

    // Set others to draft to keep one "published" at a time (per template).
    await this.versionRepo.update({ templateId }, { status: 'draft' });
    await this.versionRepo.update({ id: versionId }, { status: 'published', renderedByType: null });
    return this.versionRepo.findOne({ where: { id: versionId } });
  }

  private renderUserPrompt(raw: string, vars: Record<string, unknown>): string {
    let out = raw;
    for (const [k, v] of Object.entries(vars)) {
      const val = v === undefined || v === null ? '' : String(v);
      out = out.split(`{{${k}}}`).join(val);
    }
    if (out.includes('{{')) {
      // 简化策略：仍可能有未替换变量，直接报错帮助你改模板。
      throw new BadRequestException('template variables not fully rendered');
    }
    return out;
  }

  async renderPublishedOverride(
    workspaceId: number,
    templateType: TemplateType,
    vars: Record<string, unknown>
  ): Promise<RenderedPromptOverride | null> {
    const templates = await this.templateRepo.find({ where: { workspaceId, templateType } });
    if (!templates.length) return null;

    let best: PromptTemplateVersionEntity | null = null;
    for (const t of templates) {
      const v = await this.versionRepo.findOne({
        where: { templateId: t.id, status: 'published' },
        order: { versionNo: 'DESC' }
      });
      if (!v) continue;
      if (!best || v.versionNo > best.versionNo) best = v;
    }

    if (!best) return null;
    return {
      systemPrompt: best.systemPrompt,
      userPrompt: this.renderUserPrompt(best.userPrompt, vars)
    };
  }

  async listTemplates(input: { workspaceId: number; templateType?: TemplateType }) {
    const where: any = { workspaceId: input.workspaceId };
    if (input.templateType) where.templateType = input.templateType;
    return this.templateRepo.find({ where, order: { id: 'DESC' } });
  }

  async listTemplateVersions(input: { templateId: number; status?: TemplateVersionStatus }) {
    const where: any = { templateId: input.templateId };
    if (input.status) where.status = input.status;
    return this.versionRepo.find({ where, order: { versionNo: 'DESC' } });
  }
}

