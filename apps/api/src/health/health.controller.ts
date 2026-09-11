import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service.js';
import { Public } from '../shared/infrastructure/http/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Lo consulta el healthcheck del contenedor y el panel del frontend, sin sesion.
  @Get()
  @Public()
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
