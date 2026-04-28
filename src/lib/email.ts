import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "KoppaFoot <notifications@koppafoot.com>";
const APP_URL = "https://koppafoot.com";

export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  await resend.emails.send({ from: FROM, to, subject, html });
}

// ── Shared layout ──────────────────────────────────────────

function emailLayout(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>KoppaFoot</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 0;">
    <tr><td align="center">

      <!-- Header -->
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#059669;border-radius:12px 12px 0 0;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
              &#9917; KOPPAFOOT
            </span>
          </td>
        </tr>
      </table>

      <!-- Body -->
      <table width="560" cellpadding="0" cellspacing="0"
        style="max-width:560px;width:100%;background:#ffffff;padding:32px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
        <tr><td style="color:#1e293b;font-size:15px;line-height:1.7;">
          ${content}
        </td></tr>
      </table>

      <!-- Footer -->
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr>
          <td style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">
              © 2025 KoppaFoot &nbsp;·&nbsp;
              <a href="${APP_URL}" style="color:#059669;text-decoration:none;">koppafoot.com</a>
            </p>
          </td>
        </tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label: string, href: string, color = "#059669"): string {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr>
      <td style="background:${color};border-radius:8px;">
        <a href="${href}" style="display:inline-block;padding:12px 28px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
          ${label} &rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />`;
}

// ── Transactional templates ─────────────────────────────────

export function invitationEmailHtml(
  senderName: string,
  teamName: string,
  recipientFirstName: string
): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut ${recipientFirstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Vous avez reçu une invitation&nbsp;⚽
    </h2>
    <p style="margin:0 0 12px;">
      <strong>${senderName}</strong> vous invite à rejoindre l'équipe
      <strong style="color:#059669;">${teamName}</strong> sur KoppaFoot.
    </p>
    <p style="margin:0;color:#64748b;font-size:14px;">
      Consultez l'invitation et décidez d'accepter ou de refuser.
    </p>
    ${ctaButton("Voir l'invitation", `${APP_URL}/mercato`)}
    ${divider()}
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      Si vous ne souhaitez pas rejoindre cette équipe, ignorez simplement cet email.
    </p>
  `);
}

export function joinRequestEmailHtml(
  playerName: string,
  teamName: string,
  managerFirstName: string
): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut Coach ${managerFirstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Nouvelle demande d'adhésion&nbsp;📋
    </h2>
    <p style="margin:0 0 12px;">
      <strong>${playerName}</strong> souhaite rejoindre votre équipe
      <strong style="color:#059669;">${teamName}</strong>.
    </p>
    <p style="margin:0;color:#64748b;font-size:14px;">
      Consultez son profil et acceptez ou refusez sa candidature.
    </p>
    ${ctaButton("Voir la demande", `${APP_URL}/teams`)}
  `);
}

export function adminMessageEmailHtml(title: string, body: string): string {
  return emailLayout(`
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#1e293b;">
      ${title}
    </h2>
    <p style="margin:0;color:#475569;">
      ${body}
    </p>
    ${ctaButton("Ouvrir KoppaFoot", `${APP_URL}/dashboard`, "#1e293b")}
  `);
}

// ── Campaign templates ──────────────────────────────────────

export function campaignManagerNoTeamHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut Coach ${firstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Votre équipe vous attend&nbsp;👋
    </h2>
    <p style="margin:0 0 16px;">
      Vous êtes inscrit sur KoppaFoot en tant que manager, mais vous n'avez pas encore créé votre équipe.
    </p>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
      En 2 minutes, créez votre équipe, invitez vos joueurs et commencez à défier vos adversaires.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:8px;margin-bottom:24px;">
      <tr>
        <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#166534;">3 étapes pour lancer votre équipe :</p>
          <p style="margin:0;font-size:13px;color:#166534;line-height:1.8;">
            1. Créer l'équipe<br/>
            2. Inviter vos joueurs<br/>
            3. Défier un adversaire
          </p>
        </td>
      </tr>
    </table>
    ${ctaButton("Créer mon équipe", `${APP_URL}/teams`)}
  `);
}

export function campaignPlayerNoTeamHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut ${firstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Des équipes cherchent un joueur comme vous&nbsp;⚽
    </h2>
    <p style="margin:0 0 16px;">
      Des dizaines d'équipes actives recherchent des joueurs dans votre ville.
    </p>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
      Explorez les équipes disponibles, postulez et commencez à jouer dès cette semaine.
    </p>
    ${ctaButton("Trouver une équipe", `${APP_URL}/mercato`)}
    ${divider()}
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Vous pouvez aussi attendre qu'une équipe vous contacte — mais les meilleurs joueurs vont chercher eux-mêmes.
    </p>
  `);
}

export function campaignWelcomeManagerHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Bienvenue sur KoppaFoot,</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Salut Coach ${firstName}&nbsp;🎉
    </h2>
    <p style="margin:0 0 16px;">
      Votre compte manager est prêt. Voici comment bien démarrer :
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;width:100%;">
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-weight:700;color:#059669;">01 &mdash;</span>
          <span style="color:#1e293b;margin-left:8px;">Créez votre équipe (nom, ville, niveau)</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <span style="font-weight:700;color:#059669;">02 &mdash;</span>
          <span style="color:#1e293b;margin-left:8px;">Invitez vos joueurs ou acceptez les candidatures</span>
        </td>
      </tr>
      <tr>
        <td style="padding:12px 0;">
          <span style="font-weight:700;color:#059669;">03 &mdash;</span>
          <span style="color:#1e293b;margin-left:8px;">Défiez une équipe adverse et planifiez votre premier match</span>
        </td>
      </tr>
    </table>
    ${ctaButton("Créer mon équipe maintenant", `${APP_URL}/teams`)}
  `);
}

export function campaignPlayerInactiveHtml(firstName: string): string {
  return emailLayout(`
    <p style="margin:0 0 8px;font-size:14px;color:#64748b;">Salut ${firstName},</p>
    <h2 style="margin:0 0 20px;font-size:22px;font-weight:800;color:#059669;">
      Vous nous manquez&nbsp;⚽
    </h2>
    <p style="margin:0 0 16px;">
      Votre dernier match remonte à plus d'un mois. Des équipes cherchent encore des joueurs près de chez vous.
    </p>
    <p style="margin:0 0 16px;color:#64748b;font-size:14px;">
      Revenez sur KoppaFoot, consultez les équipes disponibles et reprenez le jeu.
    </p>
    ${ctaButton("Voir les équipes disponibles", `${APP_URL}/mercato`)}
  `);
}
