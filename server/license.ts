import { createHmac, createHash } from "crypto";
import os from "os";
import { db } from "./db";
import { systemConfig, licenseAuditLogs } from "@shared/schema";
import { eq } from "drizzle-orm";

let cachedServerId: string | null = null;

export function generateServerId(): string {
  if (cachedServerId) return cachedServerId;

  const hostname = os.hostname();
  const cpus = os.cpus();
  const cpuModel = cpus.length > 0 ? cpus[0].model : "unknown";
  const networkInterfaces = os.networkInterfaces();

  let macAddress = "00:00:00:00:00:00";
  for (const iface of Object.values(networkInterfaces)) {
    if (!iface) continue;
    for (const details of iface) {
      if (!details.internal && details.mac && details.mac !== "00:00:00:00:00:00") {
        macAddress = details.mac;
        break;
      }
    }
    if (macAddress !== "00:00:00:00:00:00") break;
  }

  const rawData = `${hostname}|${cpuModel}|${macAddress}|${os.platform()}|${os.arch()}`;
  const hash = createHash("sha256").update(rawData).digest("hex").toUpperCase();
  cachedServerId = `${hash.substring(0, 4)}-${hash.substring(4, 8)}-${hash.substring(8, 12)}-${hash.substring(12, 16)}`;
  return cachedServerId;
}

export function generateLicenseKey(serverId: string, expiryDate: string): string {
  const salt = process.env.SECRET_SALT || "Lockcell-2026-X-Ozel-Sifre";
  const rawData = `${serverId}|${expiryDate}|${salt}`;
  const hash = createHmac("sha256", salt).update(rawData).digest("hex").toUpperCase();
  const key16 = hash.substring(0, 16);
  return `${key16.substring(0, 4)}-${key16.substring(4, 8)}-${key16.substring(8, 12)}-${key16.substring(12, 16)}`;
}

export function validateLicenseKey(serverId: string, expiryDate: string, inputKey: string): boolean {
  const expected = generateLicenseKey(serverId, expiryDate);
  return expected === inputKey.toUpperCase().trim();
}

export async function getConfigValue(key: string): Promise<string | null> {
  const [row] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
  return row?.value || null;
}

export async function setConfigValue(key: string, value: string): Promise<void> {
  const [existing] = await db.select().from(systemConfig).where(eq(systemConfig.key, key));
  if (existing) {
    await db.update(systemConfig).set({ value, updatedAt: new Date() }).where(eq(systemConfig.key, key));
  } else {
    await db.insert(systemConfig).values({ key, value });
  }
}

export async function logLicenseAttempt(data: {
  userId?: number;
  serverId: string;
  action: string;
  licenseKey?: string;
  success: boolean;
  errorMessage?: string;
  ipAddress?: string;
}): Promise<void> {
  await db.insert(licenseAuditLogs).values(data);
}

export interface LicenseStatus {
  status: "active" | "demo" | "grace" | "expired";
  daysRemaining: number;
  expiryDate: string | null;
  installationDate: string | null;
  serverId: string;
  message: string;
}

export async function checkLicenseStatus(): Promise<LicenseStatus> {
  const serverId = generateServerId();
  const now = new Date();

  const licenseStatus = await getConfigValue("license_status");
  const licenseExpiry = await getConfigValue("license_expiry_date");
  const installationDate = await getConfigValue("installation_date");

  if (licenseStatus === "Active" && licenseExpiry) {
    const expiry = new Date(licenseExpiry);
    const daysRemaining = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining > 0) {
      return {
        status: "active",
        daysRemaining,
        expiryDate: licenseExpiry,
        installationDate,
        serverId,
        message: `Lisans aktif. ${daysRemaining} gün kaldı.`,
      };
    }

    if (daysRemaining >= -3) {
      return {
        status: "grace",
        daysRemaining: 3 + daysRemaining,
        expiryDate: licenseExpiry,
        installationDate,
        serverId,
        message: `Lisans süresi doldu. ${3 + daysRemaining} gün ek süre kaldı.`,
      };
    }

    return {
      status: "expired",
      daysRemaining: 0,
      expiryDate: licenseExpiry,
      installationDate,
      serverId,
      message: "Lisansınız süresi dolmuştur. Lütfen yenileyin.",
    };
  }

  if (installationDate) {
    const installDate = new Date(installationDate);
    const demoDays = 15;
    const demoExpiry = new Date(installDate.getTime() + demoDays * 24 * 60 * 60 * 1000);
    const daysRemaining = Math.ceil((demoExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysRemaining > 0) {
      return {
        status: "demo",
        daysRemaining,
        expiryDate: demoExpiry.toISOString(),
        installationDate,
        serverId,
        message: `Demo sürümü. ${daysRemaining} gün kaldı.`,
      };
    }

    if (daysRemaining >= -3) {
      return {
        status: "grace",
        daysRemaining: 3 + daysRemaining,
        expiryDate: demoExpiry.toISOString(),
        installationDate,
        serverId,
        message: `Demo süresi doldu. ${3 + daysRemaining} gün ek süre kaldı.`,
      };
    }

    return {
      status: "expired",
      daysRemaining: 0,
      expiryDate: demoExpiry.toISOString(),
      installationDate,
      serverId,
      message: "Demo sureniz dolmustur. Lutfen lisans satin alin.",
    };
  }

  return {
    status: "demo",
    daysRemaining: 15,
    expiryDate: null,
    installationDate: null,
    serverId,
    message: "Demo sürümü. 15 gün kaldı.",
  };
}
