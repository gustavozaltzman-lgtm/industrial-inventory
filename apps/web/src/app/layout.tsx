import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "IndInv Dashboard",
  description: "Dashboard administrativo de inventario industrial",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
