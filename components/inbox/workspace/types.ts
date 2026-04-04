import type { ConversationItem, MessageItem } from "@/components/inbox/types";

export type OrgSummary = {
  id: string;
  name: string;
  role: string;
};

export type CustomerTagItem = {
  id: string;
  name: string;
  color: string;
  isAssigned: boolean;
};

export type CrmInvoiceItem = {
  id: string;
  invoiceNo: string;
  status: string;
  kind: "FULL" | "DP_AND_FINAL";
  totalCents: number;
  currency: string;
  proofCount: number;
  createdAt: string;
};

export type CrmActivityItem = {
  id: string;
  type: "CONVERSATION_STARTED" | "INVOICE_CREATED" | "INVOICE_SENT" | "PROOF_ATTACHED" | "INVOICE_PAID";
  label: string;
  time: string;
};

export type ListConversationsResponse = {
  data?: {
    conversations?: ConversationItem[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type ConversationFetchResponse = {
  data?: {
    conversation?: ConversationItem;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type OrganizationsResponse = {
  data?: {
    organizations?: OrgSummary[];
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type ListMessagesResponse = {
  data?: {
    messages?: MessageItem[];
  };
  meta?: {
    limit?: number;
    hasMore?: boolean;
    nextBeforeMessageId?: string | null;
    total?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type SearchMessagesResponse = {
  data?: {
    messages?: Array<{
      id: string;
      text: string;
      createdAt: string;
    }>;
  };
  meta?: {
    limit?: number;
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type SendMessageResponse = {
  data?: {
    message?: {
      id: string;
      sendStatus?: "PENDING" | "SENT" | "FAILED";
      deliveryStatus?: "SENT" | "DELIVERED" | "READ" | null;
      sendError?: string | null;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type AssignConversationResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export type CustomerTagsResponse = {
  data?: {
    tags?: CustomerTagItem[];
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type CreateTagResponse = {
  data?: {
    tag?: {
      id: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type AttachProofResponse = {
  data?: {
    proof?: {
      id: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
};

export type ConversationCrmContextResponse = {
  data?: {
    invoices?: CrmInvoiceItem[];
    events?: CrmActivityItem[];
  };
  error?: {
    message?: string;
  };
};

export type UpdateConversationStatusResponse = {
  data?: {
    conversation?: ConversationItem;
  };
  error?: {
    message?: string;
  };
};

export type DeleteConversationResponse = {
  data?: {
    conversationId?: string;
  };
  error?: {
    code?: string;
    message?: string;
  };
};
