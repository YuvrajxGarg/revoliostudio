/**
 * Reusable prompt-quality phrase snippets for our own hardcoded prompts
 * (`toolStudios.ts` defaultPrompt/stylePresets/promptTransform, `presets.ts`
 * template prompts).
 *
 * Where these came from: reading a real, heavily-produced Higgsfield
 * community project's published "Style Prefix" — a ~200-word style-lock
 * paragraph their top creator writes once per project and reuses on every
 * shot (see `higgsfield-apps-research.md` §6). We don't reuse their
 * paragraph verbatim — it's tuned to one specific film — but the
 * underlying prompt-engineering TECHNIQUES it demonstrates are general and
 * apply directly to our own hardcoded prompts wherever the same failure
 * mode shows up:
 *
 * 1. Anti-plastic-skin: image/video models default toward an over-smoothed,
 *    synthetic look unless told not to. "Natural professional retouching"
 *    alone (what several of our defaultPrompts already say) doesn't
 *    prevent this — it's the exact instruction that invites it. Their
 *    prefix instead calls out real skin texture explicitly ("pore-level
 *    realism — vellus hair, asymmetric moles, capillary flush").
 * 2. Physical grounding: product/compositing shots commonly come back
 *    looking pasted-in rather than physically present. Their prefix names
 *    physics explicitly ("gravity and inertia respected... no floating
 *    props, correct contact shadows") rather than leaving it implicit.
 * 3. Physical-camera realism: a camera move named only by its move type
 *    ("smooth orbit") tends to render with a game-engine/CGI camera feel.
 *    Naming real camera physics (lens, motion blur, shutter) pushes the
 *    model toward an actual cinematography look instead.
 *
 * Each export is a short clause meant to be appended to an existing prompt
 * string — not a full paragraph — so it reinforces rather than bloats.
 */

export const PHOTOREAL_SKIN =
  "Preserve natural skin texture — visible pores, fine hair, subtle asymmetry — avoid an over-smoothed, plastic, or airbrushed look.";

export const GROUNDED_PHYSICS =
  "Ground it physically in the scene with an accurate contact shadow and correct scale — it should look physically present, never pasted-in or floating.";

export const CINEMATIC_CAMERA_REALISM =
  "Shot on a physical cine lens with natural motion blur — real cinematography, not a CGI or game-engine camera feel.";
