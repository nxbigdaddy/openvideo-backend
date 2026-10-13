import { Controller, Param, ParseIntPipe, Patch, Req, UseGuards, Body, Get, Post } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PromptService } from './prompt.service';
import { UpdateScenePromptDto } from './dto/update-scene-prompt.dto';

@Controller('prompts')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Patch('scene-prompts/:promptId')
  @UseGuards(JwtAuthGuard)
  async updateScenePrompt(
    @Param('promptId', ParseIntPipe) promptId: number,
    @Body() dto: UpdateScenePromptDto,
    @Req() req: any
  ) {
    return this.promptService.updateScenePrompt(promptId, req.user.userId, dto);
  }

  @Get('scene-prompts/:promptId')
  @UseGuards(JwtAuthGuard)
  async getScenePrompt(@Param('promptId', ParseIntPipe) promptId: number, @Req() req: any) {
    return this.promptService.getScenePrompt(promptId, req.user.userId);
  }

  @Post('scene-prompts/:promptId/approve')
  @UseGuards(JwtAuthGuard)
  async approve(@Param('promptId', ParseIntPipe) promptId: number, @Req() req: any) {
    return this.promptService.approveScenePrompt(promptId, req.user.userId);
  }

  @Post('scene-prompts/:promptId/reject')
  @UseGuards(JwtAuthGuard)
  async reject(
    @Param('promptId', ParseIntPipe) promptId: number,
    @Req() req: any,
    @Body('reason') reason?: string
  ) {
    return this.promptService.rejectScenePrompt(promptId, req.user.userId, reason);
  }
}
