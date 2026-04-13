"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
      // Always show success for security (don't reveal if email exists)
      toast.error(getAuthErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl bg-white p-8 shadow-md">
      {!sent ? (
        <>
          <h2 className="mb-2 text-center text-2xl font-semibold text-gray-900">
            Mot de passe oublié
          </h2>
          <p className="mb-6 text-center text-sm text-gray-500">
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                {...register("email")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600"
                placeholder="votre@email.com"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              Envoyer le lien
            </button>
          </form>
        </>
      ) : (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
            <Mail size={24} className="text-primary-600" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">Email envoyé</h2>
          <p className="mb-6 text-sm text-gray-500">
            Si un compte existe avec cette adresse, vous recevrez un email avec un lien de
            réinitialisation. Pensez à vérifier vos spams.
          </p>
        </div>
      )}

      <div className="mt-6 text-center">
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
