import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

const CONFIG_PATH = join(process.cwd(), "data", "category-overrides.json");

export type CategoryOverrides = Record<string, string | null>;

export type CategoryConfig = {
  /** User-defined category list; if absent, use built-in. Must include "Other" when set. */
  categories?: string[] | null;
  /** Tag (normalized) -> category name or null for Other. */
  tagToCategory?: CategoryOverrides | null;
};

function ensureDataDir() {
  const dir = join(process.cwd(), "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function ensureOtherLast(cats: string[]): string[] {
  const other = "Other";
  const rest = cats.filter((c) => c !== other);
  return [...rest, other];
}

/** Read full config from file. */
export function readCategoryConfig(): CategoryConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return {};
    return {
      categories: Array.isArray(data.categories) ? ensureOtherLast(data.categories) : undefined,
      tagToCategory:
        typeof data.tagToCategory === "object" && data.tagToCategory !== null
          ? data.tagToCategory
          : {},
    };
  } catch {
    return { tagToCategory: {} };
  }
}

/** Write full config. */
export function writeCategoryConfig(config: CategoryConfig): void {
  ensureDataDir();
  const toWrite: CategoryConfig = {
    ...config,
    categories: config.categories ? ensureOtherLast(config.categories) : undefined,
  };
  writeFileSync(CONFIG_PATH, JSON.stringify(toWrite, null, 2), "utf-8");
}

/** Effective category list: user list if set, else built-in. Always has Other last. */
export function getEffectiveCategories(): string[] {
  const config = readCategoryConfig();
  if (config.categories && config.categories.length > 0) {
    return ensureOtherLast([...config.categories]);
  }
  return [...DOCUMENT_CATEGORIES];
}

/** Read only tag->category overrides (for backward compat and merge with built-in). */
export function readCategoryOverrides(): CategoryOverrides {
  const config = readCategoryConfig();
  return config.tagToCategory ?? {};
}

/** Write only tagToCategory; leaves categories unchanged. */
export function writeCategoryOverrides(overrides: CategoryOverrides): void {
  const config = readCategoryConfig();
  writeCategoryConfig({ ...config, tagToCategory: overrides });
}

/** Update full config (categories and/or tagToCategory). */
export function writeFullCategoryConfig(updates: Partial<CategoryConfig>): void {
  const config = readCategoryConfig();
  const next: CategoryConfig = {
    categories: updates.categories !== undefined ? updates.categories : config.categories,
    tagToCategory: updates.tagToCategory !== undefined ? updates.tagToCategory : config.tagToCategory ?? {},
  };
  writeCategoryConfig(next);
}
