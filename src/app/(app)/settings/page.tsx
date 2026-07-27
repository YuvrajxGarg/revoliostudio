import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ProfileSettingsForm } from "@/components/settings/ProfileSettingsForm";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-2xl px-4 md:px-6 py-6 flex flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">Profile settings</h1>
          <p className="text-xs text-muted mt-0.5">
            This is what shows up on your public profile page and next to your work in the Community feed.
          </p>
        </div>

        <ProfileSettingsForm
          userId={user.id}
          email={user.email}
          avatarUrl={user.avatarUrl}
          initialDisplayName={user.displayName}
          initialUsername={user.username}
          initialBio={user.bio}
        />
      </div>
    </div>
  );
}
