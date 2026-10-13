import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspacePermissionService } from '../auth/workspace-permission.service';

@Controller('usage-bills')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
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
    return this.billingService.listByWorkspace({
      workspaceId: Number(workspaceId),
      page: pageQuery.page,
      pageSize: pageQuery.pageSize
    });
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  async summary(@Query('workspaceId') workspaceId: number, @Req() req: any) {
    await this.permissionService.ensureMember(req.user.userId, Number(workspaceId));
    return this.billingService.summaryByWorkspace({ workspaceId: Number(workspaceId) });
  }
}

