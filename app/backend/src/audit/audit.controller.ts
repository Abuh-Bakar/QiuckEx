import { Controller, Get, Query, Res, Delete } from '@nestjs/common';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './audit.model';
import { Response } from 'express';
import { RateLimitTier } from '../auth/decorators/rate-limit-group.decorator';

@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RateLimitTier("public-read")
  queryLogs(@Query() query: QueryAuditLogsDto) {
    return this.auditService.query(query);
  }

  @Get('export')
  @RateLimitTier("export")
  async exportCsv(@Res() res: Response) {
    const csv = await this.auditService.exportCsv();
    res.header('Content-Type', 'text/csv');
    res.attachment('audit-logs.csv');
    return res.send(csv);
  }

  @Delete('retention')
  @RateLimitTier("mutation")
  applyRetentionStrategy() {
    return this.auditService.applyRetention(90);
  }
}
