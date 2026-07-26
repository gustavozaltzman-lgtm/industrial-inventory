import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Cada test arranca con un QueryClient propio y sin reintentos: compartirlo
 * filtraría cache entre tests, y los reintentos harían que un test de error
 * espere varios segundos antes de mostrar el estado que se quiere verificar.
 *
 * Devuelve solo el queryClient (los tests consultan vía `screen`). Exponer el
 * RenderResult completo obliga a nombrar tipos de pretty-format, del que hay
 * dos versiones en el árbol de dependencias.
 */
export function renderWithQuery(ui: ReactElement): { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  render(ui, { wrapper: Wrapper });
  return { queryClient };
}
