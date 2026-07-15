import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
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

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetOtp(accountEmail: string, otp: string): Promise<void> {
    const apiKey = this.configService.get<string>("BREVO_API_KEY")?.trim();
    const senderEmail = this.configService.get<string>("BREVO_SENDER_EMAIL")?.trim();
    const recoveryEmail = this.configService.get<string>("RECOVERY_EMAIL")?.trim();
    const isProduction =
      (this.configService.get<string>("NODE_ENV") ?? process.env.NODE_ENV) === "production";

    if (!apiKey || !senderEmail) {
      this.logger.error(
        "Brevo configuration incomplete (BREVO_API_KEY or BREVO_SENDER_EMAIL missing). OTP email was not sent."
      );
      if (!isProduction) {
        this.logger.warn(`DEV OTP for ${accountEmail}: ${otp}`);
        return;
      }
      throw new ServiceUnavailableException("Email service is not configured");
    }

    const recipients = new Map<string, { email: string }>();
    // Seed / local accounts like admin@inventory.local are not deliverable; Brevo
    // may reject the whole request if they appear in `to`. Prefer recovery inbox
    // and only add the account email when it looks like a real mailbox.
    if (isDeliverableEmail(accountEmail)) {
      recipients.set(accountEmail.toLowerCase(), { email: accountEmail });
    }
    if (recoveryEmail) {
      recipients.set(recoveryEmail.toLowerCase(), { email: recoveryEmail });
    }
    if (recipients.size === 0) {
      this.logger.error(
        `No deliverable OTP recipient for ${accountEmail}. Set RECOVERY_EMAIL or use a real account email.`
      );
      if (!isProduction) {
        this.logger.warn(`DEV OTP for ${accountEmail}: ${otp}`);
        return;
      }
      throw new ServiceUnavailableException("Email service has no deliverable recipient");
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

    try {
      const brevo = new BrevoClient({ apiKey });
      await brevo.transactionalEmails.sendTransacEmail({
        subject: "Inventory System Password Reset",
        textContent,
        sender: { email: senderEmail, name: "Economic Hardware Store" },
        to: Array.from(recipients.values())
      });
      this.logger.log(
        `Password reset OTP emailed for ${accountEmail} to ${Array.from(recipients.keys()).join(", ")}`
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send password reset email via Brevo: ${detail}`);
      if (!isProduction) {
        this.logger.warn(`DEV OTP for ${accountEmail}: ${otp}`);
        return;
      }
      throw new ServiceUnavailableException("Failed to send password reset email");
    }
  }
}
