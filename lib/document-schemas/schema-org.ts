/**
 * Build Schema.org JSON-LD from normalized extracted data and document kind.
 * Used for export and API (e.g. GET /api/documents/:id?format=schema.org).
 */

import type { DocumentKind } from "./registry";
import { getSchema } from "./registry";

const SCHEMA_ORG_CONTEXT = "https://schema.org";

export interface SchemaOrgOutput {
  "@context": string;
  "@type": string;
  [key: string]: unknown;
}

/**
 * Given normalized extractedData and its doc_category (document kind),
 * returns a Schema.org JSON-LD object for interoperability.
 */
export function toSchemaOrgJsonLd(
  data: Record<string, unknown>,
  kind: DocumentKind
): SchemaOrgOutput {
  const schema = getSchema(kind);
  const type = schema.schemaOrgType ?? "Thing";
  const out: SchemaOrgOutput = {
    "@context": SCHEMA_ORG_CONTEXT,
    "@type": type,
  };

  const fieldMap = schema.schemaOrgFieldMap;
  if (!fieldMap) return out;

  for (const [ourField, schemaOrgProp] of Object.entries(fieldMap)) {
    const value = data[ourField];
    if (value == null || value === "") continue;
    (out as Record<string, unknown>)[schemaOrgProp] = value;
  }

  return out;
}
