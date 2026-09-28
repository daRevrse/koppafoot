"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Camera, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { uploadProfilePhoto } from "@/lib/storage";
import { BOUTON_CONTOUR, BOUTON_PLEIN, Carte, EnTete, Pastille, Titre } from "@/components/admin/ui";
import { PlayerAvatar } from "@/components/ui/EntityAvatar";

// ============================================
// Le profil de l'administrateur connecté.
//
// LA PAGE PROMETTAIT CE QUI N'EXISTE PAS : « Changer le mot de passe » et
// « Activer l'authentification à deux facteurs » étaient des boutons sans
// effet, une liste de « permissions » citait des bannissements et des journaux
// que la plateforme n'a pas, et quatre « statistiques système » affichaient
// des tirets. Il reste ce qui marche : la photo, le nom, les coordonnées.
// Le reste du compte se règle là où il se règle pour tout le monde.
// ============================================

export default function AdminProfilePage() {
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState(() => ({
    prenom: user?.firstName ?? "",
    nom: user?.lastName ?? "",
    telephone: user?.phone ?? "",
    ville: user?.locationCity ?? "",
  }));
  const [enregistrement, setEnregistrement] = useState(false);
  const [envoiPhoto, setEnvoiPhoto] = useState(false);
  const photo = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const changerPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setEnvoiPhoto(true);
    try {
      const url = await uploadProfilePhoto(user.uid, fichier, "avatar");
      await updateProfile({ profile_picture_url: url });
      toast.success("Photo mise à jour");
    } catch {
      toast.error("L'envoi de la photo a échoué");
    } finally {
      setEnvoiPhoto(false);
    }
  };

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.prenom.trim().length < 2 || form.nom.trim().length < 2) {
      toast.error("Le prénom et le nom demandent deux lettres au moins");
      return;
    }
    setEnregistrement(true);
    try {
      await updateProfile({
        first_name: form.prenom.trim(),
        last_name: form.nom.trim(),
        phone: form.telephone.trim() || null,
        location_city: form.ville.trim(),
      });
      toast.success("Profil enregistré");
    } catch {
      toast.error("L'enregistrement a échoué");
    } finally {
      setEnregistrement(false);
    }
  };

  const champ = (cle: keyof typeof form, label: string, type = "text") => (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</span>
      <input
        type={type}
        value={form[cle]}
        onChange={(e) => setForm({ ...form, [cle]: e.target.value })}
        className="w-full border border-gray-200/70 px-3 py-2.5 text-sm outline-none focus:border-gray-900"
      />
    </label>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <EnTete titre="Mon profil" />

      <Carte className="flex flex-wrap items-center gap-4 p-5">
        <div className="relative">
          <PlayerAvatar name={`${user.firstName} ${user.lastName}`} photo={user.profilePictureUrl} size={72} />
          <button
            onClick={() => photo.current?.click()}
            disabled={envoiPhoto}
            aria-label="Changer la photo"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center bg-gray-900 text-white hover:bg-gray-700"
          >
            {envoiPhoto ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          </button>
          <input ref={photo} type="file" accept="image/*" className="hidden" onChange={changerPhoto} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-black uppercase leading-tight tracking-tight text-gray-900">
            {user.firstName} {user.lastName}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Pastille ton="noir">Administrateur</Pastille>
          </div>
          <p className="mt-1 truncate text-sm text-gray-500">{user.email || user.phone}</p>
        </div>
      </Carte>

      <section>
        <Titre>Coordonnées</Titre>
        <Carte className="p-5">
          <form onSubmit={enregistrer} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {champ("prenom", "Prénom")}
              {champ("nom", "Nom")}
              {champ("telephone", "Téléphone", "tel")}
              {champ("ville", "Ville")}
            </div>
            <button type="submit" disabled={enregistrement} className={BOUTON_PLEIN}>
              {enregistrement && <Loader2 size={13} className="animate-spin" />}
              Enregistrer
            </button>
          </form>
        </Carte>
      </section>

      <section>
        <Titre>Le reste du compte</Titre>
        <Carte className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="min-w-0 flex-1 text-sm text-gray-600">
            Connexion, notifications et suppression du compte se règlent comme pour tout le monde.
          </p>
          <Link href="/parametres" className={BOUTON_CONTOUR}>Ouvrir les paramètres</Link>
        </Carte>
      </section>
    </div>
  );
}
