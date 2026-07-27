"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { useGenerations } from "@/hooks/useGenerations";
import { useProjectMembers } from "@/hooks/useProjectMembers";
import { GenerationGrid } from "@/components/gallery/GenerationGrid";
import { GridSizeSlider } from "@/components/gallery/GridSizeSlider";
import { InviteMemberModal } from "./InviteMemberModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import type { Project } from "@/hooks/useProjects";

function initials(name: string): string {
  return name.charAt(0).toUpperCase();
}

/**
 * A single project opened from the "All projects" grid: its generations
 * (scoped by project_id, and — for a "team" project — visible across every
 * member via `allowTeamMembers`, not just whichever member filed them), plus
 * a Members panel for team projects (invite/remove backed by
 * useProjectMembers + /api/projects/[id]/members).
 */
export function ProjectDetailView({
  project,
  currentUserId,
  onBack,
}: {
  project: Project;
  currentUserId: string | null;
  onBack: () => void;
}) {
  const [colWidth, setColWidth] = usePersistentState("revolio-grid-width", 220);
  const isTeam = project.type === "team";
  const isOwner = project.user_id === currentUserId;
  const gens = useGenerations(undefined, { projectId: project.id, allowTeamMembers: isTeam });
  const { members, loading: membersLoading, inviteMember, removeMember } = useProjectMembers(isTeam ? project.id : null);
  const [inviting, setInviting] = useState(false);
  const [removing, setRemoving] = useState<{ userId: string; label: string } | null>(null);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 md:px-6 py-6 flex flex-col gap-4">
        <button
          onClick={onBack}
          className="flex w-fit items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </button>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: project.color }} />
            <h1 className="text-xl font-semibold tracking-tight font-display">{project.name}</h1>
            <span className="rounded-full border border-border-subtle bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
              {isTeam ? "Team" : "Personal"}
            </span>
          </div>
          <GridSizeSlider value={colWidth} onChange={setColWidth} />
        </div>

        {isTeam && (
          <div className="rounded-2xl border border-border-subtle bg-surface p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Users className="h-3.5 w-3.5 text-muted" /> Members
              </div>
              {isOwner && (
                <button
                  onClick={() => setInviting(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-accent-2"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </button>
              )}
            </div>
            {membersLoading ? (
              <div className="flex items-center justify-center py-4 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const name = m.profile?.display_name || m.profile?.email || "Unknown";
                  const canRemove = isOwner ? m.role !== "owner" : m.user_id === currentUserId && m.role !== "owner";
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-2 pl-1 pr-2.5 py-1"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface border border-border-subtle text-[10px] font-semibold overflow-hidden">
                        {m.profile?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={m.profile.avatar_url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          initials(name)
                        )}
                      </span>
                      <span className="text-xs">{name}</span>
                      <span className="text-[10px] uppercase text-muted">{m.role}</span>
                      {canRemove && (
                        <button
                          onClick={() => setRemoving({ userId: m.user_id, label: name })}
                          title="Remove"
                          className="text-muted hover:text-danger-text"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <GenerationGrid
          items={gens.items}
          loading={gens.loading}
          hasMore={gens.hasMore}
          onLoadMore={gens.loadMore}
          onDeleted={gens.removeItem}
          columnWidth={colWidth}
          emptyLabel={
            isTeam
              ? "Nothing filed under this team project yet — generate something and add it here, from any member."
              : "Nothing filed under this project yet."
          }
        />
      </div>

      {inviting && (
        <InviteMemberModal
          projectName={project.name}
          existingMemberIds={new Set(members.map((m) => m.user_id))}
          onClose={() => setInviting(false)}
          onInvite={inviteMember}
        />
      )}

      {removing && (
        <ConfirmModal
          title={`Remove ${removing.label} from "${project.name}"?`}
          description="They'll lose access to this project and everything filed under it."
          confirmLabel="Remove"
          danger
          onConfirm={() => {
            removeMember(removing.userId);
            setRemoving(null);
          }}
          onCancel={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
