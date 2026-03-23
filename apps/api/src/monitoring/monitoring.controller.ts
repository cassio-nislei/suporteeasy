import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { MonitoringIngestDto } from './dto/monitoring-ingest.dto';
import { MonitoringService } from './monitoring.service';

@ApiTags('monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Post('ingest')
  @Public()
  @ApiOperation({ summary: 'Ingest metrics from agent token' })
  async ingest(@Body() dto: MonitoringIngestDto) {
    return this.monitoringService.ingestMetrics(dto);
  }
}
