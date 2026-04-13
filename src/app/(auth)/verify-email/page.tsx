"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, CheckCircle, Mail, ArrowLeft } from "lucide-react";
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
      <div className="rounded-xl bg-white p-8 shadow-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle size={24} className="text-green-600" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900">Email vérifié</h2>
        <p className="mb-6 text-sm text-gray-500">Votre adresse email est vérifiée.</p>
        <Link
          href="/dashboard"
          className="inline-flex rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Accéder à mon espace
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-white p-8 shadow-md text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
        <Mail size={24} className="text-primary-600" />
      </div>
      <h2 className="mb-2 text-xl font-semibold text-gray-900">Vérifiez votre email</h2>
      <p className="mb-6 text-sm text-gray-500">
        {user?.email
          ? `Un email de vérification a été envoyé à ${user.email}.`
          : "Vérifiez votre boîte mail."}
        <br />
        Pensez à vérifier vos spams.
      </p>

      {!resent ? (
        <button
          onClick={handleResend}
          disabled={resending}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {resending && <Loader2 size={16} className="animate-spin" />}
          Renvoyer l&apos;email
        </button>
      ) : (
        <p className="text-sm text-green-600">Email renvoyé avec succès !</p>
      )}

      <div className="mt-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <ArrowLeft size={14} /> Retour à la connexion
        </Link>
      </div>
    </div>
  );
}
