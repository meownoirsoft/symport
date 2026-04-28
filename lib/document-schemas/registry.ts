/**
 * Schema registry: one place to define all document kinds and their
 * standard fields. Enables consistent data after capture and optional
 * alignment with external standards (e.g. Schema.org).
 */

export type DocumentKind =
  | "receipt"
  | "financial"
  | "medical"
  | "government"
  | "legal"
  | "identity"
  | "general";

export interface DocumentSchema {
  kind: DocumentKind;
  standardFields: readonly string[];
  /** Map from raw/AI key to canonical field name (e.g. pharmacy -> vendor). */
  aliases?: Record<string, string>;
  /** Schema.org type for JSON-LD export (e.g. "Invoice", "Order"). */
  schemaOrgType?: string;
  /** Map from our canonical field to Schema.org property name. */
  schemaOrgFieldMap?: Record<string, string>;
}

export const DOCUMENT_KINDS: DocumentKind[] = [
  "receipt",
  "financial",
  "medical",
  "government",
  "legal",
  "identity",
  "general",
];

export const DOCUMENT_SCHEMAS: Record<DocumentKind, DocumentSchema> = {
  receipt: {
    kind: "receipt",
    standardFields: [
      "amount",
      "date",
      "vendor",
      "category",
      "payment_method",
      "tax",
      "currency",
      "tax_category",
      "hsa_fsa_eligible",
      "title",
      "tags",
    ],
    aliases: {
      total: "amount",
      copay_amount: "amount",
      total_paid: "amount",
      pharmacy: "vendor",
      merchant: "vendor",
      store: "vendor",
      seller: "vendor",
      payment: "payment_method",
      paid_with: "payment_method",
    },
    schemaOrgType: "Order",
    schemaOrgFieldMap: {
      amount: "totalPrice",
      date: "orderDate",
      vendor: "seller",
      payment_method: "paymentMethod",
      currency: "priceCurrency",
    },
  },
  financial: {
    kind: "financial",
    standardFields: [
      "amount_due",
      "amount_paid",
      "date",
      "due_date",
      "party",
      "account_ref",
      "status",
      "period_start",
      "period_end",
      "tax_category",
      "hsa_fsa_eligible",
      "title",
      "tags",
    ],
    aliases: {
      patient_responsibility: "amount_due",
      billed_amount: "amount_due",
      balance_due: "amount_due",
      insurance_paid: "amount_paid",
      paid: "amount_paid",
      provider: "party",
      insurer: "party",
      utility: "party",
      payee: "party",
      account_number: "account_ref",
      account_id: "account_ref",
      member_id: "account_ref",
      claim_number: "account_ref",
      service_date: "date",
      date_issued: "date",
    },
    schemaOrgType: "Invoice",
    schemaOrgFieldMap: {
      amount_due: "totalPaymentDue",
      due_date: "paymentDueDate",
      party: "provider",
      account_ref: "accountId",
      status: "paymentStatus",
    },
  },
  medical: {
    kind: "medical",
    standardFields: [
      "provider",
      "date",
      "patient_ref",
      "document_type",
      "amount",
      "insurer",
      "service_date",
      "tax_category",
      "hsa_fsa_eligible",
      "title",
      "tags",
    ],
    aliases: {
      pharmacy: "provider",
      member_id: "patient_ref",
      account_number: "patient_ref",
      type: "document_type",
      copay_amount: "amount",
      patient_responsibility: "amount",
    },
  },
  government: {
    kind: "government",
    standardFields: ["title", "date", "issuing_authority", "reference_id", "summary", "tags"],
    schemaOrgType: "GovernmentService",
    schemaOrgFieldMap: {
      issuing_authority: "serviceOperator",
      date: "dateModified",
    },
  },
  legal: {
    kind: "legal",
    standardFields: ["title", "date", "parties", "reference_id", "summary", "tags"],
    schemaOrgFieldMap: {
      date: "dateSigned",
    },
  },
  identity: {
    kind: "identity",
    standardFields: ["title", "document_type", "issuer", "date", "reference_id", "tags"],
    schemaOrgFieldMap: {
      issuer: "issuer",
      document_type: "name",
    },
  },
  general: {
    kind: "general",
    standardFields: ["title", "summary", "date", "issuer", "key_fields", "action_required", "tags"],
    schemaOrgFieldMap: {
      title: "name",
      summary: "description",
      date: "datePublished",
    },
  },
};

export function getSchema(kind: DocumentKind): DocumentSchema {
  return DOCUMENT_SCHEMAS[kind];
}

export function getPromptStandardFieldsSection(): string {
  const lines: string[] = [
    "STANDARD FIELDS (use these exact key names when applicable so data is consistent after capture):",
  ];
  for (const kind of DOCUMENT_KINDS) {
    if (kind === "general") continue;
    const schema = DOCUMENT_SCHEMAS[kind];
    const fields = schema.standardFields.filter((f) => f !== "title" && f !== "tags").join(", ");
    lines.push(`When category is "${kind}", include: ${fields}.`);
  }
  lines.push(
    'When category is "general": title, summary?, date?, issuer?, key_fields? (object), action_required?.'
  );
  lines.push(
    [
      'TAX_CATEGORY (US tax bucket — pick the closest single value, or "unknown"):',
      '- "medical": qualified medical/dental expense (Schedule A medical; also potential HSA/FSA reimbursement)',
      '- "charity": donation to a 501(c)(3) or similar (Schedule A charitable)',
      '- "tax_payment": state/local/property/estimated tax paid (Schedule A SALT)',
      '- "mortgage_interest": home mortgage interest (Schedule A interest)',
      '- "business_expense": ordinary and necessary self-employed business expense (Schedule C)',
      '- "personal": personal expense, not deductible',
      '- "unknown": cannot determine from document',
    ].join("\n")
  );
  lines.push(
    [
      'HSA_FSA_ELIGIBLE (true/false/null per IRS Pub 502 qualified medical expenses):',
      '- true: clearly qualified (Rx copays, prescription drugs, doctor/dentist/vision visits, eligible medical equipment, eligible OTC items with Rx)',
      '- false: clearly NOT qualified (cosmetic procedures, gym memberships, general-wellness vitamins without Rx, toiletries)',
      '- null: cannot determine',
    ].join("\n")
  );
  return lines.join("\n\n");
}
