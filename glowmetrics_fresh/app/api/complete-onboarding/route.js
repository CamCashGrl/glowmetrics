import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function POST() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Not logged in", { status: 401 });
  }

  const { error } = await supabase
    .from("users")
    .update({ onboarding_complete: true })
    .eq("id", user.id);

  if (error) {
    return new Response("Error updating user", { status: 500 });
  }

  return new Response("Success", { status: 200 });
}
