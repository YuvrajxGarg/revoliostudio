import { UserProfileView } from "@/components/profile/UserProfileView";

export default async function UserProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <UserProfileView username={decodeURIComponent(username)} />;
}
