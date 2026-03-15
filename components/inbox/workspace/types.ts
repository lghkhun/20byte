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

export type CustomerNoteItem = {
  id: string;
  content: string;
  authorUserId: string;
  createdAt: string;
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
    message?: string;
  };
};

export type ConversationFetchResponse = {
  data?: {
    conversation?: ConversationItem;
  };
  error?: {
    message?: string;
  };
};

export type OrganizationsResponse = {
  data?: {
    organizations?: OrgSummary[];
  };
  error?: {
    message?: string;
  };
};

export type ListMessagesResponse = {
  data?: {
    messages?: MessageItem[];
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
  error?: {
    message?: string;
  };
};

export type SendMessageResponse = {
  data?: {
    message?: {
      id: string;
      sendStatus?: "PENDING" | "SENT" | "FAILED";
      sendError?: string | null;
    };
  };
  error?: {
    message?: string;
  };
};

export type AssignConversationResponse = {
  error?: {
    message?: string;
  };
};

export type CustomerTagsResponse = {
  data?: {
    tags?: CustomerTagItem[];
  };
  error?: {
    message?: string;
  };
};

export type CustomerNotesResponse = {
  data?: {
    notes?: CustomerNoteItem[];
  };
  error?: {
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
    message?: string;
  };
};

export type CreateNoteResponse = {
  error?: {
    message?: string;
  };
};

export type UpdateNoteResponse = {
  error?: {
    message?: string;
  };
};

export type DeleteNoteResponse = {
  error?: {
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
