import { describe, it, expect } from "vitest";
import { normalizeExtractedData } from "@/lib/normalize-extraction";

// pickBoolean is tested via hsa_fsa_eligible normalization in applyTaxFields.
// pickTaxCategory is tested via tax_category normalization in applyTaxFields.
// applyTaxFields itself is tested through normalizeExtractedData (the public API).

const baseReceipt = { category: "receipt", amount: 10, vendor: "CVS", date: "2025-01-01" };

describe("pickBoolean (via hsa_fsa_eligible)", () => {
  it("passes through a true boolean", () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: true });
    expect(result.hsa_fsa_eligible).toBe(true);
  });

  it("passes through a false boolean", () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: false });
    expect(result.hsa_fsa_eligible).toBe(false);
  });

  it('coerces "true" string to true', () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: "true" });
    expect(result.hsa_fsa_eligible).toBe(true);
  });

  it('coerces "yes" string to true', () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: "yes" });
    expect(result.hsa_fsa_eligible).toBe(true);
  });

  it('coerces "1" string to true', () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: "1" });
    expect(result.hsa_fsa_eligible).toBe(true);
  });

  it('coerces "false" string to false', () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: "false" });
    expect(result.hsa_fsa_eligible).toBe(false);
  });

  it('coerces "no" string to false', () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: "no" });
    expect(result.hsa_fsa_eligible).toBe(false);
  });

  it('coerces "0" string to false', () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: "0" });
    expect(result.hsa_fsa_eligible).toBe(false);
  });

  it("returns null for an unrecognized string", () => {
    const result = normalizeExtractedData({ ...baseReceipt, hsa_fsa_eligible: "maybe" });
    expect(result.hsa_fsa_eligible).toBe(null);
  });

  it("returns null if field is absent", () => {
    const result = normalizeExtractedData({ ...baseReceipt });
    expect(result.hsa_fsa_eligible).toBe(null);
  });
});

describe("pickTaxCategory (via tax_category)", () => {
  it("passes through a valid category", () => {
    const result = normalizeExtractedData({ ...baseReceipt, tax_category: "medical" });
    expect(result.tax_category).toBe("medical");
  });

  it("normalizes uppercase input", () => {
    const result = normalizeExtractedData({ ...baseReceipt, tax_category: "MEDICAL" });
    expect(result.tax_category).toBe("medical");
  });

  it("normalizes hyphen-separated input", () => {
    const result = normalizeExtractedData({ ...baseReceipt, tax_category: "business-expense" });
    expect(result.tax_category).toBe("business_expense");
  });

  it("normalizes space-separated input", () => {
    const result = normalizeExtractedData({ ...baseReceipt, tax_category: "mortgage interest" });
    expect(result.tax_category).toBe("mortgage_interest");
  });

  it('falls back to "unknown" for an unrecognized value', () => {
    const result = normalizeExtractedData({ ...baseReceipt, tax_category: "groceries" });
    expect(result.tax_category).toBe("unknown");
  });

  it("accepts all valid enum members", () => {
    const valid = ["medical", "charity", "tax_payment", "mortgage_interest", "business_expense", "personal", "unknown"];
    for (const v of valid) {
      const result = normalizeExtractedData({ ...baseReceipt, tax_category: v });
      expect(result.tax_category).toBe(v);
    }
  });

  it("returns null if field is absent", () => {
    const result = normalizeExtractedData({ ...baseReceipt });
    expect(result.tax_category).toBe(null);
  });
});

describe("applyTaxFields integration", () => {
  it("applies both fields together on a receipt", () => {
    const result = normalizeExtractedData({
      ...baseReceipt,
      tax_category: "medical",
      hsa_fsa_eligible: true,
    });
    expect(result.tax_category).toBe("medical");
    expect(result.hsa_fsa_eligible).toBe(true);
  });

  it("applies both fields on a financial document", () => {
    const result = normalizeExtractedData({
      category: "financial",
      party: "Acme Insurance",
      date: "2025-03-01",
      tax_category: "Medical",
      hsa_fsa_eligible: "false",
    });
    expect(result.tax_category).toBe("medical");
    expect(result.hsa_fsa_eligible).toBe(false);
  });

  it("applies both fields on a medical document", () => {
    const result = normalizeExtractedData({
      category: "medical",
      provider: "Dr Smith",
      date: "2025-06-15",
      tax_category: "medical",
      hsa_fsa_eligible: "yes",
    });
    expect(result.tax_category).toBe("medical");
    expect(result.hsa_fsa_eligible).toBe(true);
  });

  it("does not overwrite with invalid tax_category when field is null", () => {
    const result = normalizeExtractedData({ ...baseReceipt, tax_category: null });
    expect(result.tax_category).toBe(null);
  });

  it("handles missing both fields gracefully", () => {
    const result = normalizeExtractedData({ ...baseReceipt });
    expect(result.tax_category).toBe(null);
    expect(result.hsa_fsa_eligible).toBe(null);
  });
});
