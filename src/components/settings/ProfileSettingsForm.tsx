"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Check, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { createClient } from "@/lib/supabase/client";

const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;
const BIO_MAX = 300;

export function ProfileSettingsForm({
  userId,
  email,
  avatarUrl,
  initialDisplayName,
  initialUsername,
  initialBio,
}: {
  userId: string;
  email: string;
  avatarUrl: string | null;
  initialDisplayName: string | null;
  initialUsername: string | null;
  initialBio: string | null;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [savedUsername, setSavedUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const usernameValid = USERNAME_PATTERN.test(username.trim().toLowerCase());

  async function handleSave() {
    setError(null);
    setSaved(false);
    const trimmedUsername = username.trim().toLowerCase();
    if (!usernameValid) {
      setError("Username must be 3–20 lowercase letters, numbers, or underscores, and start with a letter.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        username: trimmedUsername,
        bio: bio.trim() || null,
      })
      .eq("id", userId);
    setSaving(false);

    if (updateError) {
      if (updateError.code === "23505") setError("That username is already taken.");
      else if (updateError.code === "23514") setError("Username or bio doesn't meet the format requirements.");
      else setError("Failed to save — try again.");
      return;
    }

    setUsername(trimmedUsername);
    setSavedUsername(trimmedUsername);
    setSaved(true);
  }

  return (
    <Card className="p-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="h-14 w-14 rounded-full accent-gradient flex items-center justify-center text-lg font-semibold text-black">
            {(displayName || email)[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{email}</div>
          <div className="text-xs text-muted">Avatar synced from your Google account</div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Display name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
          className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Username</label>
        <div className="flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 focus-within:border-accent">
          <span className="text-sm text-muted shrink-0">revolio.app/u/</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            maxLength={20}
            placeholder="username"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        {username.length > 0 && !usernameValid && (
          <span className="text-[11px] text-danger-text">
            3–20 lowercase letters, numbers, or underscores — must start with a letter.
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted">Bio</label>
          <span className="text-[11px] text-muted">
            {bio.length}/{BIO_MAX}
          </span>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          rows={3}
          placeholder="A couple sentences about what you do here."
          className="w-full resize-none rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 transition-[filter] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
          {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
        </button>
        {error && <span className="text-[11px] text-danger-text">{error}</span>}
      </div>

      {savedUsername && (
        <Link
          href={`/u/${savedUsername}`}
          target="_blank"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground w-fit"
        >
          View your public profile <ExternalLink className="h-3 w-3" />
        </Link>
      )}
    </Card>
  );
}
