import { ApiTags } from '@nestjs/swagger';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AppraisalsService } from './appraisals.service';
import { CreateAppraisalCycleDto } from './dto/create-cycle.dto';
import { SubmitReviewDto } from './dto/submit-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('uappraisals')
@Controller('appraisals')
@UseGuards(JwtAuthGuard)
export class AppraisalsController {
  constructor(private readonly appraisalsService: AppraisalsService) {}

  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  createCycle(@Body() dto: CreateAppraisalCycleDto, @Req() req: any) {
    return this.appraisalsService.createCycle(
      req.user.tenantId,
      req.user.id,
      dto,
    );
  }

  @Get('cycles')
  getCycles(@Req() req: any) {
    return this.appraisalsService.getCycles(req.user.tenantId);
  }

  @Post('cycles/:id/start')
  startCycle(@Param('id') id: string, @Req() req: any) {
    return this.appraisalsService.startCycle(req.user.tenantId, id);
  }

  @Get('cycles/:cycleId/appraisals')
  getAppraisals(@Param('cycleId') cycleId: string, @Req() req: any) {
    return this.appraisalsService.getAppraisals(req.user.tenantId, cycleId);
  }

  @Get('my')
  getMyAppraisals(@Req() req: any) {
    return this.appraisalsService.getMyAppraisals(
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/self-assessment')
  submitSelf(
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
    @Req() req: any,
  ) {
    return this.appraisalsService.submitSelfAssessment(
      req.user.tenantId,
      id,
      req.user.id,
      dto,
    );
  }

  @Patch(':id/manager-review')
  submitManagerReview(
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
    @Req() req: any,
  ) {
    return this.appraisalsService.submitManagerReview(
      req.user.tenantId,
      id,
      req.user.id,
      dto,
    );
  }
}
