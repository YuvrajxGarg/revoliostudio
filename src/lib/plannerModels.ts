/**
 * @deprecated Superseded by src/lib/llmModels.ts, which lists muapi's full
 * LLM catalog (25 models) with real pricing instead of this curated
 * 4-model subset — kept only as a compatibility re-export in case anything
 * still imports from this path. Import from "@/lib/llmModels" directly in
 * new code.
 */
export { LLM_MODELS as PLANNER_MODELS, DEFAULT_LLM_MODEL as DEFAULT_PLANNER_MODEL, getLlmModel as getPlannerModel } from "@/lib/llmModels";
