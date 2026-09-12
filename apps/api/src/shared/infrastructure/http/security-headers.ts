import type { INestApplication } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// Escrito a mano y no con helmet: la API solo sirve JSON, y cuatro cabeceras explicitas
// se leen y se prueban mejor que una dependencia con treinta opciones por defecto.
export function applySecurityHeaders(app: INestApplication): void {
  // Anunciar Express solo ayuda a quien busca vulnerabilidades de esa version.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  app.use((_request: Request, response: Response, next: NextFunction) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    next();
  });
}
