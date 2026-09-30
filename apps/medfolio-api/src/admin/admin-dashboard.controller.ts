import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminGuard, type AdminRequest } from './admin.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin/dashboard')
@UseGuards(AdminGuard)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  getMetrics(@Req() req: AdminRequest) {
    return this.adminDashboardService.getMetrics(req.adminHospitalId);
  }
}
