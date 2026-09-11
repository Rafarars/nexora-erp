import { Controller, Get } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { AccessGuard } from './access.guard.js';
import { AuthenticatedOnly } from '../../../../shared/infrastructure/http/authenticated.decorator.js';
import { Public } from '../../../../shared/infrastructure/http/public.decorator.js';
import { RequirePermission } from '../../../../shared/infrastructure/http/require-permission.decorator.js';
import { ContradictoryDeclarationError } from '../../domain/errors/contradictory-declaration.error.js';
import { UndeclaredEndpointError } from '../../domain/errors/undeclared-endpoint.error.js';

@Controller()
class UndeclaredController {
  @Get()
  run() {}
}

@Controller()
class PublicController {
  @Get()
  @Public()
  run() {}
}

// El caso que abria la puerta en silencio: el decorador de la clase y el del metodo
// CONVIVEN, no se anulan. Si el guardian mirase `@Public()` primero, este endpoint
// quedaria abierto sin comprobar el permiso.
@Public()
@Controller()
class PublicClassWithProtectedMethod {
  @Get()
  @RequirePermission('access.users.search')
  run() {}
}

@Controller()
class AuthenticatedController {
  @Get()
  @AuthenticatedOnly()
  run() {}
}

function contextFor(target: new () => { run: () => void }): ExecutionContext {
  return {
    getHandler: () => target.prototype.run,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
  } as unknown as ExecutionContext;
}

// Solo se prueba la decision de acceso: los repositorios no llegan a usarse en
// ninguno de estos casos, porque todos se resuelven antes de leer el token.
function guard(): AccessGuard {
  return new AccessGuard(
    new Reflector(),
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
  );
}

describe('AccessGuard declarations', () => {
  it('lets a public route through', async () => {
    expect(await guard().canActivate(contextFor(PublicController))).toBe(true);
  });

  // Denegar por defecto: lo que nadie declaro no se abre "porque nadie dijo lo contrario".
  it('closes a route that declares nothing', async () => {
    await expect(guard().canActivate(contextFor(UndeclaredController))).rejects.toThrow(
      UndeclaredEndpointError,
    );
  });

  it('closes a route whose class is public but whose method requires a permission', async () => {
    await expect(
      guard().canActivate(contextFor(PublicClassWithProtectedMethod)),
    ).rejects.toThrow(ContradictoryDeclarationError);
  });

  it('asks for a token when the route only requires authentication', async () => {
    // Sin cabecera no hay sesion: llega a pedir el token en vez de dejar pasar.
    await expect(guard().canActivate(contextFor(AuthenticatedController))).rejects.toThrow(
      /Invalid or expired session/,
    );
  });
});
