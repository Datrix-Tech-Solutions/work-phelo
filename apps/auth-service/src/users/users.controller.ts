import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AcceptInviteDto } from '../auth/dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  invite(@Body() dto: InviteUserDto, @Req() req: any) {
    return this.usersService.invite(req.user.tenantId, dto);
  }

  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.usersService.acceptInvite(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Req() req: any) {
    return this.usersService.findAll(req.user.tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.usersService.findById(req.user.tenantId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Req() req: any) {
    return this.usersService.update(req.user.tenantId, id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard)
  deactivate(@Param('id') id: string, @Req() req: any) {
    return this.usersService.deactivate(req.user.tenantId, id);
  }

  @Patch(':id/force-password-reset')
  @UseGuards(JwtAuthGuard)
  forcePasswordReset(@Param('id') id: string, @Req() req: any) {
    return this.usersService.forcePasswordReset(req.user.tenantId, id);
  }
}
