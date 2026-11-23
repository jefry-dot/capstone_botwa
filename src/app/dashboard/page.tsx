import { requireAdminPage } from "@/lib/auth";
import AdminDashboardClient from "@/components/AdminDashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await requireAdminPage("/dashboard");
  return <AdminDashboardClient />;
}
