/**
 * Exports Controller
 * 
 * Provides endpoints for requesting data exports.
 * Exports are processed asynchronously via the job queue system.
 * 
 * Requirements: 9.2
 */

import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { RequestExportDto } from './dto/request-export.dto';
import { ExportStatusDto } from './dto/export-status.dto';
import { ExportsService } from './exports.service';

/**
 * Exports Controller
 * 
 * Handles export requests by enqueuing export_generation jobs.
 * Exports are processed asynchronously and delivered via the specified method.
 */
@ApiTags('exports')
@UseGuards(ApiKeyGuard)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  /**
   * Request a data export
   * 
   * Enqueues an export_generation job to process the export asynchronously.
   * The export will be delivered via the specified deliveryMethod.
   * 
   * @param dto - Export request parameters
   * @returns Job ID for tracking the export
   * 
   * **Validates: Requirement 9.2**
   */
  @Post()
  @ApiOperation({ summary: 'Request a data export' })
  @ApiResponse({
    status: 201,
    description: 'Export job enqueued successfully',
    schema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Job ID for tracking the export' },
        message: { type: 'string', description: 'Success message' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters',
  })
  async requestExport(@Body() dto: RequestExportDto): Promise<{ jobId: string; message: string }> {
    return this.exportsService.requestExport(dto);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get export status' })
  @ApiResponse({ status: 200, type: ExportStatusDto })
  @ApiResponse({ status: 404, description: 'Export not found' })
  async getStatus(@Param('id') id: string): Promise<ExportStatusDto> {
    return this.exportsService.getStatus(id);
  }
}
