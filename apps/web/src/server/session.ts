import "server-only";
import type { UserRole } from "@indinv/core-domain";

/**
 * Identidad resuelta EN EL SERVIDOR. Nunca se construye a partir de datos
 * enviados por el navegador.
 */
export interface Session {
  tenantId: string;
  userId: string;
  role: UserRole;
}

export class UnauthorizedError extends Error {
  constructor(message = "No hay sesión activa") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Puerto de resolución de sesión.
 *
 * ESTADO ACTUAL: el proyecto todavía no tiene autenticación (no hay login, ni
 * emisión de JWT, ni endpoints de sesión). Hasta que exista, esto devuelve un
 * tenant de desarrollo tomado de una variable de entorno del servidor.
 *
 * Lo que SÍ se cumple ya, y es el punto del principio de "No Header Trust":
 * el `tenantId` se decide exclusivamente del lado servidor. El navegador nunca
 * lo envía ni puede influirlo, porque los route handlers ignoran cualquier
 * header de tenant que llegue del cliente (ver withSession).
 *
 * Cuando exista auth real, se reemplaza el cuerpo de esta función por la
 * verificación del JWT y la lectura de sus claims. Ningún consumidor cambia.
 */
export async function getSession(): Promise<Session | null> {
  const tenantId = process.env.INDINV_DEV_TENANT_ID;
  if (!tenantId) return null;

  return {
    tenantId,
    userId: process.env.INDINV_DEV_USER_ID ?? "00000000-0000-0000-0000-0000000000ff",
    role: "ADMIN",
  };
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new UnauthorizedError();
  return session;
}
