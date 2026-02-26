import { NextResponse } from "next/server";
import {
  getTagsForCategory,
  tagKey,
} from "@/lib/document-categories";
import {
  readCategoryConfig,
  writeFullCategoryConfig,
  getEffectiveCategories,
  type CategoryOverrides,
} from "@/lib/category-overrides";

/** GET: return categories (effective list), tags per category, and tagToCategory overrides. */
export async function GET() {
  const config = readCategoryConfig();
  const categories = getEffectiveCategories();
  const tagToCategory = config.tagToCategory ?? {};
  const tagsByCategory: Record<string, string[]> = {};
  for (const cat of categories) {
    tagsByCategory[cat] = getTagsForCategory(cat as import("@/lib/document-categories").DocumentCategoryLabel, tagToCategory).sort();
  }
  return NextResponse.json({
    categories,
    tagsByCategory,
    overrides: tagToCategory,
  });
}

/** PATCH: update config. Body: { tag, category } | { categories } | { createCategory } | { removeCategory } | { renameCategory }. */
export async function PATCH(request: Request) {
  let body: {
    overrides?: CategoryOverrides;
    tag?: string;
    category?: string | null;
    categories?: string[];
    createCategory?: string;
    removeCategory?: string;
    renameCategory?: { from: string; to: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = readCategoryConfig();
  const effectiveCategories = getEffectiveCategories();
  let tagToCategory = { ...(config.tagToCategory ?? {}) };

  const isValidCategory = (c: string) =>
    effectiveCategories.includes(c) || (body.categories ?? config.categories ?? []).includes(c);

  if (body.createCategory !== undefined) {
    const name = String(body.createCategory).trim();
    if (!name) return NextResponse.json({ error: "Category name required" }, { status: 400 });
    if (effectiveCategories.includes(name)) return NextResponse.json({ error: "Category already exists" }, { status: 400 });
    const nextCategories = [...effectiveCategories.filter((c) => c !== "Other"), name, "Other"];
    writeFullCategoryConfig({ categories: nextCategories, tagToCategory });
    return NextResponse.json({ ok: true, categories: nextCategories });
  }

  if (body.removeCategory !== undefined) {
    const name = body.removeCategory.trim();
    if (name === "Other") return NextResponse.json({ error: "Cannot remove Other" }, { status: 400 });
    const nextCategories = effectiveCategories.filter((c) => c !== name);
    if (nextCategories.length === 0) return NextResponse.json({ error: "Cannot remove last category" }, { status: 400 });
    for (const tag of Object.keys(tagToCategory)) {
      if (tagToCategory[tag] === name) tagToCategory[tag] = null;
    }
    writeFullCategoryConfig({ categories: nextCategories, tagToCategory });
    return NextResponse.json({ ok: true, categories: nextCategories, overrides: tagToCategory });
  }

  if (body.renameCategory !== undefined) {
    const { from, to } = body.renameCategory;
    const fromName = String(from).trim();
    const toName = String(to).trim();
    if (!fromName || !toName) return NextResponse.json({ error: "from and to required" }, { status: 400 });
    if (fromName === "Other") return NextResponse.json({ error: "Cannot rename Other" }, { status: 400 });
    if (!effectiveCategories.includes(fromName)) return NextResponse.json({ error: "Category not found" }, { status: 404 });
    const nextCategories = effectiveCategories.map((c) => (c === fromName ? toName : c));
    for (const tag of Object.keys(tagToCategory)) {
      if (tagToCategory[tag] === fromName) tagToCategory[tag] = toName;
    }
    writeFullCategoryConfig({ categories: nextCategories, tagToCategory });
    return NextResponse.json({ ok: true, categories: nextCategories, overrides: tagToCategory });
  }

  if (body.categories !== undefined) {
    if (!Array.isArray(body.categories)) return NextResponse.json({ error: "categories must be an array" }, { status: 400 });
    const other = "Other";
    const nextCategories = [...body.categories.filter((c: string) => c !== other), other];
    writeFullCategoryConfig({ categories: nextCategories, tagToCategory });
    return NextResponse.json({ ok: true, categories: nextCategories });
  }

  if (body.overrides !== undefined) {
    if (typeof body.overrides !== "object" || body.overrides === null) {
      return NextResponse.json({ error: "overrides must be an object" }, { status: 400 });
    }
    const next: CategoryOverrides = {};
    for (const [k, v] of Object.entries(body.overrides)) {
      const key = tagKey(k);
      if (v === null || v === undefined) next[key] = null;
      else if (isValidCategory(v)) next[key] = v;
    }
    tagToCategory = next;
    writeFullCategoryConfig({ ...config, tagToCategory });
    return NextResponse.json({ ok: true, overrides: next });
  }

  if (body.tag !== undefined) {
    const key = tagKey(body.tag);
    const category = body.category === undefined ? null : body.category;
    if (category !== null && !effectiveCategories.includes(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    tagToCategory = { ...tagToCategory };
    if (category === null) tagToCategory[key] = null;
    else tagToCategory[key] = category;
    writeFullCategoryConfig({ ...config, tagToCategory });
    return NextResponse.json({ ok: true, overrides: tagToCategory });
  }

  return NextResponse.json({ error: "Provide overrides, tag+category, categories, createCategory, removeCategory, or renameCategory" }, { status: 400 });
}
