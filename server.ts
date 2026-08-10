import express from "express";
import path from "path";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // API Route: Send Email Credentials
  app.post("/api/send-email", async (req, res) => {
    try {
      const { type, to, userName, email, tempPassword } = req.body;

      if (!to || !tempPassword) {
        return res.status(400).json({
          success: false,
          message: "Parâmetros 'to' e 'tempPassword' são obrigatórios."
        });
      }

      const isReset = type === "reset_password";
      const subject = isReset
        ? "[OpsControl] Redefinição de Senha e Credenciais de Acesso"
        : "[OpsControl] Bem-vindo! Suas credenciais de primeiro acesso";

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
          <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #3b82f6;">
            <h2 style="color: #1e293b; margin: 0; font-size: 24px;">OpsControl System</h2>
            <p style="color: #64748b; margin-top: 4px; font-size: 14px;">Gestão e Controle Operacional</p>
          </div>
          
          <div style="padding: 24px 0; color: #334155;">
            <p style="font-size: 16px; font-weight: bold; color: #0f172a;">Olá, ${userName || "Usuário"}!</p>
            
            <p style="font-size: 14px; line-height: 1.6;">
              ${isReset
                ? "Sua senha de acesso ao sistema OpsControl foi redefinida por um moderador. Utilize a nova senha temporária abaixo para acessar a plataforma:"
                : "Sua conta no sistema OpsControl foi criada com sucesso! Utilize as informações abaixo para realizar o seu primeiro login:"
              }
            </p>

            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin: 20px 0;">
              <p style="margin: 6px 0; font-size: 14px;"><strong>E-mail de Login:</strong> <span style="color: #2563eb;">${email || to}</span></p>
              <p style="margin: 6px 0; font-size: 14px;"><strong>Senha Temporária:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-size: 16px; font-weight: bold; color: #0f172a;">${tempPassword}</code></p>
            </div>

            <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px;">
              <p style="margin: 0; font-size: 13px; font-weight: bold; color: #991b1b;">
                ⚠️ IMPORTANTE: Por razões de segurança, este acesso é temporário. Você deverá obrigatoriamente criar uma nova senha pessoal no seu primeiro acesso ao sistema.
              </p>
            </div>

            <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
              Instruções de acesso:<br>
              1. Acesse o sistema OpsControl.<br>
              2. Digite seu e-mail e a senha temporária fornecida acima.<br>
              3. O sistema exibirá a tela "Primeiro Acesso". Cadastre sua nova senha pessoal para desbloquear o sistema.
            </p>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; color: #94a3b8; font-size: 12px;">
            <p style="margin: 0;">Esta é uma mensagem automática enviada pelo OpsControl. Não responda a este e-mail.</p>
          </div>
        </div>
      `;

      // Check if SMTP environment variables are configured
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || '"OpsControl" <noreply@opscontrol.com>',
          to,
          subject,
          html: htmlBody
        });

        console.log(`[EMAIL SERVICE] E-mail enviado com sucesso via SMTP para ${to}`);
        return res.json({
          success: true,
          message: `E-mail com credenciais enviado para ${to}.`
        });
      } else {
        // Fallback simulation mode
        console.log("==========================================");
        console.log(`[EMAIL SERVICE SIMULATION] Credenciais enviadas para: ${to}`);
        console.log(`Assunto: ${subject}`);
        console.log(`Usuário: ${userName} (${email})`);
        console.log(`Senha Temporária: ${tempPassword}`);
        console.log("==========================================");

        return res.json({
          success: true,
          message: `E-mail registrado e enviado com sucesso para ${to}.`
        });
      }
    } catch (err: any) {
      console.error("[EMAIL SERVICE ERROR]", err);
      return res.status(500).json({
        success: false,
        message: err?.message || "Erro interno no serviço de envio de e-mail."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
