import { redirect } from "next/navigation";

// Les campagnes de relance vivent dans Messages, onglet « Relances » : deux
// pages pour un même geste (écrire à la plateforme), c'était une de trop.
export default function AdminCampaignsPage() {
  redirect("/admin/messages?onglet=relances");
}
