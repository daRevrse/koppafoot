"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, CheckCircle, Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";

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
      toast.error("Impossible d'envoyer l'email. Réessayez plus tard.");
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
        className="text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"
        >
          <CheckCircle size={32} className="text-emerald-500" />
        </motion.div>
        <h2 className="mb-2 text-xl font-black text-gray-900 font-display">Email vérifié</h2>
        <p className="mb-6 text-sm text-gray-400">Votre adresse email est vérifiée.</p>
        <Link
          href="/"
          className="inline-flex rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-600 transition-all"
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
      className="text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.15 }}
        className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50"
      >
        <Mail size={32} className="text-emerald-500" />
      </motion.div>

      <h2 className="mb-2 text-xl font-black text-gray-900 font-display">Vérifiez votre email</h2>
      <p className="mb-6 text-sm text-gray-400">
        {user?.email
          ? <>Un email de vérification a été envoyé à <span className="font-bold text-gray-600">{user.email}</span>.</>
          : "Vérifiez votre boîte mail."}
        <br />
        Pensez à vérifier vos spams.
      </p>

      {!resent ? (
        <button
          onClick={handleResend}
          disabled={resending}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50 transition-all"
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
          className="text-sm font-bold text-emerald-600"
        >
          Email renvoyé avec succès !
        </motion.p>
      )}

      <div className="mt-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeft size={14} /> Retour à la connexion
        </Link>
      </div>
    </motion.div>
  );
}
