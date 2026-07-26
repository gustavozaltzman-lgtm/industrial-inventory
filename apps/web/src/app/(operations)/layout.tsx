import type { ReactNode } from "react";
import Link from "next/link";
import { Boxes, Cpu, Settings, Activity } from "lucide-react";
import { QueryProvider } from "@/providers/QueryProvider";

/** Los 4 módulos del Operations Center. */
const MODULES = [
  { href: "/dashboard", label: "Operaciones", Icon: Activity },
  { href: "/inventory", label: "Inventario", Icon: Boxes },
  { href: "/devices", label: "Dispositivos", Icon: Cpu },
  { href: "/administration", label: "Administración", Icon: Settings },
] as const;

export default function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <div className="min-h-screen">
        <header className="border-b">
          <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
            <span className="text-sm font-semibold tracking-tight">IndInv · Operations</span>

            <nav aria-label="Módulos del centro de operaciones">
              <ul className="flex items-center gap-1">
                {MODULES.map(({ href, label, Icon }) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon aria-hidden className="h-4 w-4" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </div>
    </QueryProvider>
  );
}
