import { redirect } from "next/navigation";

// The dashboard merged into the public home ("Direct"). Kept as a
// redirect for old links and post-login redirects still in the wild.
export default function DashboardRedirect() {
  redirect("/");
}
