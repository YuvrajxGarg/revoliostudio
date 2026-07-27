"use client";

import { useState } from "react";
import { type Category } from "@/lib/models";
import { Dropdown } from "@/components/ui/Dropdown";
import { TemplatesPanel } from "./TemplatesPanel";
import { FeaturedTemplatesGrid } from "./FeaturedTemplatesGrid";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "3d", label: "3D" },
];

/**
 * The Templates page — Revolio's answer to Higgsfield/Magnific's "My
 * templates" page: your own saved setups up top (with the same
 * build-your-first-template empty state as the studio panels), a category
 * switcher, and a curated "Featured templates" gallery underneath. Picking a
 * featured card lands you in the right studio tab with the model +
 * prompt/settings already loaded — add your own inputs and hit Generate.
 */
export function TemplatesGallery() {
  const [category, setCategory] = useState<Category>("video");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-8 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight font-display">Templates</h1>
            <p className="text-sm text-muted mt-1">
              Your saved setups, plus curated presets — pick one, add your own image or video, and generate.
            </p>
          </div>
          <Dropdown value={category} onChange={(v) => setCategory(v as Category)} options={CATEGORY_OPTIONS} align="right" />
        </div>

        {/* My templates — saved composer setups for the selected category. */}
        <TemplatesPanel category={category} />

        {/* Featured templates — admin-curated presets on verified models. */}
        <FeaturedTemplatesGrid category={category} />
      </div>
    </div>
  );
}
