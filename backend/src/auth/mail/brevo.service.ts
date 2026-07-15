import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BrevoClient } from "@getbrevo/brevo";

@Injectable()
export class BrevoService {
  private readonly logger = new Logger(BrevoService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPasswordResetOtp(accountEmail: string, otp: string): Promise<void> {
    const apiKey = this.configService.get<string>("BREVO_API_KEY")?.trim();
    const senderEmail = this.configService.get<string>("BREVO_SENDER_EMAIL")?.trim();
    const recoveryEmail = this.configService.get<string>("RECOVERY_EMAIL")?.trim();

    if (!apiKey || !senderEmail || !recoveryEmail) {
      this.logger.error(
        "Brevo configuration incomplete (BREVO_API_KEY, BREVO_SENDER_EMAIL, or RECOVERY_EMAIL missing). OTP email was not sent."
      );
      return;
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
        sender: { email: senderEmail, name: "Inventory System" },
        to: [{ email: recoveryEmail }]
      });
    } catch {
      this.logger.error("Failed to send password reset email via Brevo");
    }
  }
}
