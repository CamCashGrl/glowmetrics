import { createSupabaseRouteClient } from "../../../lib/supabase-server"

export async function POST() {
  const supabase = createSupabaseRouteClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response("Not logged in", { status: 401 })
  }

  const { error } = await supabase
    .from("beta_users")
    .update({ onboarding_complete: true })
    .eq("user_id", user.id)

  if (error) {
    return new Response("Error: " + error.message, { status: 500 })
  }

  return new Response("Success", { status: 200 })
}
