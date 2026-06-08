import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Without Supabase configured (dev), still render so the flow can be tried.
  if (
    user &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, full_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.onboarding_completed) {
      redirect("/");
    }
    return <OnboardingWizard initialName={profile?.full_name ?? ""} />;
  }

  return <OnboardingWizard />;
}
