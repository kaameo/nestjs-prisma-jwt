import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    return this.health.check([
      // Database health
      () => this.prismaHealth.pingCheck('database', this.prisma),

      // Memory health (heap should not exceed 150MB)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      // Memory RSS should not exceed 300MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),

      // Disk storage health (should have at least 50% free space)
      () =>
        this.disk.checkStorage('disk', {
          path: '/',
          thresholdPercent: 0.5,
        }),
    ]);
  }
}
