import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";
import { getCurrentUserProfile } from "@/lib/user-auth";
import UserDashboardClient from "@/components/UserDashboardClient";

export const dynamic = "force-dynamic";

interface AccountPageProps {
  searchParams: Promise<{ upgrade?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const user = await getCurrentUserProfile();

  if (!user) {
    const admin = await getCurrentAdmin();
    if (admin) {
      redirect("/dashboard");
    }
    redirect("/login?next=/account");
  }

  const params = await searchParams;
  const openUpgradeInitially = !user.isProActive || params.upgrade === "1";

  return <UserDashboardClient openUpgradeInitially={openUpgradeInitially} />;
}
