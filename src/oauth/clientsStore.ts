import { randomUUID } from "node:crypto";
import type { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import { fetchClientIdMetadataDocument, looksLikeClientIdUrl } from "./cimd.js";
import { logOAuthServerError } from "./logging.js";
import { dynamicallyRegisteredClients } from "./store.js";

export const clientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId: string): Promise<OAuthClientInformationFull | undefined> {
    try {
      if (looksLikeClientIdUrl(clientId)) {
        return await fetchClientIdMetadataDocument(clientId);
      }
      return dynamicallyRegisteredClients.get(clientId);
    } catch (error) {
      // Re-thrown as-is: this only adds visibility into a failure that the
      // SDK's authenticateClient/authorizationHandler would otherwise swallow
      // into an unlogged 500 or 400.
      logOAuthServerError(
        {
          stage: "clientsStore.getClient",
          clientId,
          params: { isClientIdMetadataDocumentUrl: looksLikeClientIdUrl(clientId) },
        },
        error,
      );
      throw error;
    }
  },

  registerClient(
    client: Omit<OAuthClientInformationFull, "client_id" | "client_id_issued_at">,
  ): OAuthClientInformationFull {
    const fullClient: OAuthClientInformationFull = {
      ...client,
      client_id: randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
    };
    dynamicallyRegisteredClients.set(fullClient.client_id, fullClient);
    return fullClient;
  },
};
