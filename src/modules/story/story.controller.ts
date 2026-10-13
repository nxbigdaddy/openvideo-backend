import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { BatchGenerateStoryDto } from './dto/batch-generate-story.dto';
import { StoryService } from './story.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PageQueryDto } from '../../common/dto/page-query.dto';
import { SubmitStoryVersionDto } from './dto/submit-story-version.dto';
import { ReviewStoryDto } from './dto/review-story.dto';

@Controller('stories')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post('batch-generate')
  @UseGuards(JwtAuthGuard)
  async batchGenerate(@Body() dto: BatchGenerateStoryDto, @Req() req: any) {
    return this.storyService.batchGenerate(dto, req.user.userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Query('workspaceId') workspaceId: number,
    @Query() pageQuery: PageQueryDto,
    @Req() req: any
  ) {
    return this.storyService.listByWorkspace({
      userId: req.user.userId,
      workspaceId: Number(workspaceId),
      pageQuery
    });
  }

  @Get(':storyId')
  @UseGuards(JwtAuthGuard)
  async getStory(@Param('storyId', ParseIntPipe) storyId: number, @Req() req: any) {
    return this.storyService.getStoryAggregate(storyId, req.user.userId);
  }

  @Get(':storyId/export')
  @UseGuards(JwtAuthGuard)
  async exportStory(@Param('storyId', ParseIntPipe) storyId: number, @Req() req: any) {
    return this.storyService.exportStory(storyId, req.user.userId);
  }

  @Post(':storyId/versions/:versionId/submit')
  @UseGuards(JwtAuthGuard)
  async submitEditedVersion(
    @Param('storyId', ParseIntPipe) storyId: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @Body() dto: SubmitStoryVersionDto,
    @Req() req: any
  ) {
    return this.storyService.submitEditedStoryVersion(storyId, versionId, dto, req.user.userId);
  }

  @Post(':storyId/approve')
  @UseGuards(JwtAuthGuard)
  async approve(@Param('storyId', ParseIntPipe) storyId: number, @Req() req: any) {
    return this.storyService.approveStory(storyId, req.user.userId);
  }

  @Post(':storyId/reject')
  @UseGuards(JwtAuthGuard)
  async reject(
    @Param('storyId', ParseIntPipe) storyId: number,
    @Body() dto: ReviewStoryDto,
    @Req() req: any
  ) {
    return this.storyService.rejectStory(storyId, req.user.userId, dto.reason);
  }
}
