import { NextResponse } from 'next/server';
import { exportPath } from '@/modules/reports/domain/reports';
import { readableReportsError } from '@/modules/reports/domain/reports-error';
import { AccessError } from '@/modules/access/domain/access-error';
import { reportsApi } from '@/shared/session/reports-api';
import { readToken } from '@/shared/session/session-cookie';

// Descarga un reporte con el token de la cookie. Solo reenvia las rutas de exportacion conocidas y
// devuelve el archivo con su tipo y su nombre; un error llega en espanol, nunca el texto de la API.
export async function GET(request: Request): Promise<Response> {
  const token = await readToken();

  if (!token) return NextResponse.redirect(new URL('/login', request.url));

  const path = exportPath(new URL(request.url).searchParams);

  if (!path) return new NextResponse('Ese reporte no existe.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

  const response = await reportsApi().download(token, path);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = AccessError.fromStatus(response.status, { message: '', code: typeof body.error === 'string' ? body.error : '', fields: [] });

    return new NextResponse(readableReportsError(error, 'No se pudo generar el reporte.'), { status: response.status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  return new NextResponse(response.body, {
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': response.headers.get('content-disposition') ?? 'attachment',
      'Cache-Control': 'no-store',
    },
  });
}
