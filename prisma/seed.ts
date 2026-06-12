import { PrismaClient } from "@prisma/client";
import { DEFAULT_PERSONAS } from "./seed-personas";

const prisma = new PrismaClient();

async function main() {
  for (const p of DEFAULT_PERSONAS) {
    const existing = await prisma.persona.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.persona.update({
        where: { id: existing.id },
        data: {
          displayName: p.displayName,
          modelString: p.modelString,
          provider: p.provider,
          description: p.description ?? null,
          costTier: p.costTier,
          avatarUrl: p.avatarUrl ?? existing.avatarUrl,
        },
      });
    } else {
      await prisma.persona.create({
        data: {
          name: p.name,
          displayName: p.displayName,
          modelString: p.modelString,
          provider: p.provider,
          description: p.description ?? null,
          costTier: p.costTier,
          avatarUrl: p.avatarUrl ?? null,
        },
      });
    }
  }
  console.log("Seeded", DEFAULT_PERSONAS.length, "personas");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
