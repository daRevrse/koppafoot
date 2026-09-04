"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Mail, ArrowLeft, Send } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { classeChampAuth, classeEtiquetteAuth, classeIconeChamp, classeBoutonAuth } from "@/components/auth/auth-ui";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const schema = yup.object({
  email: yup.string().email("Email invalide").required("Email requis"),
});

type FormData = yup.InferType<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { resetPassword } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: yupResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    try {
      await resetPassword(data.email);
      setSent(true);
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <AnimatePresence mode="wait">
        {!sent ? (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <h1 className="mb-2 font-display text-3xl font-black uppercase leading-[0.95] tracking-[-0.02em] text-gray-900">
              Mot de passe oublié
            </h1>
            <p className="mb-8 text-sm text-gray-400">
              Entrez votre email pour recevoir un lien de réinitialisation.
            </p>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label htmlFor="email" className={classeEtiquetteAuth}>
                  Email
                </label>
                <div className="relative">
                  <Mail size={15} className={classeIconeChamp} />
                  <input
                    id="email"
                    type="email"
                    {...register("email")}
                    className={classeChampAuth}
                    placeholder="votre@email.com"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-[11px] font-bold text-red-600">{errors.email.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={classeBoutonAuth}
              >
                {submitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Envoyer le lien
              </button>
            </form>
          </motion.div>
        ) : (
          <motion.div
            key="sent"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
              className="mx-auto mb-5 flex h-14 w-14 items-center justify-center border border-emerald-200 bg-emerald-50"
            >
              <Mail size={28} className="text-emerald-600" />
            </motion.div>
            <h1 className="mb-3 font-display text-2xl font-black uppercase tracking-tight text-gray-900">Email envoyé</h1>
            <p className="mb-6 text-sm text-gray-400">
              Si un compte existe avec cette adresse, vous recevrez un email avec un lien de
              réinitialisation. Pensez à vérifier vos spams.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-8 text-center">
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
