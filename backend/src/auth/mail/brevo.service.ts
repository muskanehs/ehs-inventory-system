import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrevoClient } from "@getbrevo/brevo";

function isDeliverableEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  const domain = normalized.split("@")[1] ?? "";
  if (!domain || domain === "localhost") return false;
  if (domain.endsWith(".local") || domain.endsWith(".test") || domain.endsWith(".invalid")) {
    return false;
  }
  return true;
}

function formatBrevoError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const err = error as {
    message?: string;
    statusCode?: number;
    status?: number;
    body?: unknown;
    response?: { statusCode?: number; body?: unknown; data?: unknown };
  };
  const status = err.statusCode ?? err.status ?? err.response?.statusCode;
  const body = err.body ?? err.response?.body ?? err.response?.data;
  const parts = [
    err.message ?? "Brevo request failed",
    status != null ? `status=${status}` : null,
    body != null ? `body=${JSON.stringify(body)}` : null
  ].filter(Boolean);
  return parts.join(" | ");
}

@Injectable()
export class BrevoService implements OnModuleInit {
  private readonly logger = new Logger(BrevoService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.readEnv("BREVO_API_KEY");
    const senderEmail = this.readEnv("BREVO_SENDER_EMAIL");
    const recoveryEmail = this.readEnv("RECOVERY_EMAIL");
    this.logger.log(
      `Brevo mail status: apiKey=${apiKey ? "set" : "MISSING"} sender=${senderEmail ? "set" : "MISSING"} recovery=${recoveryEmail ? "set" : "MISSING"} nodeEnv=${this.nodeEnv() || "(unset)"}`
    );
  }

  private nodeEnv() {
    return (
      this.configService.get<string>("NODE_ENV") ??
      process.env.NODE_ENV ??
      ""
    )
      .trim()
      .toLowerCase();
  }

  private isProduction() {
    const env = this.nodeEnv();
    return env === "production" || env === "prod";
  }

  /** Prefer ConfigService, fall back to process.env (Render/runtime injection). */
  private readEnv(name: string): string | undefined {
    const fromConfig = this.configService.get<string>(name)?.trim();
    if (fromConfig) return fromConfig;
    const fromProcess = process.env[name]?.trim();
    return fromProcess || undefined;
  }

  async sendPasswordResetOtp(accountEmail: string, otp: string): Promise<void> {
    const apiKey = this.readEnv("BREVO_API_KEY");
    const senderEmail = this.readEnv("BREVO_SENDER_EMAIL");
    const recoveryEmail = this.readEnv("RECOVERY_EMAIL");
    const isProduction = this.isProduction();
    // Only for local: log OTP when Brevo is not configured at all.
    // Never hide a failed send when keys are present (that masked prod issues).
    const allowMissingConfigFallback = !isProduction;

    if (!apiKey || !senderEmail) {
      this.logger.error(
        "Brevo configuration incomplete (BREVO_API_KEY or BREVO_SENDER_EMAIL missing). OTP email was not sent."
      );
      if (allowMissingConfigFallback) {
        this.logger.warn(`DEV OTP for ${accountEmail}: ${otp}`);
        return;
      }
      throw new ServiceUnavailableException(
        "Email service is not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL."
      );
    }

    const recipients = new Map<string, { email: string }>();
    // Seed accounts like admin@inventory.local are not deliverable; only send to
    // real mailboxes / RECOVERY_EMAIL.
    if (isDeliverableEmail(accountEmail)) {
      recipients.set(accountEmail.toLowerCase(), { email: accountEmail.trim() });
    }
    if (recoveryEmail && isDeliverableEmail(recoveryEmail)) {
      recipients.set(recoveryEmail.toLowerCase(), { email: recoveryEmail.trim() });
    }
    if (recipients.size === 0) {
      this.logger.error(
        `No deliverable OTP recipient for ${accountEmail}. Set RECOVERY_EMAIL or use a real account email.`
      );
      if (allowMissingConfigFallback) {
        this.logger.warn(`DEV OTP for ${accountEmail}: ${otp}`);
        return;
      }
      throw new ServiceUnavailableException(
        "Email service has no deliverable recipient. Set RECOVERY_EMAIL."
      );
    }

    const textContent = [
      "Password reset requested.",
      "",
      "Account:",
      accountEmail,
      "",
      "OTP:",
      otp,
      "",
      "Valid for 10 minutes.",
      "",
      "If you did not request this reset, ignore this email."
    ].join("\n");

    const htmlContent = `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#111">
        <p>Password reset requested.</p>
        <p><strong>Account:</strong> ${accountEmail}</p>
        <p style="font-size:28px;letter-spacing:4px;font-weight:700">${otp}</p>
        <p>Valid for 10 minutes.</p>
        <p style="color:#555">If you did not request this reset, ignore this email.</p>
      </div>
    `.trim();

    const to = Array.from(recipients.values());

    try {
      const brevo = new BrevoClient({ apiKey, timeoutInSeconds: 30, maxRetries: 2 });
      const result = await brevo.transactionalEmails.sendTransacEmail({
        subject: `Password reset OTP (${accountEmail})`,
        textContent,
        htmlContent,
        sender: { email: senderEmail, name: "Economic Hardware Store" },
        to,
        replyTo: { email: senderEmail, name: "Economic Hardware Store" }
      });
      const messageId =
        result && typeof result === "object" && "messageId" in result
          ? String((result as { messageId?: string }).messageId ?? "")
          : "";
      this.logger.log(
        `Password reset OTP emailed for ${accountEmail} to ${to.map((r) => r.email).join(", ")}` +
          (messageId ? ` messageId=${messageId}` : "")
      );
    } catch (error) {
      const detail = formatBrevoError(error);
      this.logger.error(`Failed to send password reset email via Brevo: ${detail}`);
      throw new ServiceUnavailableException("Failed to send password reset email");
    }
  }
}
