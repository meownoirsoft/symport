import { join } from "path";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import { prisma } from "@/lib/db";

const SETTING_KEY = "categoryConfig";

export type CategoryOverrides = Record<string, string | null>;

export type CategoryConfig = {
  /** User-defined category list; if absent, use built-in. Must include "Other" when set. */
  categories?: string[] | null;
  /** Tag (normalized) -> category name or null for Other. */
  tagToCategory?: CategoryOverrides | null;
  /** Free-text notes per category name. */
  categoryNotes?: Record<string, string> | null;
};

function ensureOtherLast(cats: string[]): string[] {
  const other = "Other";
  const rest = cats.filter((c) => c !== other);
  return [...rest, other];
}

function parseConfig(data: Record<string, unknown>): CategoryConfig {
  return {
    categories: Array.isArray(data.categories)
      ? ensureOtherLast(data.categories as string[])
      : undefined,
    tagToCategory:
      typeof data.tagToCategory === "object" && data.tagToCategory !== null
        ? (data.tagToCategory as CategoryOverrides)
        : {},
    categoryNotes:
      typeof data.categoryNotes === "object" && data.categoryNotes !== null
        ? (data.categoryNotes as Record<string, string>)
        : {},
  };
}

/**
 * Read the bundled JSON seed file as a fallback when no DB row exists yet.
 * This provides zero-friction migration: existing config is visible immediately
 * without a manual seed step, and gets written to the DB on first save.
 */
function readJsonFallback(): CategoryConfig | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync } = require("fs");
    const filePath = join(process.cwd(), "data", "category-overrides.json");
    const raw = readFileSync(filePath, "utf-8") as string;
    const data = JSON.parse(raw) as Record<string, unknown>;
    return parseConfig(data);
  } catch {
    return null;
  }
}

/** Read full config from the database, falling back to the bundled JSON file. */
export async function readCategoryConfig(): Promise<CategoryConfig> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
    if (row) {
      return parseConfig(row.value as Record<string, unknown>);
    }
  } catch {
    // DB error — try JSON fallback below
  }
  return readJsonFallback() ?? { tagToCategory: {}, categoryNotes: {} };
}

/** Write full config to the database. */
export async function writeCategoryConfig(config: CategoryConfig): Promise<void> {
  const toWrite: CategoryConfig = {
    ...config,
    categories: config.categories ? ensureOtherLast(config.categories) : undefined,
  };
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: toWrite as object },
    update: { value: toWrite as object },
  });
}

/** Effective category list: user list if set, else built-in. Always has Other last. */
export async function getEffectiveCategories(): Promise<string[]> {
  const config = await readCategoryConfig();
  if (config.categories && config.categories.length > 0) {
    return ensureOtherLast([...config.categories]);
  }
  return [...DOCUMENT_CATEGORIES];
}

/** Read only tag->category overrides. */
export async function readCategoryOverrides(): Promise<CategoryOverrides> {
  const config = await readCategoryConfig();
  return config.tagToCategory ?? {};
}

/** Write only tagToCategory; leaves other config fields unchanged. */
export async function writeCategoryOverrides(overrides: CategoryOverrides): Promise<void> {
  const config = await readCategoryConfig();
  await writeCategoryConfig({ ...config, tagToCategory: overrides });
}

/** Update full config (categories and/or tagToCategory and/or categoryNotes). */
export async function writeFullCategoryConfig(updates: Partial<CategoryConfig>): Promise<void> {
  const config = await readCategoryConfig();
  const next: CategoryConfig = {
    categories: updates.categories !== undefined ? updates.categories : config.categories,
    tagToCategory:
      updates.tagToCategory !== undefined
        ? updates.tagToCategory
        : (config.tagToCategory ?? {}),
    categoryNotes:
      updates.categoryNotes !== undefined
        ? updates.categoryNotes
        : (config.categoryNotes ?? {}),
  };
  await writeCategoryConfig(next);
}
