import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'ok',
        database: {
          status: 'up',
          latencyMs: Date.now() - startedAt,
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: { status: 'down' },
      });
    }
  }
}
