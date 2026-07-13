"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import toast from "react-hot-toast";

// ============================================
// ImageUploadField — pick an image file (with live preview) or paste a URL.
// The parent owns persistence: it receives the chosen File via onFile and
// the typed URL via onUrlChange, then uploads on submit. Reusable across
// competition logo/banner, match banner, etc.
// ============================================

export default function ImageUploadField({
  label,
  url,
  onUrlChange,
  file,
  onFile,
  aspect = "square",
  maxMb = 5,
  hint,
}: {
  label: string;
  url: string;
  onUrlChange: (v: string) => void;
  file: File | null;
  onFile: (f: File | null) => void;
  aspect?: "square" | "wide";
  maxMb?: number;
  hint?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Object-URL preview for the picked file; revoke on change/unmount.
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const obj = URL.createObjectURL(file);
    setPreview(obj);
    return () => URL.revokeObjectURL(obj);
  }, [file]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Choisis une image (PNG, JPG, WebP).");
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      toast.error(`Image trop lourde (${maxMb} Mo maximum).`);
      return;
    }
    onFile(f);
  };

  const shown = preview ?? (url.trim() || null);
  const boxClass = aspect === "wide" ? "h-16 w-28" : "h-14 w-14";

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex items-center gap-3">
        <div
          className={`flex ${boxClass} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-50`}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon size={20} className="text-gray-300" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
              <Upload size={15} />
              {file ? "Changer" : "Choisir un fichier"}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => {
                  onFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500"
              >
                <X size={13} /> Retirer
              </button>
            )}
          </div>
          {hint && !file && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
        </div>
      </div>

      <input
        type="url"
        placeholder="…ou coller une URL d'image"
        className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
      />
    </div>
  );
}
