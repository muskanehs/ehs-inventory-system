import { BadRequestException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { randomBytes, randomInt } from "crypto";

const BCRYPT_ROUNDS = 10;

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 8;
export const GENERIC_OTP_MESSAGE = "If the account exists, an OTP has been sent.";

export function validatePasswordStrength(password: string): void {
  if (password.length < 8) {
    throw new BadRequestException("Password must be at least 8 characters");
  }
  if (!/[A-Z]/.test(password)) {
    throw new BadRequestException("Password must include at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    throw new BadRequestException("Password must include at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    throw new BadRequestException("Password must include at least one number");
  }
}

export function assertPasswordsMatch(password: string, confirmPassword: string): void {
  if (password !== confirmPassword) {
    throw new BadRequestException("Passwords do not match");
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** 8-digit cryptographically random OTP. */
export function generateOtp(): string {
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(0, max)).padStart(OTP_LENGTH, "0");
}

export function generateResetSecret(): string {
  return randomBytes(32).toString("hex");
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, BCRYPT_ROUNDS);
}

export async function verifyOtp(otp: string, otpHash: string): Promise<boolean> {
  return bcrypt.compare(otp, otpHash);
}
