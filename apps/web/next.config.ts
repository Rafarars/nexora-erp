import type { NextConfig } from "next";
import path from "node:path";

// Sin script-src: Next inyecta scripts en linea y exigirlo pide nonces por peticion.
// Lo que si se cierra aqui es lo que no rompe nada: incrustar la aplicacion en otra
// pagina, cargar plugins y enviar formularios a otro dominio.
const CONTENT_SECURITY_POLICY = [
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Empaqueta solo lo necesario para ejecutar: imagen mucho mas liviana.
  output: "standalone",
  // En un monorepo hay que decirle donde empieza el proyecto.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  // Anunciar el framework solo ayuda a quien busca vulnerabilidades de esa version.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
