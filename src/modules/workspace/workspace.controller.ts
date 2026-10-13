import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceService } from './workspace.service';
import { CreateWorkspaceProviderConfigDto } from './dto/create-workspace-provider-config.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('workspaces')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateWorkspaceDto, @Req() req: any) {
    const userId = req.user.userId;
    return this.workspaceService.create(dto, userId);
  }

  @Post(':workspaceId/provider-configs')
  @UseGuards(JwtAuthGuard)
  async createProviderConfig(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: Omit<CreateWorkspaceProviderConfigDto, 'workspaceId'>,
    @Req() req: any
  ) {
    return this.workspaceService.createProviderConfig({
      ...dto,
      workspaceId,
      operatorUserId: req.user.userId
    });
  }

  @Get(':workspaceId/provider-configs')
  @UseGuards(JwtAuthGuard)
  async listProviderConfigs(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Req() req: any,
    @Query('providerType') providerType?: 'text' | 'image'
  ) {
    return this.workspaceService.listProviderConfigs({
      operatorUserId: req.user.userId,
      workspaceId,
      providerType
    });
  }
}
