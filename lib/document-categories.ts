/**
 * Broader topic categories so users can view "Medical" or "Vehicles" instead of
 * many specific tags. Tags are mapped to one category; unmapped tags fall in Other.
 */

export const DOCUMENT_CATEGORIES = [
  "Medical",
  "Vehicles",
  "Household",
  "Family",
  "Work",
  "Legal",
  "Financial",
  "Government",
  "Identity",
  "Notes",
  "Other",
] as const;

export type DocumentCategoryLabel = (typeof DOCUMENT_CATEGORIES)[number];

/** Map tag (lowercase) to category. Add new tags here or use Other for unmapped. */
const TAG_TO_CATEGORY: Record<string, DocumentCategoryLabel> = {
  // Medical
  medical: "Medical",
  health: "Medical",
  insurance: "Medical",
  pharmacy: "Medical",
  medication: "Medical",
  prescription: "Medical",
  doctor: "Medical",
  hospital: "Medical",
  dental: "Medical",
  vision: "Medical",
  eob: "Medical",
  hsa: "Medical",
  fsa: "Medical",
  aetna: "Medical",
  united: "Medical",
  cigna: "Medical",
  anthem: "Medical",
  blue_cross: "Medical",
  delta_dental: "Medical",
  diabetes: "Medical",
  rash: "Medical",
  allergy: "Medical",
  lab: "Medical",
  referral: "Medical",
  copay: "Medical",
  deductible: "Medical",
  claim: "Medical",
  // Vehicles
  vehicle: "Vehicles",
  vehicles: "Vehicles",
  car: "Vehicles",
  cars: "Vehicles",
  auto: "Vehicles",
  automobile: "Vehicles",
  dmv: "Vehicles",
  registration: "Vehicles",
  insurance_card: "Vehicles",
  repair: "Vehicles",
  maintenance: "Vehicles",
  gas: "Vehicles",
  toll: "Vehicles",
  parking: "Vehicles",
  // Household
  household: "Household",
  home: "Household",
  utility: "Household",
  utilities: "Household",
  electric: "Household",
  gas_bill: "Household",
  water: "Household",
  internet: "Household",
  cable: "Household",
  rent: "Household",
  mortgage: "Household",
  hoa: "Household",
  repair_bill: "Household",
  appliance: "Household",
  // Family
  family: "Family",
  school: "Family",
  education: "Family",
  tuition: "Family",
  childcare: "Family",
  pet: "Family",
  pets: "Family",
  vet: "Family",
  // Work
  work: "Work",
  employment: "Work",
  paystub: "Work",
  w2: "Work",
  w_2: "Work",
  contract: "Work",
  offer: "Work",
  benefits: "Work",
  "401k": "Work",
  retirement: "Work",
  // Legal
  legal: "Legal",
  court: "Legal",
  lawyer: "Legal",
  lease: "Legal",
  agreement: "Legal",
  deed: "Legal",
  will: "Legal",
  power_of_attorney: "Legal",
  // Financial
  financial: "Financial",
  receipt: "Financial",
  bank: "Financial",
  statement: "Financial",
  invoice: "Financial",
  bill: "Financial",
  tax: "Financial",
  taxes: "Financial",
  refund: "Financial",
  investment: "Financial",
  loan: "Financial",
  credit: "Financial",
  // Government
  government: "Government",
  id: "Government",
  license: "Government",
  passport: "Government",
  ssn: "Government",
  voter: "Government",
  permit: "Government",
  // Identity
  identity: "Identity",
  // Notes (text-only / note docs)
  note: "Notes",
  notes: "Notes",
};

export function tagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "_");
}

/** User overrides: tag key -> category or null for Other. */
export type CategoryOverridesMap = Record<string, string | null>;

/** Get the category for a tag; returns "Other" if unmapped. Optional overrides take precedence. */
export function getCategoryForTag(
  tag: string,
  overrides?: CategoryOverridesMap
): DocumentCategoryLabel {
  const key = tagKey(tag);
  if (overrides && key in overrides) {
    const v = overrides[key];
    return (v === null || v === undefined ? "Other" : v) as DocumentCategoryLabel;
  }
  return TAG_TO_CATEGORY[key] ?? "Other";
}

/** Get all tags that map to a given category (with optional overrides). */
export function getTagsForCategory(
  category: DocumentCategoryLabel,
  overrides?: CategoryOverridesMap
): string[] {
  const allKeys = new Set<string>(
    Object.keys(TAG_TO_CATEGORY).concat(overrides ? Object.keys(overrides) : [])
  );
  return [...allKeys].filter((t) => getCategoryForTag(t, overrides) === category);
}

/**
 * Get the set of categories a document belongs to (based on its tags).
 * A doc can appear in multiple categories if it has tags mapping to different ones.
 */
export function getCategoriesForDocument(
  tags: string[],
  overrides?: CategoryOverridesMap
): Set<DocumentCategoryLabel> {
  const set = new Set<DocumentCategoryLabel>();
  for (const tag of tags) {
    if (typeof tag === "string" && tag.trim()) {
      set.add(getCategoryForTag(tag, overrides));
    }
  }
  return set;
}

/**
 * True if the document belongs only to "Other" (or no category).
 * Use this so docs that appear in Medical, Financial, etc. do not also show in Other.
 */
export function documentBelongsToOnlyOther(
  tags: string[],
  overrides?: CategoryOverridesMap
): boolean {
  const categories = getCategoriesForDocument(tags, overrides);
  const nonOther = [...categories].filter((c) => c !== "Other");
  return nonOther.length === 0;
}

/** Categories that have at least one mapped tag (for display order). */
export function getCategoriesWithTags(): DocumentCategoryLabel[] {
  const seen = new Set<DocumentCategoryLabel>();
  for (const c of Object.values(TAG_TO_CATEGORY)) {
    seen.add(c);
  }
  return DOCUMENT_CATEGORIES.filter((c) => c === "Other" || seen.has(c));
}
