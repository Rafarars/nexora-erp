import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { HealthController } from './health.controller.js';
import type { PrismaService } from '../shared/prisma/prisma.service.js';

// Doble en memoria: la prueba no necesita base de datos ni contenedores.
function prismaThat(behaviour: 'answers' | 'fails'): PrismaService {
  return {
    $queryRaw: async () => {
      if (behaviour === 'fails') throw new Error('connection refused');
      return [{ ok: 1 }];
    },
  } as unknown as PrismaService;
}

describe('HealthController', () => {
  it('reports the database as up when it answers', async () => {
    const controller = new HealthController(prismaThat('answers'));

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.database.status).toBe('up');
    expect(result.database.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('throws a 503 when the database does not answer', async () => {
    const controller = new HealthController(prismaThat('fails'));

    await expect(controller.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
