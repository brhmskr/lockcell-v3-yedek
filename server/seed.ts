import { db } from "./db";
import { users, machines, operations, operationMachines, workOrders, stopReasons } from "@shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "./auth";

export async function seedDatabase() {
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    const firstUser = existingUsers[0];
    if (!firstUser.password.includes(":")) {
      for (const u of existingUsers) {
        const newPassword = u.role === "operator" ? "1234" : u.password;
        await db.update(users)
          .set({ password: hashPassword(newPassword) })
          .where(eq(users.id, u.id));
      }
      console.log("Passwords migrated to hashed format");
    }
    return;
  }

  const [admin] = await db.insert(users).values([
    { username: "admin", password: hashPassword("admin123"), fullName: "Ahmet Yilmaz", role: "admin" as const },
    { username: "op1", password: hashPassword("1234"), fullName: "Mehmet Demir", role: "operator" as const },
    { username: "op2", password: hashPassword("1234"), fullName: "Ayse Kaya", role: "operator" as const },
    { username: "op3", password: hashPassword("1234"), fullName: "Ali Celik", role: "operator" as const },
    { username: "op4", password: hashPassword("1234"), fullName: "Fatma Ozturk", role: "operator" as const },
  ]).returning();

  const createdMachines = await db.insert(machines).values([
    { name: "CNC Freze 1", code: "CNC-1", status: "idle" as const },
    { name: "CNC Freze 2", code: "CNC-2", status: "idle" as const },
    { name: "Torna 1", code: "TORNA-1", status: "idle" as const },
    { name: "Torna 2", code: "TORNA-2", status: "idle" as const },
    { name: "Taslama 1", code: "TASLAMA-1", status: "idle" as const },
    { name: "Kalite Kontrol", code: "QC-1", status: "idle" as const },
  ]).returning();

  const createdOps = await db.insert(operations).values([
    { name: "Kesim", code: "OP10", description: "Ham malzeme kesim operasyonu" },
    { name: "Torna", code: "OP20", description: "Torna talaslı imalat operasyonu" },
    { name: "Freze", code: "OP30", description: "CNC freze operasyonu" },
    { name: "Taslama", code: "OP40", description: "Yuzey taslama operasyonu" },
    { name: "Kalite Kontrol", code: "OP50", description: "Son kalite kontrol operasyonu" },
  ]).returning();

  const opMachineLinks = [
    { operationId: createdOps[0].id, machineId: createdMachines[0].id },
    { operationId: createdOps[0].id, machineId: createdMachines[1].id },
    { operationId: createdOps[1].id, machineId: createdMachines[2].id },
    { operationId: createdOps[1].id, machineId: createdMachines[3].id },
    { operationId: createdOps[2].id, machineId: createdMachines[0].id },
    { operationId: createdOps[2].id, machineId: createdMachines[1].id },
    { operationId: createdOps[3].id, machineId: createdMachines[4].id },
    { operationId: createdOps[4].id, machineId: createdMachines[5].id },
  ];
  await db.insert(operationMachines).values(opMachineLinks);

  await db.insert(stopReasons).values([
    { name: "Ariza", code: "ariza" },
    { name: "Malzeme Bekleme", code: "malzeme" },
    { name: "Mola", code: "mola" },
    { name: "Setup / Ayar", code: "setup" },
    { name: "Kalip Degisimi", code: "kalip" },
    { name: "Plansiz Duruş", code: "plansiz" },
  ]);

  await db.insert(workOrders).values([
    {
      orderNumber: "IE-2026-001",
      productName: "Mil Saft 40mm",
      targetQuantity: 100,
      completedQuantity: 0,
      operationRoute: [createdOps[0].id, createdOps[1].id, createdOps[3].id, createdOps[4].id],
      currentOperationIndex: 0,
      status: "pending" as const,
    },
    {
      orderNumber: "IE-2026-002",
      productName: "Flanş Kapak",
      targetQuantity: 50,
      completedQuantity: 0,
      operationRoute: [createdOps[0].id, createdOps[2].id, createdOps[4].id],
      currentOperationIndex: 0,
      status: "pending" as const,
    },
    {
      orderNumber: "IE-2026-003",
      productName: "Rulman Yatagi",
      targetQuantity: 200,
      completedQuantity: 0,
      operationRoute: [createdOps[0].id, createdOps[1].id, createdOps[2].id, createdOps[3].id, createdOps[4].id],
      currentOperationIndex: 0,
      status: "pending" as const,
    },
  ]);

  console.log("Database seeded successfully");
}
