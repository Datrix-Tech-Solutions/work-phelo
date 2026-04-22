import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
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
import { ModuleGuard } from '../auth/guards/module.guard';
import { FeatureGuard } from '../auth/guards/feature.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequireFeature } from '../auth/decorators/feature.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Permission } from '@work-phelo/config';
import { RequestUser } from '@work-phelo/types';

@ApiTags('Appraisals')
@Controller('appraisals')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'appraisals')
@ApiBearerAuth('access-token')
export class AppraisalsController {
  constructor(private readonly appraisalsService: AppraisalsService) {}

  @Post('cycles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({ summary: 'Create a new appraisal cycle' })
  @ApiBody({ type: CreateAppraisalCycleDto })
  @ApiResponse({ status: 201, description: 'Appraisal cycle created' })
  createCycle(@Body() dto: CreateAppraisalCycleDto, @Req() req: any) {
    return this.appraisalsService.createCycle(
      req.user.tenantId,
      req.user.id,
      dto,
    );
  }

  @Get('cycles')
  @ApiOperation({ summary: 'List all appraisal cycles for the tenant' })
  @ApiResponse({ status: 200, description: 'Appraisal cycles retrieved' })
  getCycles(@Req() req: any) {
    return this.appraisalsService.getCycles(req.user.tenantId);
  }

  @Post('cycles/:id/start')
  @RequirePermissions(Permission.CONFIGURE_APPRAISAL)
  @ApiOperation({
    summary:
      'Start an appraisal cycle — generates appraisal records for all employees',
  })
  @ApiParam({ name: 'id', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisal cycle started' })
  @ApiResponse({ status: 404, description: 'Cycle not found' })
  startCycle(@Param('id') id: string, @Req() req: any) {
    return this.appraisalsService.startCycle(req.user.tenantId, id);
  }

  @Get('cycles/:cycleId/appraisals')
  @ApiOperation({ summary: 'Get all appraisal records for a cycle' })
  @ApiParam({ name: 'cycleId', description: 'Appraisal cycle UUID' })
  @ApiResponse({ status: 200, description: 'Appraisals retrieved' })
  getAppraisals(@Param('cycleId') cycleId: string, @Req() req: any) {
    return this.appraisalsService.getAppraisals(
      req.user.tenantId,
      req.user as RequestUser,
      cycleId,
    );
  }

  @Get('my')
  @RequirePermissions(Permission.READ_OWN_REVIEW)
  @ApiOperation({ summary: "Get the logged-in employee's own appraisals" })
  @ApiResponse({ status: 200, description: 'My appraisals retrieved' })
  getMyAppraisals(@Req() req: any) {
    return this.appraisalsService.getMyAppraisals(
      req.user.tenantId,
      req.user.id,
    );
  }

  @Patch(':id/self-assessment')
  @RequirePermissions(Permission.SUBMIT_SELF_ASSESSMENT)
  @ApiOperation({ summary: 'Submit self-assessment for an appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: SubmitReviewDto })
  @ApiResponse({ status: 200, description: 'Self-assessment submitted' })
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
  @RequirePermissions(Permission.SUBMIT_MANAGER_REVIEW)
  @ApiOperation({ summary: 'Submit manager review for an appraisal' })
  @ApiParam({ name: 'id', description: 'Appraisal UUID' })
  @ApiBody({ type: SubmitReviewDto })
  @ApiResponse({ status: 200, description: 'Manager review submitted' })
  submitManagerReview(
    @Param('id') id: string,
    @Body() dto: SubmitReviewDto,
    @Req() req: any,
  ) {
    return this.appraisalsService.submitManagerReview(
      req.user.tenantId,
      id,
      req.user as RequestUser,
      dto,
    );
  }
}
