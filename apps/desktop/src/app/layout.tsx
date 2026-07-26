import type { ReactNode } from "react";

export const metadata = {
  title: "IndInv Desktop",
  description: "Centro de Operaciones — cliente de escritorio offline-first",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
