export type BusinessSummary = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

export type BusinessesResponse = {
  data?: {
    organizations?: BusinessSummary[];
  };
  error?: {
    message?: string;
  };
};

export type WhatsAppConnectionContext = {
  orgId: string;
  provider: "BAILEYS";
  connectionStatus: "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED" | "ERROR";
  lastError: string | null;
  qrCode: string | null;
  qrCodeExpiresAt: string | null;
  pairingCode: string | null;
  pairingCodeExpiresAt: string | null;
  connectedAccount: {
    id: string;
    displayPhone: string;
    phoneNumberId: string;
    connectedAt: string;
  } | null;
};

export type WhatsAppConnectionResponse = {
  data?: {
    connection?: WhatsAppConnectionContext;
  };
  error?: {
    message?: string;
  };
};

export type StartPairingResponse = {
  data?: {
    pairing?: {
      orgId: string;
      connectionStatus: "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED" | "ERROR";
      pairingCode: string;
      expiresInSeconds: number;
    };
    qr?: {
      orgId: string;
      connectionStatus: "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED" | "ERROR";
      qrCode: string;
      expiresInSeconds: number;
    };
  };
  error?: {
    message?: string;
  };
};

export type VerifyTestMessageResponse = {
  data?: {
    verification?: {
      orgId: string;
      toPhoneE164: string;
      waMessageId: string | null;
      sentAt: string;
    };
  };
  error?: {
    message?: string;
  };
};

export type WhatsAppReportResponse = {
  data?: {
    report?: {
      connectedAccount: {
        id: string;
        displayPhone: string;
        phoneNumberId: string;
        connectedAt: string;
      } | null;
      metrics: {
        incomingToday: number;
        outgoingToday: number;
        failedToday: number;
        broadcastMonth: number;
      };
      agentActivity: Array<{
        memberId: string;
        agentName: string;
        role: string;
        messagesSent: number;
        performance: string;
      }>;
      technical: {
        sessionId: string;
        connectedSince: string | null;
        uptimeLabel: string;
        status: "DISCONNECTED" | "CONNECTING" | "PAIRING" | "CONNECTED" | "ERROR";
        lastError: string | null;
      };
    };
  };
  error?: {
    message?: string;
  };
};
