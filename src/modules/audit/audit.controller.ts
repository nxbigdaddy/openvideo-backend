import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacePermissionService } from '../auth/workspace-permission.service';

@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly permissionService: WorkspacePermissionService
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query('workspaceId') workspaceId: number,
    @Query() pageQuery: PageQueryDto,
    @Req() req: any
  ) {
    await this.permissionService.ensureMember(req.user.userId, Number(workspaceId));
    return this.auditService.listByWorkspace({
      workspaceId: Number(workspaceId),
      page: pageQuery.page,
      pageSize: pageQuery.pageSize
    });
  }
}

