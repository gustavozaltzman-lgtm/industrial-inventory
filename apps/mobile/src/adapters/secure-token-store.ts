import * as SecureStore from "expo-secure-store";

const AUTH_TOKEN_KEY = "indinv.auth.token";
const TENANT_ID_KEY = "indinv.auth.tenantId";

export interface StoredCredentials {
  token: string;
  tenantId: string;
}

/**
 * Guarda credenciales (token de sesión + tenantId) en el keychain/keystore
 * del dispositivo vía Expo SecureStore, nunca en SQLite plano ni AsyncStorage.
 * `apps/mobile` no implementa todavía el flujo de login; este adapter deja
 * lista la capa de almacenamiento seguro para cuando se agregue auth real.
 */
export class SecureTokenStore {
  async save(credentials: StoredCredentials): Promise<void> {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, credentials.token);
    await SecureStore.setItemAsync(TENANT_ID_KEY, credentials.tenantId);
  }

  async load(): Promise<StoredCredentials | null> {
    const [token, tenantId] = await Promise.all([
      SecureStore.getItemAsync(AUTH_TOKEN_KEY),
      SecureStore.getItemAsync(TENANT_ID_KEY),
    ]);

    if (!token || !tenantId) {
      return null;
    }

    return { token, tenantId };
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TENANT_ID_KEY);
  }
}
