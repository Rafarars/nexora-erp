export const BUSINESS_CALENDAR = Symbol('BusinessCalendar');

// Que dia es hoy para una empresa, en su zona horaria. Lo publica el contexto de empresas y lo usan
// los documentos para proponer su fecha y rechazar las futuras: el dia UTC no es el de quien trabaja.
export interface BusinessCalendar {
  // `YYYY-MM-DD`
  today(tenantId: string): Promise<string>;
}
