"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { EnTeteAuth, classeBoutonAuth } from "@/components/auth/auth-ui";

// Le même alignement que les autres écrans d'authentification (titre à
// gauche, components/auth/auth-ui) : cette page était la seule centrée, sous
// une tuile d'icône qui jaillissait d'une échelle nulle.

export default function VerifyEmailPage() {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const { user, firebaseUser, sendVerificationEmail } = useAuth();

  const handleResend = async () => {
    setResending(true);
    try {
      await sendVerificationEmail();
      setResent(true);
      toast.success("Email de vérification envoyé !");
    } catch {
      toast.error("Impossible d'envoyer l'email. Réessaie plus tard.");
    } finally {
      setResending(false);
    }
  };

  // Already verified
  if (firebaseUser?.emailVerified) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <EnTeteAuth titre="Email vérifié" phrase="Ton adresse email est vérifiée." />
        <Link
          href="/"
          className={classeBoutonAuth}
        >
          Accéder à mon espace
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <EnTeteAuth
        titre="Vérifie ton email"
        phrase={`${user?.email ? `Un email de vérification a été envoyé à ${user.email}.` : "Vérifie ta boîte mail."} Pense à vérifier tes spams.`}
      />

      {!resent ? (
        <button
          onClick={handleResend}
          disabled={resending}
          className={classeBoutonAuth}
        >
          {resending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Renvoyer l&apos;email
        </button>
      ) : (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm font-bold text-emerald-700"
        >
          Email renvoyé avec succès !
        </motion.p>
      )}

      <div className="mt-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={13} /> Retour à la connexion
        </Link>
      </div>
    </motion.div>
  );
}
