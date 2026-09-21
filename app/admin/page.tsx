import type { Metadata } from "next";
import AdminLogin from "@/components/admin/AdminLogin";
import AdminDashboard from "@/components/admin/AdminDashboard";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Painel | Robertão Premiações",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAuthenticated())) return <AdminLogin />;
  return <AdminDashboard />;
}
