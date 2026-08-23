"use client";

import { useEffect, useState } from "react";
import type { ModelSchemaInfo } from "@/lib/model-schema-types";

/**
 * Fetches a model's resolved live-schema info from /api/models/[id]/schema
 * (cached server-side per endpoint) whenever the selected model changes.
 * Returns null while loading, if the fetch fails, or with no model — callers
 * fall back to the static registry in all three cases, and a response with
 * `error` set means the probe itself failed (see ModelSchemaInfo.error).
 */
export function useModelSchema(modelId: string | undefined): ModelSchemaInfo | null {
  const [schema, setSchema] = useState<ModelSchemaInfo | null>(null);

  useEffect(() => {
    setSchema(null);
    if (!modelId) return;
    let cancelled = false;
    fetch(`/api/models/${modelId}/schema`)
      .then((r) => r.json())
      .then((data: ModelSchemaInfo) => {
        if (!cancelled) setSchema(data);
      })
      .catch(() => {
        if (!cancelled) setSchema(null);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId]);

  return schema;
}
