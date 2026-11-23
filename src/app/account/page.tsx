import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/user-auth";
import UserDashboardClient from "@/components/UserDashboardClient";

export const dynamic = "force-dynamic";

interface AccountPageProps {
  searchParams: Promise<{ upgrade?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getCurrentUserProfile();

  if (!user) {
    redirect("/login?next=/account");
  }

  const params = await searchParams;
  const openUpgradeInitially = params.upgrade === "1" && !user.isProActive;

  return <UserDashboardClient openUpgradeInitially={openUpgradeInitially} />;
}
