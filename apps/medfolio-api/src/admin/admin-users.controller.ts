import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  adminApproveRequestSchema,
  adminSetActiveSchema,
} from '@nexo-centro/schemas';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminGuard, type AdminRequest } from './admin.guard';
import { AdminUsersService } from './admin-users.service';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get('users')
  listUsers(
    @Req() req: AdminRequest,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.adminUsersService.listUsers(
      req.adminHospitalId,
      limit,
      offset,
    );
  }

  @Patch('users/:id/active')
  @HttpCode(200)
  setActive(
    @Req() req: AdminRequest,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(adminSetActiveSchema))
    body: { isActive: boolean },
  ) {
    return this.adminUsersService.setActive(
      req.adminHospitalId,
      userId,
      body.isActive,
      req.adminUserId,
    );
  }

  @Get('requests')
  listPendingRequests(
    @Req() req: AdminRequest,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    return this.adminUsersService.listPendingRequests(
      req.adminHospitalId,
      limit,
      offset,
    );
  }

  @Post('requests/:id')
  @HttpCode(200)
  approveRequest(
    @Req() req: AdminRequest,
    @Param('id', ParseUUIDPipe) requestId: string,
    @Body(new ZodValidationPipe(adminApproveRequestSchema))
    body: { action: 'approve' | 'reject' },
  ) {
    return this.adminUsersService.approveRequest(
      req.adminHospitalId,
      requestId,
      req.adminUserId,
      body.action,
    );
  }
}
