import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';
import { DomainErrorFilter } from './shared/infrastructure/http/domain-error.filter.js';
import { applySecurityHeaders } from './shared/infrastructure/http/security-headers.js';
import type { Env } from './shared/config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  applySecurityHeaders(app);
  const config = app.get(ConfigService<Env, true>);

  // La frontera donde los errores de dominio se vuelven respuestas HTTP.
  app.useGlobalFilters(new DomainErrorFilter());

  // Evita carreras de socket hang up con clientes HTTP manteniendo la conexion abierta mas tiempo que el cliente.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
