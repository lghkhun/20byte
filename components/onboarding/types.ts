export type OrganizationSummary = {
  id: string;
  name: string;
  role: string;
  createdAt: string;
};

export type OnboardingStatus = {
  orgId: string;
  orgName: string;
  isCompleted: boolean;
  currentStep: number;
  totalSteps: number;
  nextStep: "CONNECT_WHATSAPP" | "DONE";
};

export type OrganizationsResponse = {
  data?: {
    organizations?: OrganizationSummary[];
  };
  error?: {
    message?: string;
  };
};

export type OnboardingResponse = {
  data?: {
    onboarding?: OnboardingStatus;
  };
  error?: {
    message?: string;
  };
};

export type CreateOrganizationResponse = {
  data?: {
    organization?: OrganizationSummary;
  };
  error?: {
    message?: string;
  };
};

export type EmbeddedSignupContext = {
  orgId: string;
  appId: string | null;
  configId: string | null;
  callbackPath: string;
  state: string;
  connectedAccount: {
    id: string;
    displayPhone: string;
    phoneNumberId: string;
    connectedAt: string;
  } | null;
};

export type EmbeddedSignupResponse = {
  data?: {
    embeddedSignup?: EmbeddedSignupContext;
  };
  error?: {
    message?: string;
  };
};

export type ConnectWhatsAppResponse = {
  data?: {
    waAccount?: {
      id: string;
      phoneNumberId: string;
      displayPhone: string;
      connectedAt: string;
      postConnect?: {
        webhookVerified: boolean;
        testEventTriggered: boolean;
      };
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
