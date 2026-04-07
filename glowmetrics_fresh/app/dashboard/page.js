import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Analytics } from "@/lib/analytics";
import DashboardShell from "@/components/shell";
import DashboardHeader from "@/components/header";
import DashboardBody from "@/components/body";
import { getUserData, getDashboardData } from "@/lib/queries";

export default async function DashboardPage() {
  const supabase = createServerComponentClient({ cookies });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  const user = await getUserData(supabase, session.user.id);
  const dashboardData = await getDashboardData(supabase, session.user.id);

  return (
    <>
      <Analytics />
      <DashboardShell>
        <DashboardHeader user={user} />
        <DashboardBody data={dashboardData} />
      </DashboardShell>
    </>
  );
}
