"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_ROLE_LABELS, type ProfileRole } from "@/lib/types";

const ROLE_OPTIONS = Object.keys(PROFILE_ROLE_LABELS) as ProfileRole[];

/**
 * Admin-only role picker for a teammate's row in the /admin users table.
 * Writes directly to `profiles.role` — authorized by the "admins can update
 * any profile" RLS policy (0032 migration); a non-admin session would have
 * this update rejected by RLS/the privileged-column trigger, so there's
 * nothing else to gate here client-side.
 */
export function AdminRoleSelect({ userId, initialRole }: { userId: string; initialRole: ProfileRole | null }) {
  const [role, setRole] = useState<ProfileRole | null>(initialRole);
  const [saving, setSaving] = useState(false);

  async function handleChange(next: string) {
    const prev = role;
    const nextRole = (next || null) as ProfileRole | null;
    setRole(nextRole);
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", userId);
    setSaving(false);
    if (error) setRole(prev);
  }

  return (
    <select
      value={role ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      disabled={saving}
      className="rounded-lg border border-border-subtle bg-surface-2 px-2 py-1 text-xs outline-none focus:border-accent disabled:opacity-50"
    >
      <option value="">Unassigned</option>
      {ROLE_OPTIONS.map((r) => (
        <option key={r} value={r}>
          {PROFILE_ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}
