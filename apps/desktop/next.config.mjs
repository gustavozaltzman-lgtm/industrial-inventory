/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tauri sirve el frontend como archivos estáticos desde el binario: no hay
  // servidor Node en el cliente de escritorio, así que ninguna de las
  // features de servidor de Next (route handlers, server actions, ISR)
  // está disponible acá. Es por esto que el patrón BFF de apps/web no se
  // replica en desktop — ver ARCHITECTURE.md.
  output: "export",
  distDir: "out",
  images: { unoptimized: true },
  transpilePackages: ["@indinv/core-domain"],
};

export default nextConfig;
