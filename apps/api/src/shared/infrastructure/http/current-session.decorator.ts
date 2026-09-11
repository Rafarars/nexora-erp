import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export interface CurrentSession {
  userId: string;
  tenantId: string;
}

// La identidad la pone el guardian tras verificar la firma. El controlador la recibe
// ya resuelta y nunca la lee del cuerpo: si no, cualquiera actuaria a nombre de otro.
export const Session = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentSession => {
    return context.switchToHttp().getRequest().session;
  },
);
