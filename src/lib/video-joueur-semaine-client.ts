// ============================================
// La vidéo « Joueur de la semaine », fabriquée dans le navigateur de
// l'administration : les calques de l'affiche (lib/og-joueur-semaine) animés
// sur un canvas selon lib/video-joueur-semaine, puis encodés en MP4 H.264 par
// WebCodecs, au travers de mediabunny.
//
// POURQUOI ICI ET PAS SUR LE SERVEUR : Vercel n'a pas ffmpeg, et trois cents
// images dans une fonction serveur dépasseraient ses limites. Le navigateur de
// l'admin le fait en quelques secondes, sans service payant.
//
// IMAGE PAR IMAGE : t = n / FPS, jamais `requestAnimationFrame`. La vidéo ne
// dépend ni de la vitesse de la machine ni d'un onglet en arrière-plan.
// ============================================

import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeVideo } from "mediabunny";
import { DUREE, FPS, etatDuCalque } from "@/lib/video-joueur-semaine";
import type { CalqueVideo } from "@/lib/og-joueur-semaine";

const W = 1080;
const H = 1920;

/**
 * Ce navigateur sait-il encoder du H.264 en 1080×1920 ? Chrome et Edge de
 * bureau, oui ; ailleurs, souvent non. La page le dit plutôt que d'échouer au
 * milieu.
 */
export async function videoPossible(): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof OffscreenCanvas === "undefined") return false;
  try {
    return await canEncodeVideo("avc", { width: W, height: H });
  } catch {
    return false;
  }
}

async function enImage(dataUri: string): Promise<ImageBitmap> {
  const blob = await (await fetch(dataUri)).blob();
  return createImageBitmap(blob);
}

/** La vidéo, en MP4. `onProgres` reçoit la part faite, de 0 à 1. */
export async function fabriquerLaVideo(
  calques: CalqueVideo[],
  onProgres: (part: number) => void,
): Promise<Blob> {
  const images = await Promise.all(calques.map(async (c) => ({ c, img: await enImage(c.png) })));
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible");

  const target = new BufferTarget();
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target });
  const source = new CanvasSource(canvas, { codec: "avc", quality: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const total = FPS * DUREE;
  try {
    for (let n = 0; n < total; n++) {
      const t = n / FPS;
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
      for (const { c, img } of images) {
        const e = etatDuCalque(c, t, W);
        if (e.opacite <= 0 || e.devoile <= 0) continue;
        ctx.globalAlpha = e.opacite;
        // Le zoom, centré : on prend au centre du calque une part de 1/zoom,
        // peinte sur toute sa place. Le dévoilement : seule la part basse.
        const sw = c.w / e.zoom;
        const sh = c.h / e.zoom;
        const sx = (c.w - sw) / 2;
        const sy = (c.h - sh) / 2;
        const v = e.devoile;
        ctx.drawImage(
          img,
          sx, sy + sh * (1 - v), sw, sh * v,
          c.left + e.dx, c.top + e.dy + c.h * (1 - v), c.w, c.h * v,
        );
      }
      await source.add(t, 1 / FPS);
      onProgres((n + 1) / total);
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  } finally {
    images.forEach(({ img }) => img.close());
  }

  if (!target.buffer) throw new Error("La vidéo est vide");
  return new Blob([target.buffer], { type: "video/mp4" });
}
