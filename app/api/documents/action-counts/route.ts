import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Returns counts of documents that need user action.
 * hsaPending: HSA/FSA eligible docs with status pending or submitted (not yet reimbursed).
 * taxUnclaimed: docs with a meaningful tax_category whose tax_status is not "claimed".
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const docs = await prisma.document.findMany({
    where: { userId },
    select: { status: true, extractedData: true },
  });

  let hsaPending = 0;
  let taxUnclaimed = 0;

  for (const doc of docs) {
    const data = (doc.extractedData as Record<string, unknown>) ?? {};

    if (data.hsa_fsa_eligible === true) {
      if (doc.status === "pending" || doc.status === "submitted") {
        hsaPending++;
      }
    }

    const taxCat = typeof data.tax_category === "string" ? data.tax_category : "";
    if (taxCat && taxCat !== "unknown" && taxCat !== "personal") {
      const taxStatus = typeof data.tax_status === "string" ? data.tax_status : "pending";
      if (taxStatus !== "claimed") {
        taxUnclaimed++;
      }
    }
  }

  return NextResponse.json({ hsaPending, taxUnclaimed });
}
