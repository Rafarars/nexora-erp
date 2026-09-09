import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Empaqueta solo lo necesario para ejecutar: imagen mucho mas liviana.
  output: "standalone",
  // En un monorepo hay que decirle donde empieza el proyecto.
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
};

export default nextConfig;
