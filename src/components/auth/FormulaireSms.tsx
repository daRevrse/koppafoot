"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import toast from "react-hot-toast";
import { Loader2, Phone } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";
import { createRecaptchaVerifier } from "@/lib/recaptcha";
import { useAuth } from "@/contexts/AuthContext";
import { getAuthErrorMessage, signalerEchecSms } from "@/lib/auth-errors";
import {
  COUNTRY_CODES, DEFAULT_DIAL_CODE, RESEND_COOLDOWN_S, normalizeNational, toE164,
} from "@/lib/phone";
import {
  classeBoutonAuth, classeChampAuth, classeChampAuthNu, classeEtiquetteAuth,
  classeIconeChamp, classeIndicatifAuth,
} from "@/components/auth/auth-ui";

// ============================================
// Le numéro, puis le code : le parcours SMS de la connexion ET de
// l'inscription.
//
// UN SEUL PARCOURS POUR DEUX PORTES. Il vivait dans /login, et /signup ne
// proposait pas le téléphone : qui voulait s'inscrire par SMS devait savoir
// que « Se connecter » crée le compte au premier code. Les deux pages
// l'affichent maintenant, et ne diffèrent que par ce qu'elles font du code
// validé (`onConfirmer`) : la connexion route vers l'espace ou vers
// /get-started, l'inscription fait de même en emportant le rôle choisi.
//
// Le reCAPTCHA invisible vit ici, avec son conteneur : un vérificateur ET
// un conteneur neufs à chaque envoi (lib/recaptcha), défaits quand le
// composant disparaît (on quitte l'onglet téléphone).
// ============================================

// La partie nationale seule : l'indicatif vient du menu, et les deux sont
// réunis au format E.164 avant d'aller chez Firebase. On tape son numéro
// comme on le dit (« 90 12 34 56 »), espaces et 0 de tête compris.
const schemaNumero = yup.object({
  phone: yup
    .string()
    .transform((v: string) => normalizeNational(v))
    .matches(/^\d{6,14}$/, "Numéro invalide")
    .required("Numéro requis"),
});

const schemaCode = yup.object({
  code: yup
    .string()
    .matches(/^\d{6}$/, "Code à 6 chiffres")
    .required("Code requis"),
});

type FormNumero = yup.InferType<typeof schemaNumero>;
type FormCode = yup.InferType<typeof schemaCode>;

const classeErreur = "mt-1.5 text-[11px] font-bold text-red-600";
const classeLienDiscret =
  "text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 transition-colors hover:text-gray-900 " +
  "disabled:text-gray-300 disabled:hover:text-gray-300";

export default function FormulaireSms({
  onConfirmer,
  occupe = false,
}: {
  /** Le bon code est saisi : le parent confirme (confirmPhoneCode) et route. Une erreur levée s'affiche ici. */
  onConfirmer: (confirmation: ConfirmationResult, code: string) => Promise<void>;
  /** Un autre geste de la page est en cours (Google) : les boutons attendent. */
  occupe?: boolean;
}) {
  const { sendPhoneCode } = useAuth();
  const [etape, setEtape] = useState<"numero" | "code">("numero");
  const [indicatif, setIndicatif] = useState<string>(DEFAULT_DIAL_CODE);
  const [envoyeA, setEnvoyeA] = useState("");
  const [attente, setAttente] = useState(0);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [enCours, setEnCours] = useState(false);
  const hoteRecaptcha = useRef<HTMLDivElement>(null);
  const verificateur = useRef<RecaptchaVerifier | null>(null);
  const bloque = enCours || occupe;

  const formNumero = useForm<FormNumero>({ resolver: yupResolver(schemaNumero) });
  const formCode = useForm<FormCode>({ resolver: yupResolver(schemaCode) });

  // Le vérificateur se construit à chaque envoi ; ici on ne fait que le
  // défaire quand le composant disparaît.
  useEffect(() => () => {
    verificateur.current?.clear();
    verificateur.current = null;
  }, []);

  // Le compte à rebours du renvoi.
  useEffect(() => {
    if (attente <= 0) return;
    const id = setTimeout(() => setAttente((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [attente]);

  // Envoie (ou renvoie) le SMS. Firebase consomme le vérificateur à chaque
  // tentative, réussie ou non : il en faut un neuf à chaque fois.
  const demanderCode = async (e164: string) => {
    if (!hoteRecaptcha.current) throw new Error("reCAPTCHA indisponible");
    const v = createRecaptchaVerifier(hoteRecaptcha.current, verificateur.current);
    verificateur.current = v;
    const resultat = await sendPhoneCode(e164, v);
    setConfirmation(resultat);
    setEnvoyeA(e164);
    setAttente(RESEND_COOLDOWN_S);
  };

  const envoyer = async (data: FormNumero) => {
    setEnCours(true);
    try {
      await demanderCode(toE164(indicatif, data.phone));
      setEtape("code");
      formCode.reset();
      toast.success("Code envoyé !");
    } catch (err) {
      signalerEchecSms(err);
      toast.error(getAuthErrorMessage(err));
    } finally {
      setEnCours(false);
    }
  };

  const renvoyer = async () => {
    if (attente > 0 || !envoyeA) return;
    setEnCours(true);
    try {
      await demanderCode(envoyeA);
      formCode.reset();
      toast.success("Nouveau code envoyé !");
    } catch (err) {
      signalerEchecSms(err);
      toast.error(getAuthErrorMessage(err));
    } finally {
      setEnCours(false);
    }
  };

  const changerDeNumero = () => {
    setEtape("numero");
    setConfirmation(null);
    setEnvoyeA("");
    setAttente(0);
    formCode.reset();
  };

  const valider = async (data: FormCode) => {
    setEnCours(true);
    try {
      if (!confirmation) throw new Error("Pas de confirmation en cours");
      await onConfirmer(confirmation, data.code);
    } catch (err) {
      toast.error(getAuthErrorMessage(err));
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {etape === "numero" ? (
          <motion.form
            key="numero"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={formNumero.handleSubmit(envoyer)}
            className="space-y-4"
          >
            <div>
              <label htmlFor="phone" className={classeEtiquetteAuth}>Numéro de téléphone</label>
              <div className="flex gap-2">
                <select
                  aria-label="Indicatif pays"
                  value={indicatif}
                  onChange={(e) => setIndicatif(e.target.value)}
                  className={classeIndicatifAuth}
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label.slice(0, 2)} {c.code}
                    </option>
                  ))}
                </select>
                <div className="relative min-w-0 flex-1">
                  <Phone size={15} className={classeIconeChamp} />
                  <input
                    id="phone"
                    type="tel"
                    autoComplete="tel-national"
                    inputMode="tel"
                    {...formNumero.register("phone")}
                    className={classeChampAuth}
                    placeholder="90 12 34 56"
                  />
                </div>
              </div>
              {formNumero.formState.errors.phone && (
                <p className={classeErreur}>{formNumero.formState.errors.phone.message}</p>
              )}
            </div>

            <button type="submit" disabled={bloque} className={classeBoutonAuth}>
              {enCours && <Loader2 size={16} className="animate-spin" />}
              Envoyer le code
            </button>
          </motion.form>
        ) : (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={formCode.handleSubmit(valider)}
            className="space-y-4"
          >
            <p className="text-sm text-gray-500">
              Un code à 6 chiffres a été envoyé au{" "}
              <span className="font-semibold text-gray-900">{envoyeA}</span>.
            </p>
            <div>
              <label htmlFor="code" className={classeEtiquetteAuth}>Code de vérification</label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                // Le téléphone propose le code reçu au-dessus du clavier.
                autoComplete="one-time-code"
                maxLength={6}
                {...formCode.register("code")}
                className={`${classeChampAuthNu} text-center text-lg tracking-[0.3em]`}
                placeholder="000000"
              />
              {formCode.formState.errors.code && (
                <p className={classeErreur}>{formCode.formState.errors.code.message}</p>
              )}
            </div>

            <button type="submit" disabled={bloque} className={classeBoutonAuth}>
              {enCours && <Loader2 size={16} className="animate-spin" />}
              Vérifier
            </button>

            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={changerDeNumero} disabled={enCours} className={classeLienDiscret}>
                Changer de numéro
              </button>
              <button type="button" onClick={renvoyer} disabled={attente > 0 || bloque} className={classeLienDiscret}>
                {attente > 0 ? `Renvoyer le code (${attente}s)` : "Renvoyer le code"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Le conteneur du reCAPTCHA invisible. */}
      <div ref={hoteRecaptcha} />
    </>
  );
}
