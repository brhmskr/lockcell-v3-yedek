import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import { z } from "zod";
import * as XLSX from "xlsx";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { verifyPassword, hashPassword, requireAuth, requireAdmin, requireLicense, invalidateLicenseCache } from "./auth";
import { generateServerId, validateLicenseKey, checkLicenseStatus, setConfigValue, logLicenseAttempt } from "./license";

// --- KENDİ SUNUCUMUZA DOSYA YÜKLEME AYARLARI ---
const uploadDir = path.join(process.cwd(), "uploads", "objects");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storageEngine = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage: storageEngine });

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const operatorLoginSchema = z.object({
  userId: z.number(),
  pin: z.string().min(1),
  machineId: z.number().optional(),
});

const startSchema = z.object({
  workOrderId: z.number(),
  operationId: z.number(),
  machineId: z.number(),
  userId: z.number(),
});

const stopSchema = z.object({
  stopReasonId: z.number(),
  producedQuantity: z.number().min(0).default(0),
  acceptedQuantity: z.number().min(0).optional(),
});

const quantitySchema = z.object({
  producedQuantity: z.number().min(0),
  acceptedQuantity: z.number().min(0).optional(),
});

const createUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  fullName: z.string().min(1),
  role: z.enum(["admin", "operator"]),
  registrationNumber: z.string().max(20).optional().nullable(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(["admin", "operator"]).optional(),
  password: z.string().min(1).optional(),
  registrationNumber: z.string().max(20).optional().nullable(),
});

const createMachineSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  hourlyCost: z.string().optional(),
  imageUrl: z.string().optional(),
  description: z.string().optional(),
  allowedOperations: z.array(z.number()).optional(),
});

const updateMachineSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  hourlyCost: z.string().optional(),
  imageUrl: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  allowedOperations: z.array(z.number()).optional(),
});

const createWorkOrderSchema = z.object({
  orderNumber: z.string().min(1),
  productName: z.string().min(1),
  targetQuantity: z.number().min(1),
  operationRoute: z.array(z.number()).min(1),
  targetPrice: z.string().optional(),
  materialCostPerUnit: z.string().optional(),
  toolCostPerUnit: z.string().optional(),
  costCurrency: z.string().optional(),
});

const createOperationSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
});

const updateOperationSchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
});

const createExpenseSchema = z.object({
  category: z.string().min(1),
  amount: z.string().min(1),
  amountTl: z.string().optional(),
  exchangeRate: z.string().optional(),
  amountEur: z.string().optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2020),
  description: z.string().optional(),
});

const updateExpenseSchema = z.object({
  category: z.string().min(1).optional(),
  amount: z.string().optional(),
  amountTl: z.string().optional(),
  exchangeRate: z.string().optional(),
  amountEur: z.string().optional(),
  month: z.number().min(1).max(12).optional(),
  year: z.number().min(2020).optional(),
  description: z.string().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- KENDİ SUNUCUMUZA DOSYA YÜKLEME VE OKUMA ROTASI ---
  // Dışarıdan resimlere erişebilmek için bu klasörü dışa açıyoruz
  app.use("/objects", express.static(uploadDir));

  app.post("/api/uploads", requireAuth, upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "Dosya yüklenemedi." });
    }
    // Veritabanına kaydedilecek URL formatı
    const fileUrl = `/objects/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // ==================== AUTH ====================
  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Kullanici adi ve sifre gereklidir." });
    }

    const user = await storage.getUserByUsername(parsed.data.username);
    if (!user) {
      return res.status(401).json({ message: "Giriş bilgileriniz hatalı. Lütfen kontrol edin." });
    }

    if (!verifyPassword(parsed.data.password, user.password)) {
      return res.status(401).json({ message: "Giriş bilgileriniz hatalı. Lütfen kontrol edin." });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    req.session.adminRole = user.adminRole || "staff";

    const { password: _, ...safeUser } = user;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Oturum başlatılırken bir sorun oluştu. Lütfen sayfayı yenileyip tekrar deneyin." });
      res.json(safeUser);
    });
  });

  app.post("/api/auth/operator-login", async (req, res) => {
    const parsed = operatorLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Giriş bilgileriniz hatalı. Lütfen kontrol edin." });
    }

    const user = await storage.getUser(parsed.data.userId);
    if (!user) {
      return res.status(401).json({ message: "Operatör bulunamadı. Lütfen yöneticinize başvurun." });
    }

    if (user.role !== "operator") {
      return res.status(403).json({ message: "Bu giriş yöntemi sadece operatörler içindir." });
    }

    if (!verifyPassword(parsed.data.pin, user.password)) {
      return res.status(401).json({ message: "PIN kodu hatalı. Lütfen tekrar deneyin." });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;
    if (parsed.data.machineId) {
      req.session.operatorMachineId = parsed.data.machineId;
    }

    const { password: _, ...safeUser } = user;
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Oturum başlatılırken bir sorun oluştu. Lütfen sayfayı yenileyip tekrar deneyin." });
      res.json({ ...safeUser, operatorMachineId: parsed.data.machineId || null });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Oturumunuz sona ermiş. Lütfen tekrar giriş yapın." });
    }
    const { password: _, ...safeUser } = user;
    res.json({ ...safeUser, operatorMachineId: req.session.operatorMachineId || null });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Çıkış yapılırken bir sorun oluştu. Lütfen sayfayı yenileyin." });
      }
      res.json({ success: true });
    });
  });

  // ==================== LICENSE ====================
  app.get("/api/license/status", requireAuth, async (_req, res) => {
    const status = await checkLicenseStatus();
    res.json(status);
  });

  app.get("/api/license/server-id", requireAuth, async (_req, res) => {
    const serverId = generateServerId();
    res.json({ serverId });
  });

  app.post("/api/license/activate", requireAdmin, async (req, res) => {
    const schema = z.object({
      licenseKey: z.string().min(1),
      expiryDate: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lisans anahtari ve bitis tarihi gerekli." });
    }

    const { licenseKey, expiryDate } = parsed.data;
    const serverId = generateServerId();
    const userId = req.session.userId!;
    const ipAddress = req.ip || req.socket.remoteAddress || "unknown";

    const isValid = validateLicenseKey(serverId, expiryDate, licenseKey);

    if (!isValid) {
      await logLicenseAttempt({
        userId,
        serverId,
        action: "license_activation_failed",
        licenseKey,
        success: false,
        errorMessage: "Geçersiz lisans anahtarı",
        ipAddress,
      });
      return res.status(400).json({ message: "Geçersiz lisans anahtarı. Lütfen bilgileri kontrol edip tekrar deneyin." });
    }

    const expiry = new Date(expiryDate);
    if (expiry <= new Date()) {
      await logLicenseAttempt({
        userId,
        serverId,
        action: "license_activation_expired_key",
        licenseKey,
        success: false,
        errorMessage: "Süresi dolmuş lisans anahtarı",
        ipAddress,
      });
      return res.status(400).json({ message: "Bu lisans anahtarının süresi geçmiş." });
    }

    await setConfigValue("license_status", "Active");
    await setConfigValue("license_expiry_date", expiryDate);
    await setConfigValue("license_key", licenseKey);
    invalidateLicenseCache();

    await logLicenseAttempt({
      userId,
      serverId,
      action: "license_activated",
      licenseKey,
      success: true,
      ipAddress,
    });

    res.json({ success: true, message: "Lisans basariyla aktive edildi." });
  });

  // ==================== PUBLIC: Operator list (names only, no passwords) ====================
  app.get("/api/operators", async (_req, res) => {
    const users = await storage.getUsers();
    const operators = users
      .filter((u) => u.role === "operator")
      .map(({ password: _, ...u }) => u);
    res.json(operators);
  });

  app.get("/api/machines-public", async (_req, res) => {
    const allMachines = await storage.getMachines();
    res.json(allMachines.map(m => ({ id: m.id, name: m.name, code: m.code, status: m.status })));
  });

  app.get("/api/tv-dashboard", async (_req, res) => {
    const allMachines = await storage.getMachines();
    const users = await storage.getUsers();
    const stopReasons = await storage.getStopReasons();
    const productionLogs = await storage.getProductionLogs();
    const workOrders = await storage.getWorkOrders();
    const operations = await storage.getOperations();
    const workOrderLines = await storage.getWorkOrderLines();

    const tvData = allMachines.map(m => {
      const operator = m.currentOperatorId ? users.find(u => u.id === m.currentOperatorId) : null;
      const stopReason = m.currentStopReasonId ? stopReasons.find(s => s.id === m.currentStopReasonId) : null;
      const activeLog = productionLogs.find(l => l.machineId === m.id && (l.status === "running" || l.status === "paused"));

      let production: {
        workOrderNumber: string;
        operationCode: string;
        operationName: string;
        producedQuantity: number;
        targetQuantity: number;
      } | null = null;

      if (activeLog) {
        const wo = workOrders.find(w => w.id === activeLog.workOrderId);
        const op = operations.find(o => o.id === activeLog.operationId);
        let target = wo?.targetQuantity || 0;
        if (activeLog.workOrderLineId) {
          const line = workOrderLines.find(l => l.id === activeLog.workOrderLineId);
          if (line) {
            target = line.targetQuantity;
          }
        }
        production = {
          workOrderNumber: wo?.orderNumber || "-",
          operationCode: op?.code || "-",
          operationName: op?.name || "-",
          producedQuantity: activeLog.producedQuantity || 0,
          targetQuantity: target,
        };
      }

      return {
        id: m.id,
        name: m.name,
        code: m.code,
        status: m.status,
        imageUrl: m.imageUrl,
        description: m.description,
        statusChangedAt: m.statusChangedAt,
        operatorName: operator?.fullName || null,
        stopReasonName: stopReason?.name || null,
        hasActiveProduction: !!activeLog,
        production,
      };
    });
    res.json(tvData);
  });

  // ==================== USERS (admin only) ====================
  app.get("/api/users", requireAdmin, async (_req, res) => {
    const users = await storage.getUsers();
    const safeUsers = users.map(({ password: _, ...u }) => u);
    res.json(safeUsers);
  });

  app.get("/api/users/:id", requireAdmin, async (req, res) => {
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "Kullanıcı bulunamadı. Lütfen sayfayı yenileyin." });
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    try {
      const parsed = createUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
      }
      const existing = await storage.getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(400).json({ message: "Bu kullanıcı adı zaten kullanılıyor. Farklı bir kullanıcı adı girin." });
      }
      const user = await storage.createUser({
        ...parsed.data,
        password: hashPassword(parsed.data.password),
      });
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      console.error("User create error:", error);
      res.status(500).json({ message: "Personel eklenirken bir sorun oluştu. Lütfen tekrar deneyin." });
    }
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
      }
      const updateData = { ...parsed.data };
      if (updateData.password) {
        updateData.password = hashPassword(updateData.password);
      }
      const updated = await storage.updateUser(Number(req.params.id), updateData);
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error: any) {
      console.error("User update error:", error);
      res.status(500).json({ message: "Personel güncellenirken bir sorun oluştu. Lütfen tekrar deneyin." });
    }
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("User delete error:", error);
      res.status(500).json({ message: "Personel silinirken bir sorun oluştu. Lütfen tekrar deneyin." });
    }
  });

  // ==================== MACHINES (read: auth, write: admin) ====================
  app.get("/api/machines", requireAuth, async (_req, res) => {
    const machines = await storage.getMachines();
    res.json(machines);
  });

  app.post("/api/machines", requireAdmin, async (req, res) => {
    try {
      const parsed = createMachineSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
      }
      const { allowedOperations, hourlyCost, imageUrl, description, ...machineData } = parsed.data;
      const machine = await storage.createMachine({
        ...machineData,
        ...(hourlyCost !== undefined ? { hourlyCost } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(description !== undefined ? { description } : {}),
      });

      if (allowedOperations && allowedOperations.length > 0) {
        for (const opId of allowedOperations) {
          await storage.createOperationMachine({ operationId: opId, machineId: machine.id });
        }
      }
      res.json(machine);
    } catch (error: any) {
      console.error("Machine create error:", error);
      const msg = error.message?.includes("unique") ? "Bu tezgah kodu zaten mevcut. Farklı bir kod girin." : "Tezgah eklenirken bir sorun oluştu. Lütfen tekrar deneyin.";
      res.status(500).json({ message: msg });
    }
  });

  app.patch("/api/machines/:id", requireAdmin, async (req, res) => {
    try {
      const parsed = updateMachineSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
      }
      const { allowedOperations, hourlyCost, imageUrl, description, ...machineData } = parsed.data;
      const fullMachineData = {
        ...machineData,
        ...(hourlyCost !== undefined ? { hourlyCost } : {}),
        ...(imageUrl !== undefined ? { imageUrl } : {}),
        ...(description !== undefined ? { description } : {}),
      };
      const id = Number(req.params.id);

      if (Object.keys(fullMachineData).length > 0) {
        await storage.updateMachine(id, fullMachineData);
      }

      if (allowedOperations !== undefined) {
        const allOps = await storage.getOperations();
        for (const op of allOps) {
          const links = await storage.getOperationMachineLinks(op.id);
          const hasThisMachine = links.some((l) => l.machineId === id);
          const shouldHave = allowedOperations.includes(op.id);

          if (hasThisMachine && !shouldHave) {
            await storage.deleteOperationMachinesByOperation(op.id);
            const otherLinks = links.filter((l) => l.machineId !== id);
            for (const ol of otherLinks) {
              await storage.createOperationMachine({ operationId: op.id, machineId: ol.machineId });
            }
          } else if (!hasThisMachine && shouldHave) {
            await storage.createOperationMachine({ operationId: op.id, machineId: id });
          }
        }
      }

      const updated = await storage.getMachine(id);
      res.json(updated);
    } catch (error: any) {
      console.error("Machine update error:", error);
      res.status(500).json({ message: "Tezgah güncellenirken bir sorun oluştu. Lütfen tekrar deneyin." });
    }
  });

  app.delete("/api/machines/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteMachine(Number(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Machine delete error:", error);
      res.status(500).json({ message: "Tezgah silinirken bir sorun oluştu. Lütfen tekrar deneyin." });
    }
  });

  app.get("/api/machines/:id/operations", requireAuth, async (req, res) => {
    const allOps = await storage.getOperations();
    const result: number[] = [];
    for (const op of allOps) {
      const links = await storage.getOperationMachineLinks(op.id);
      if (links.some((l) => l.machineId === Number(req.params.id))) {
        result.push(op.id);
      }
    }
    res.json(result);
  });

  // ==================== OPERATIONS (read: auth, write: admin) ====================
  app.get("/api/operations", requireAuth, async (_req, res) => {
    const ops = await storage.getOperations();
    res.json(ops);
  });

  app.post("/api/operations", requireAdmin, async (req, res) => {
    const parsed = createOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const op = await storage.createOperation(parsed.data);
    res.json(op);
  });

  app.patch("/api/operations/:id", requireAdmin, async (req, res) => {
    const parsed = updateOperationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const updated = await storage.updateOperation(Number(req.params.id), parsed.data);
    res.json(updated);
  });

  app.delete("/api/operations/:id", requireAdmin, async (req, res) => {
    await storage.deleteOperation(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/operations/:id/machines", requireAuth, async (req, res) => {
    const machines = await storage.getMachinesForOperation(Number(req.params.id));
    res.json(machines);
  });

  app.post("/api/machines/reorder", requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body as { orderedIds: number[] };
      if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "Sıralama bilgileri eksik. Lütfen tekrar deneyin." });
      for (let i = 0; i < orderedIds.length; i++) {
        await storage.updateMachine(orderedIds[i], { sortOrder: i });
      }
      const updated = await storage.getMachines();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Sıralama güncellenirken bir sorun oluştu. Lütfen sayfayı yenileyip tekrar deneyin." });
    }
  });

  app.post("/api/operations/reorder", requireAdmin, async (req, res) => {
    try {
      const { orderedIds } = req.body as { orderedIds: number[] };
      if (!Array.isArray(orderedIds)) return res.status(400).json({ message: "Sıralama bilgileri eksik. Lütfen tekrar deneyin." });
      for (let i = 0; i < orderedIds.length; i++) {
        await storage.updateOperation(orderedIds[i], { sortOrder: i });
      }
      const updated = await storage.getOperations();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: "Sıralama güncellenirken bir sorun oluştu. Lütfen sayfayı yenileyip tekrar deneyin." });
    }
  });

  // ==================== WORK ORDERS (read: auth, write: admin) ====================
  app.get("/api/work-orders", requireAuth, async (req, res) => {
    const opSummary = await storage.getWorkOrderOperationSummary();
    const augment = (wo: any) => {
      const summary = opSummary.get(wo.id);
      return { ...wo, totalOps: summary?.total ?? wo.operationRoute.length, completedOps: summary?.completed ?? wo.currentOperationIndex };
    };
    if (req.query.page !== undefined) {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(50, parseInt(req.query.pageSize as string) || 12);
      const result = await storage.getWorkOrdersPaginated({
        page, pageSize,
        search: req.query.search as string | undefined,
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      });
      return res.json({ data: result.data.map(augment), total: result.total, stats: result.stats });
    }
    const wos = await storage.getWorkOrders();
    res.json(wos.map(augment));
  });

  app.get("/api/work-orders/:id", requireAuth, async (req, res) => {
    const wo = await storage.getWorkOrder(Number(req.params.id));
    if (!wo) return res.status(404).json({ message: "İş emri bulunamadı. Lütfen sayfayı yenileyin." });
    res.json(wo);
  });

  app.post("/api/work-orders", requireAdmin, async (req, res) => {
    const parsed = createWorkOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const { targetPrice, materialCostPerUnit, toolCostPerUnit, costCurrency, ...rest } = parsed.data;

    const productDefault = await storage.getProductDefault(rest.orderNumber);
    const finalUnitPrice = targetPrice || productDefault?.defaultUnitPrice || "0";
    const finalMaterialCost = materialCostPerUnit || productDefault?.defaultMaterialCostPerUnit || "0";
    const finalToolCost = toolCostPerUnit || productDefault?.defaultToolCostPerUnit || "0";
    const finalCurrency = costCurrency || productDefault?.defaultCostCurrency || "EUR";

    const wo = await storage.createWorkOrder({
      ...rest,
      completedQuantity: 0,
      currentOperationIndex: 0,
      status: "pending",
      targetPrice: finalUnitPrice,
    });
    await storage.createWorkOrderLine({
      workOrderId: wo.id,
      productCode: wo.orderNumber,
      productName: wo.productName,
      targetQuantity: wo.targetQuantity,
      completedQuantity: 0,
      targetPricePerUnit: finalUnitPrice,
      targetTotalPrice: String(wo.targetQuantity * parseFloat(finalUnitPrice)),
      materialCostPerUnit: finalMaterialCost,
      toolCostPerUnit: finalToolCost,
      costCurrency: finalCurrency,
      status: "pending",
      currentOperation: null,
    });

    if (rest.operationRoute && rest.operationRoute.length > 0) {
      for (let i = 0; i < rest.operationRoute.length; i++) {
        await storage.createWorkOrderOperation({
          workOrderId: wo.id,
          operationId: rest.operationRoute[i],
          sequenceNumber: i + 1,
          plannedDurationMinutes: 0,
          status: "pending",
        });
      }
    }

    res.json(wo);
  });

  app.patch("/api/work-orders/:id", requireAdmin, async (req, res) => {
    const { materialCostPerUnit, toolCostPerUnit, costCurrency, ...woData } = req.body;
    const updated = await storage.updateWorkOrder(Number(req.params.id), woData);
    if (materialCostPerUnit !== undefined || toolCostPerUnit !== undefined || costCurrency !== undefined) {
      const lines = await storage.getWorkOrderLinesByWorkOrder(updated.id);
      for (const line of lines) {
        const lineUpdate: any = {};
        if (materialCostPerUnit !== undefined) lineUpdate.materialCostPerUnit = materialCostPerUnit;
        if (toolCostPerUnit !== undefined) lineUpdate.toolCostPerUnit = toolCostPerUnit;
        if (costCurrency !== undefined) lineUpdate.costCurrency = costCurrency;
        await storage.updateWorkOrderLine(line.id, lineUpdate);
      }
    }
    res.json(updated);
  });

  app.delete("/api/work-orders/:id", requireAdmin, async (req, res) => {
    await storage.deleteWorkOrder(Number(req.params.id));
    res.json({ success: true });
  });

  const costUpdateSchema = z.object({
    field: z.enum(["unitPrice", "materialCostPerUnit", "toolCostPerUnit"]),
    value: z.string().refine((v) => {
      const num = parseFloat(v);
      return !isNaN(num) && num >= 0;
    }, { message: "Deger 0 veya daha buyuk bir sayi olmalidir." }),
    reason: z.string().min(1, { message: "Degisiklik nedeni zorunludur." }),
    applyDefault: z.boolean().default(false),
  });

  app.patch("/api/work-orders/:id/cost", requireAdmin, async (req, res) => {
    try {
      const workOrderId = Number(req.params.id);
      const parsed = costUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Geçersiz veri." });
      }
      const { field, value, reason, applyDefault } = parsed.data;
      const userId = req.session.userId!;

      const wo = await storage.getWorkOrder(workOrderId);
      if (!wo) {
        return res.status(404).json({ message: "İş emri bulunamadı." });
      }

      const lines = await storage.getWorkOrderLinesByWorkOrder(workOrderId);
      const productCode = lines[0]?.productCode || wo.orderNumber;
      const productName = lines[0]?.productName || wo.productName;
      let oldValue = "0";

      if (field === "unitPrice") {
        oldValue = wo.targetPrice || "0";
        await storage.updateWorkOrder(workOrderId, { targetPrice: value });
        for (const line of lines) {
          await storage.updateWorkOrderLine(line.id, {
            targetPricePerUnit: value,
            targetTotalPrice: String(line.targetQuantity * parseFloat(value)),
          });
        }
      } else {
        const lineField = field === "materialCostPerUnit" ? "materialCostPerUnit" : "toolCostPerUnit";
        oldValue = lines[0]?.[lineField] || "0";
        for (const line of lines) {
          await storage.updateWorkOrderLine(line.id, { [lineField]: value });
        }
      }

      const scope = applyDefault ? "varsayilan" : "sadece_bu_emir";

      await storage.createCostAuditLog({
        workOrderId,
        productCode,
        field,
        oldValue,
        newValue: value,
        reason,
        scope,
        userId,
      });

      if (applyDefault) {
        const existing = await storage.getProductDefault(productCode);
        const defaultData: any = {
          productCode,
          productName,
        };
        if (field === "unitPrice") {
          defaultData.defaultUnitPrice = value;
          if (existing) {
            defaultData.defaultMaterialCostPerUnit = existing.defaultMaterialCostPerUnit;
            defaultData.defaultToolCostPerUnit = existing.defaultToolCostPerUnit;
            defaultData.defaultCostCurrency = existing.defaultCostCurrency;
          }
        } else if (field === "materialCostPerUnit") {
          defaultData.defaultMaterialCostPerUnit = value;
          if (existing) {
            defaultData.defaultUnitPrice = existing.defaultUnitPrice;
            defaultData.defaultToolCostPerUnit = existing.defaultToolCostPerUnit;
            defaultData.defaultCostCurrency = existing.defaultCostCurrency;
          }
        } else {
          defaultData.defaultToolCostPerUnit = value;
          if (existing) {
            defaultData.defaultUnitPrice = existing.defaultUnitPrice;
            defaultData.defaultMaterialCostPerUnit = existing.defaultMaterialCostPerUnit;
            defaultData.defaultCostCurrency = existing.defaultCostCurrency;
          }
        }
        await storage.upsertProductDefault(defaultData);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Cost update error:", error);
      res.status(500).json({ message: "Maliyet güncellenirken hata oluştu." });
    }
  });

  app.get("/api/product-defaults/:productCode", requireAdmin, async (req, res) => {
    try {
      const pd = await storage.getProductDefault(req.params.productCode);
      res.json(pd || null);
    } catch {
      res.status(500).json({ message: "Hata oluştu." });
    }
  });

  app.get("/api/cost-audit-logs/:workOrderId", requireAdmin, async (req, res) => {
    try {
      const logs = await storage.getCostAuditLogs(Number(req.params.workOrderId));
      res.json(logs);
    } catch {
      res.status(500).json({ message: "Hata oluştu." });
    }
  });

  // ==================== STOP REASONS (read: auth, write: admin) ====================
  app.get("/api/stop-reasons", requireAuth, async (_req, res) => {
    const reasons = await storage.getStopReasons();
    res.json(reasons);
  });

  app.post("/api/stop-reasons", requireAdmin, async (req, res) => {
    const schema = z.object({ name: z.string().min(1), code: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const reason = await storage.createStopReason(parsed.data);
    res.json(reason);
  });

  app.patch("/api/stop-reasons/:id", requireAdmin, async (req, res) => {
    const schema = z.object({ name: z.string().min(1).optional(), code: z.string().min(1).optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const updated = await storage.updateStopReason(Number(req.params.id), parsed.data);
    res.json(updated);
  });

  app.delete("/api/stop-reasons/:id", requireAdmin, async (req, res) => {
    await storage.deleteStopReason(Number(req.params.id));
    res.json({ success: true });
  });

  // ==================== PRODUCTION LOGS (auth required) ====================
  app.get("/api/production-logs", requireAuth, async (_req, res) => {
    const logs = await storage.getProductionLogs();
    res.json(logs);
  });

  app.get("/api/production-logs/active/:machineId", requireAuth, async (req, res) => {
    const log = await storage.getActiveProductionLog(Number(req.params.machineId));
    res.json(log || null);
  });

  app.get("/api/production-logs/active-by-user/:userId", requireAuth, async (req, res) => {
    const log = await storage.getActiveProductionLogByUser(Number(req.params.userId));
    res.json(log || null);
  });

  app.patch("/api/logs/takeover", requireAuth, async (req, res) => {
    try {
      const { machineId } = req.body;
      const newUserId = req.session.userId!;
      if (!machineId) {
        return res.status(400).json({ message: "Tezgah bilgisi eksik." });
      }

      const activeLog = await storage.getActiveProductionLog(Number(machineId));
      if (!activeLog) {
        return res.status(404).json({ message: "Bu tezgahta aktif bir üretim bulunamadı." });
      }

      if (activeLog.status === "completed") {
        return res.status(400).json({ message: "Bu üretim zaten tamamlanmış, devralma yapılamaz." });
      }

      if (activeLog.userId === newUserId) {
        return res.status(400).json({ message: "Bu iş zaten size ait." });
      }

      await storage.updateProductionLog(activeLog.id, { userId: newUserId });

      await storage.updateMachine(Number(machineId), {
        currentOperatorId: newUserId,
        statusChangedAt: new Date(),
      });

      res.json({ success: true, logId: activeLog.id });
    } catch (error: any) {
      console.error("Takeover error:", error);
      res.status(500).json({ message: "Vardiya devri sırasında hata oluştu." });
    }
  });

  app.post("/api/production-logs/start", requireAuth, requireLicense, async (req, res) => {
    const parsed = startSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }

    const { workOrderId, operationId, machineId, userId } = parsed.data;

    const existing = await storage.getActiveProductionLog(machineId);
    if (existing) {
      return res.status(400).json({ message: "Bu tezgahta zaten aktif bir üretim var. Önce mevcut üretimi bitirin." });
    }

    const allowedMachines = await storage.getMachinesForOperation(operationId);
    if (allowedMachines.length > 0) {
      const isAllowed = allowedMachines.some(m => m.id === machineId);
      if (!isAllowed) {
        const machineNames = allowedMachines.map(m => m.code).join(", ");
        return res.status(400).json({
          message: `Bu operasyon seçili tezgahta yapılamaz. İzin verilen tezgahlar: ${machineNames}. Lütfen yöneticiye başvurun.`
        });
      }
    }

    const currentDrawing = await storage.getCurrentDrawing(workOrderId);
    if (currentDrawing) {
      const acks = await storage.getDrawingAcknowledgments(currentDrawing.id);
      const userAcked = acks.some(a => a.userId === userId);
      if (!userAcked) {
        return res.status(403).json({
          message: "Uretim baslatmak icin mevcut teknik resim revizyonunu onaylamaniz gerekiyor."
        });
      }
    }

    const woOps = await storage.getWorkOrderOperations(workOrderId);
    const matchingWoOp = woOps.find(op => op.operationId === operationId);
    if (matchingWoOp && woOps.length > 0) {
      const prevOps = woOps.filter(op => op.sequenceNumber < matchingWoOp.sequenceNumber);
      const incompletePrev = prevOps.find(op => op.status !== "completed");
      if (incompletePrev) {
        const prevOperation = await storage.getOperation(incompletePrev.operationId);
        const opCode = prevOperation?.code || "önceki operasyon";
        let machineInfo = "";
        if (incompletePrev.assignedMachineId && incompletePrev.status === "in_progress") {
          const prevMachines = await storage.getMachinesForOperation(incompletePrev.operationId);
          const assignedMachine = prevMachines.find(m => m.id === incompletePrev.assignedMachineId);
          if (assignedMachine) {
            machineInfo = ` (${assignedMachine.code} tezgahında devam ediyor)`;
          }
        } else {
          const allowedMachines = await storage.getMachinesForOperation(incompletePrev.operationId);
          if (allowedMachines.length > 0) {
            machineInfo = ` — İzin verilen tezgahlar: ${allowedMachines.map(m => m.code).join(", ")}`;
          }
        }
        return res.status(400).json({
          message: `Sıra hatası: Önce ${opCode} tamamlanmalı.${machineInfo}`
        });
      }
    }

    const log = await storage.createProductionLog({
      workOrderId,
      operationId,
      machineId,
      userId,
      startTime: new Date(),
      status: "running",
      producedQuantity: 0,
    });

    if (matchingWoOp && !matchingWoOp.actualStartDate) {
      await storage.updateWorkOrderOperation(matchingWoOp.id, {
        actualStartDate: new Date(),
        status: "in_progress",
        assignedMachineId: machineId,
        assignedUserId: userId,
      });
    }

    await storage.updateMachine(machineId, {
      status: "running",
      currentOperatorId: userId,
      statusChangedAt: new Date(),
    });

    await storage.updateWorkOrder(workOrderId, { status: "in_progress" });

    res.json(log);
  });

  app.post("/api/production-logs/:id/stop", requireAuth, requireLicense, async (req, res) => {
    const parsed = stopSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lutfen bir durus nedeni secin." });
    }

    const { stopReasonId, producedQuantity, acceptedQuantity } = parsed.data;
    const logId = Number(req.params.id);
    const userId = req.session.userId!;

    const log = await storage.getProductionLog(logId);
    if (!log) return res.status(404).json({ message: "Üretim kaydı bulunamadı. Lütfen sayfayı yenileyin." });
    if (log.status !== "running") {
      return res.status(400).json({ message: "Bu üretim şu anda çalışmıyor, durdurma işlemi yapılamaz." });
    }

    const { db: txDb } = await import("./db");
    const { productionLogs, workOrderLines, workOrders, stopLogs, machines } = await import("@shared/schema");
    const { eq, sql } = await import("drizzle-orm");

    try {
      await txDb.transaction(async (tx) => {
        const [freshLog] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).for("update");
        if (!freshLog) throw new Error("Üretim kaydı bulunamadı.");

        const newTotal = (freshLog.producedQuantity || 0) + producedQuantity;

        if (freshLog.workOrderLineId) {
          const [line] = await tx.select().from(workOrderLines).where(eq(workOrderLines.id, freshLog.workOrderLineId)).for("update");
          if (line && newTotal > line.targetQuantity) {
            const allowed = line.targetQuantity - (freshLog.producedQuantity || 0);
            await storage.createProductionAuditLog({
              userId,
              workOrderId: freshLog.workOrderId,
              workOrderLineId: freshLog.workOrderLineId,
              productionLogId: logId,
              action: "quantity_overrun_attempt_stop",
              attemptedQuantity: producedQuantity,
              maxAllowed: allowed,
              errorMessage: `Uretim limiti asim denemesi: ${producedQuantity} adet girildi, maksimum ${allowed} adet girilebilir.`,
            });
            throw { statusCode: 400, message: `Hata: Uretim limiti asilamaz! Maksimum ${allowed} adet daha girebilirsiniz.` };
          }

          await tx.update(workOrderLines).set({ completedQuantity: newTotal }).where(eq(workOrderLines.id, freshLog.workOrderLineId));
        }

        await tx.update(productionLogs).set({ status: "paused", producedQuantity: newTotal }).where(eq(productionLogs.id, logId));

        const [wo] = await tx.select().from(workOrders).where(eq(workOrders.id, freshLog.workOrderId));
        if (wo) {
          await tx.update(workOrders).set({ completedQuantity: newTotal }).where(eq(workOrders.id, wo.id));
        }

        await tx.insert(stopLogs).values({
          productionLogId: logId,
          stopReasonId,
          startTime: new Date(),
        });

        const allStopReasons = await storage.getStopReasons();
        const reason = allStopReasons.find(r => r.id === stopReasonId);

        await tx.update(machines).set({
          status: reason?.code === "ariza" ? "broken" : "stopped",
          currentStopReasonId: stopReasonId,
          statusChangedAt: new Date(),
        }).where(eq(machines.id, freshLog.machineId));
      });

      if (producedQuantity > 0) {
        const woOps = await storage.getWorkOrderOperations(log.workOrderId);
        const matchingWoOp = woOps.find(op => op.operationId === log.operationId);
        if (matchingWoOp) {
          const accepted = acceptedQuantity !== undefined ? acceptedQuantity : producedQuantity;
          await storage.updateWorkOrderOperation(matchingWoOp.id, {
            producedQuantity: (matchingWoOp.producedQuantity || 0) + producedQuantity,
            acceptedQuantity: (matchingWoOp.acceptedQuantity || 0) + accepted,
          });
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      if (err.statusCode === 400) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  app.post("/api/production-logs/:id/resume", requireAuth, async (req, res) => {
    const logId = Number(req.params.id);

    const log = await storage.getProductionLog(logId);
    if (!log) return res.status(404).json({ message: "Üretim kaydı bulunamadı. Lütfen sayfayı yenileyin." });
    if (log.status !== "paused") {
      return res.status(400).json({ message: "Bu üretim duraklatılmış değil, devam ettirme işlemi yapılamaz." });
    }

    const activeStop = await storage.getActiveStopLog(logId);
    if (activeStop) {
      await storage.updateStopLog(activeStop.id, { endTime: new Date() });
    }

    await storage.updateProductionLog(logId, {
      status: "running",
    });

    await storage.updateMachine(log.machineId, {
      status: "running",
      currentStopReasonId: null,
      statusChangedAt: new Date(),
    });

    res.json({ success: true });
  });

  app.post("/api/production-logs/:id/finish", requireAuth, requireLicense, async (req, res) => {
    const parsed = quantitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lutfen gecerli bir miktar girin." });
    }

    const { producedQuantity, acceptedQuantity } = parsed.data;
    const logId = Number(req.params.id);
    const userId = req.session.userId!;

    const log = await storage.getProductionLog(logId);
    if (!log) return res.status(404).json({ message: "Üretim kaydı bulunamadı. Lütfen sayfayı yenileyin." });
    if (log.status === "completed") {
      return res.status(400).json({ message: "Bu uretim zaten tamamlanmis." });
    }

    const activeStop = await storage.getActiveStopLog(logId);
    if (activeStop) {
      await storage.updateStopLog(activeStop.id, { endTime: new Date() });
    }

    const { db: txDb } = await import("./db");
    const { productionLogs, workOrderLines, workOrders, workOrderOperations, machines } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");

    try {
      await txDb.transaction(async (tx) => {
        const [freshLog] = await tx.select().from(productionLogs).where(eq(productionLogs.id, logId)).for("update");
        if (!freshLog) throw new Error("Üretim kaydı bulunamadı.");

        const totalProduced = (freshLog.producedQuantity || 0) + producedQuantity;

        if (freshLog.workOrderLineId) {
          const [line] = await tx.select().from(workOrderLines).where(eq(workOrderLines.id, freshLog.workOrderLineId)).for("update");
          if (line && totalProduced > line.targetQuantity) {
            const allowed = line.targetQuantity - (freshLog.producedQuantity || 0);
            await storage.createProductionAuditLog({
              userId,
              workOrderId: freshLog.workOrderId,
              workOrderLineId: freshLog.workOrderLineId,
              productionLogId: logId,
              action: "quantity_overrun_attempt_finish",
              attemptedQuantity: producedQuantity,
              maxAllowed: allowed,
              errorMessage: `Uretim limiti asim denemesi: ${producedQuantity} adet girildi, maksimum ${allowed} adet girilebilir.`,
            });
            throw { statusCode: 400, message: `Hata: Uretim limiti asilamaz! Maksimum ${allowed} adet daha girebilirsiniz.` };
          }

          await tx.update(workOrderLines).set({
            completedQuantity: totalProduced,
            status: "completed",
          }).where(eq(workOrderLines.id, freshLog.workOrderLineId));
        }

        await tx.update(productionLogs).set({
          status: "completed",
          endTime: new Date(),
          producedQuantity: totalProduced,
        }).where(eq(productionLogs.id, logId));

        await tx.update(machines).set({
          status: "idle",
          currentOperatorId: null,
          currentStopReasonId: null,
          statusChangedAt: new Date(),
        }).where(eq(machines.id, freshLog.machineId));

        const [wo] = await tx.select().from(workOrders).where(eq(workOrders.id, freshLog.workOrderId));
        if (wo) {
          const nextIndex = wo.currentOperationIndex + 1;
          const allWoOps = await tx.select().from(workOrderOperations).where(eq(workOrderOperations.workOrderId, wo.id));
          const pendingOps = allWoOps.filter((op) => op.status === "pending");
          const isLastOp = pendingOps.length === 0;

          await tx.update(workOrders).set({
            completedQuantity: totalProduced,
            currentOperationIndex: nextIndex,
            status: isLastOp ? "completed" : "pending",
          }).where(eq(workOrders.id, wo.id));
        }
      });

      const woOps = await storage.getWorkOrderOperations(log.workOrderId);
      const matchingWoOp = woOps.find(op => op.operationId === log.operationId);
      if (matchingWoOp) {
        const accepted = acceptedQuantity !== undefined ? acceptedQuantity : producedQuantity;
        await storage.updateWorkOrderOperation(matchingWoOp.id, {
          producedQuantity: (matchingWoOp.producedQuantity || 0) + producedQuantity,
          acceptedQuantity: (matchingWoOp.acceptedQuantity || 0) + accepted,
          actualEndDate: new Date(),
          status: "completed",
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      if (err.statusCode === 400) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  app.get("/api/stop-logs/:productionLogId", requireAuth, async (req, res) => {
    const logs = await storage.getStopLogs(Number(req.params.productionLogId));
    res.json(logs);
  });

  async function fetchEurTryRate(): Promise<number | null> {
    try {
      const response = await fetch("https://open.er-api.com/v6/latest/EUR");
      if (!response.ok) throw new Error("API yanit vermedi");
      const data = await response.json();
      const rate = data?.rates?.TRY;
      if (rate) return Number(rate);
    } catch {}
    try {
      const fallbackRes = await fetch("https://api.frankfurter.app/latest?from=EUR&to=TRY");
      if (!fallbackRes.ok) throw new Error("Yedek API de yanit vermedi");
      const fallbackData = await fallbackRes.json();
      const rate = fallbackData?.rates?.TRY;
      if (rate) return Number(rate);
    } catch {}
    return null;
  }

  // ==================== EXCHANGE RATE ====================
  app.get("/api/exchange-rate/eur-try", requireAdmin, async (_req, res) => {
    const rate = await fetchEurTryRate();
    if (rate) {
      res.json({ rate, source: "exchangerate-api" });
    } else {
      res.json({ rate: null, error: "Doviz kuru alinamadi. Lutfen manuel giriniz.", source: "none" });
    }
  });

  // ==================== EXPENSES (admin only) ====================
  app.get("/api/expenses", requireAdmin, async (_req, res) => {
    const allExpenses = await storage.getExpenses();
    res.json(allExpenses);
  });

  app.post("/api/expenses", requireAdmin, async (req, res) => {
    const parsed = createExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const expense = await storage.createExpense(parsed.data);
    res.json(expense);
  });

  app.patch("/api/expenses/:id", requireAdmin, async (req, res) => {
    const parsed = updateExpenseSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const updated = await storage.updateExpense(Number(req.params.id), parsed.data);
    res.json(updated);
  });

  app.delete("/api/expenses/:id", requireAdmin, async (req, res) => {
    await storage.deleteExpense(Number(req.params.id));
    res.json({ success: true });
  });

  // ==================== RECURRING EXPENSES (admin only) ====================
  app.get("/api/recurring-expenses", requireAdmin, async (_req, res) => {
    const all = await storage.getRecurringExpenses();
    res.json(all);
  });

  app.post("/api/recurring-expenses", requireAdmin, async (req, res) => {
    const schema = z.object({
      expenseName: z.string().min(1),
      monthlyAmount: z.string().or(z.number()).transform(String),
      months: z.array(z.string()),
      isActive: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const recurring = await storage.createRecurringExpense(parsed.data);

    const currentYear = new Date().getFullYear();
    for (const month of parsed.data.months) {
      const monthYear = `${currentYear}-${month.padStart(2, "0")}`;
      await storage.createMonthlyExpense({
        recurringId: recurring.id,
        monthYear,
        amount: parsed.data.monthlyAmount,
      });
    }

    res.json(recurring);
  });

  app.patch("/api/recurring-expenses/:id", requireAdmin, async (req, res) => {
    const schema = z.object({
      expenseName: z.string().min(1).optional(),
      monthlyAmount: z.string().or(z.number()).transform(String).optional(),
      months: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }

    const updated = await storage.updateRecurringExpense(Number(req.params.id), parsed.data);

    if (parsed.data.months || parsed.data.monthlyAmount) {
      const allMonthly = await storage.getMonthlyExpenses();
      const existingMonthly = allMonthly.filter(m => m.recurringId === Number(req.params.id));
      for (const m of existingMonthly) {
        await storage.deleteMonthlyExpense(m.id);
      }

      const months = parsed.data.months || (updated.months as string[]);
      const amount = parsed.data.monthlyAmount || updated.monthlyAmount;
      const currentYear = new Date().getFullYear();
      for (const month of months) {
        const monthYear = `${currentYear}-${month.padStart(2, "0")}`;
        await storage.createMonthlyExpense({
          recurringId: updated.id,
          monthYear,
          amount: String(amount),
        });
      }
    }

    res.json(updated);
  });

  app.delete("/api/recurring-expenses/:id", requireAdmin, async (req, res) => {
    await storage.deleteRecurringExpense(Number(req.params.id));
    res.json({ success: true });
  });

  app.get("/api/monthly-expenses", requireAdmin, async (_req, res) => {
    const all = await storage.getMonthlyExpenses();
    res.json(all);
  });

  app.get("/api/monthly-expenses/:monthYear", requireAdmin, async (req, res) => {
    const expenses = await storage.getMonthlyExpensesByMonth(req.params.monthYear);
    res.json(expenses);
  });

  // ==================== REPORTS (admin only) ====================
  app.get("/api/reports/production", requireAdmin, async (_req, res) => {
    const [allLogs, allStopLogs, allMachines, allWorkOrders, allOperations, allUsers, allStopReasons, allWoLines, allAssignments] = await Promise.all([
      storage.getProductionLogs(),
      storage.getAllStopLogs(),
      storage.getMachines(),
      storage.getWorkOrders(),
      storage.getOperations(),
      storage.getUsers(),
      storage.getStopReasons(),
      storage.getWorkOrderLines(),
      storage.getOperatorAssignments(),
    ]);

    const safeUsers = allUsers.map(({ password: _, ...u }) => u);

    res.json({
      productionLogs: allLogs,
      stopLogs: allStopLogs,
      machines: allMachines,
      workOrders: allWorkOrders,
      operations: allOperations,
      users: safeUsers,
      stopReasons: allStopReasons,
      workOrderLines: allWoLines,
      operatorAssignments: allAssignments,
    });
  });

  app.get("/api/reports/executive-summary", requireAdmin, async (_req, res) => {
    try {
      const [allLogs, allStopLogs, allMachines, allWorkOrders, allExpenses, allWoLines, allMonthlyExpenses] = await Promise.all([
        storage.getProductionLogs(),
        storage.getAllStopLogs(),
        storage.getMachines(),
        storage.getWorkOrders(),
        storage.getExpenses(),
        storage.getWorkOrderLines(),
        storage.getMonthlyExpenses(),
      ]);

      const eurTryRate = await fetchEurTryRate();

      const toEur = (amount: number, currency: string) => {
        if (currency === "EUR" || !currency) return amount;
        if (currency === "TRY" && eurTryRate && eurTryRate > 0) return amount / eurTryRate;
        return amount;
      };

      const getHoursDiff = (start: string | Date | null, end: string | Date | null): number => {
        if (!start) return 0;
        const s = new Date(start as string);
        const e = end ? new Date(end as string) : new Date();
        return Math.max(0, (e.getTime() - s.getTime()) / (1000 * 60 * 60));
      };

      const getMonthKey = (date: string | Date | null): string => {
        if (!date) return "";
        const d = new Date(date as string);
        const m = d.getMonth() + 1;
        return `${d.getFullYear()}-${m < 10 ? "0" + m : m}`;
      };

      const monthlyExpenseMap: Record<string, number> = {};
      (allMonthlyExpenses || []).forEach((me: any) => {
        const amountTl = parseFloat(me.amount) || 0;
        const amountEur = toEur(amountTl, "TRY");
        monthlyExpenseMap[me.monthYear] = (monthlyExpenseMap[me.monthYear] || 0) + amountEur;
      });
      allExpenses.forEach((e: any) => {
        const m = e.month < 10 ? `0${e.month}` : `${e.month}`;
        const key = `${e.year}-${m}`;
        const amountEur = e.amountEur ? parseFloat(e.amountEur) : parseFloat(e.amount);
        monthlyExpenseMap[key] = (monthlyExpenseMap[key] || 0) + amountEur;
      });

      const getNetRunHours = (log: any) => {
        const totalHours = getHoursDiff(log.startTime, log.endTime);
        const logStops = allStopLogs.filter((s: any) => s.productionLogId === log.id);
        let stopHours = 0;
        logStops.forEach((stop: any) => { stopHours += getHoursDiff(stop.startTime, stop.endTime); });
        return Math.max(0, totalHours - stopHours);
      };

      const monthlyTotalHours: Record<string, number> = {};
      allLogs.forEach((log: any) => {
        if (!log.startTime) return;
        const key = getMonthKey(log.startTime);
        monthlyTotalHours[key] = (monthlyTotalHours[key] || 0) + getNetRunHours(log);
      });

      const woAnalysis = allWorkOrders.map((wo: any) => {
        const woLogs = allLogs.filter((l: any) => l.workOrderId === wo.id);
        const woLines = (allWoLines || []).filter((l: any) => l.workOrderId === wo.id);

        let directMachineCost = 0;
        let totalWoHours = 0;
        const monthHoursMap: Record<string, number> = {};

        woLogs.forEach((log: any) => {
          const machine = allMachines.find((m: any) => m.id === log.machineId);
          const netHours = getNetRunHours(log);
          const hourlyCost = machine ? parseFloat(machine.hourlyCost || "0") : 0;
          directMachineCost += netHours * hourlyCost;
          totalWoHours += netHours;
          if (log.startTime) {
            const mk = getMonthKey(log.startTime);
            monthHoursMap[mk] = (monthHoursMap[mk] || 0) + netHours;
          }
        });

        let overheadCost = 0;
        Object.entries(monthHoursMap).forEach(([mk, woMonthHours]) => {
          const totalMonthExpenses = monthlyExpenseMap[mk] || 0;
          const totalMonthHours = monthlyTotalHours[mk] || 0;
          if (totalMonthHours > 0) {
            overheadCost += (totalMonthExpenses / totalMonthHours) * woMonthHours;
          }
        });

        let materialCostTotal = 0;
        let toolCostTotal = 0;
        woLines.forEach((line: any) => {
          const matPerUnit = parseFloat(line.materialCostPerUnit || "0");
          const toolPerUnit = parseFloat(line.toolCostPerUnit || "0");
          const currency = line.costCurrency || "EUR";
          const qty = line.completedQuantity > 0 ? line.completedQuantity : line.targetQuantity;
          materialCostTotal += toEur(matPerUnit * qty, currency);
          toolCostTotal += toEur(toolPerUnit * qty, currency);
        });

        const totalCost = directMachineCost + overheadCost + materialCostTotal + toolCostTotal;
        const unitPrice = parseFloat(wo.targetPrice || "0");
        const totalSalePrice = unitPrice * wo.targetQuantity;
        const profitLoss = totalSalePrice - totalCost;
        const profitMargin = totalSalePrice > 0 ? (profitLoss / totalSalePrice) * 100 : 0;

        let efficiencyLossCost = 0;
        if (wo.targetQuantity > 0 && totalWoHours > 0) {
          const completedQty = wo.completedQuantity || 0;
          if (completedQty > 0) {
            const actualHoursPerUnit = totalWoHours / completedQty;
            const targetHoursPerUnit = totalWoHours / wo.targetQuantity;
            if (actualHoursPerUnit > targetHoursPerUnit) {
              const hourlyMachineCost = totalWoHours > 0 ? directMachineCost / totalWoHours : 0;
              const hourlyOverhead = totalWoHours > 0 ? overheadCost / totalWoHours : 0;
              const excessHours = (actualHoursPerUnit - targetHoursPerUnit) * completedQty;
              efficiencyLossCost = excessHours * (hourlyMachineCost + hourlyOverhead);
            }
          }
        }

        return {
          orderNumber: wo.orderNumber,
          productName: wo.productName,
          totalSalePrice: Math.round(totalSalePrice * 100) / 100,
          totalCost: Math.round(totalCost * 100) / 100,
          materialCost: Math.round(materialCostTotal * 100) / 100,
          toolCost: Math.round(toolCostTotal * 100) / 100,
          directMachineCost: Math.round(directMachineCost * 100) / 100,
          overheadCost: Math.round(overheadCost * 100) / 100,
          profitLoss: Math.round(profitLoss * 100) / 100,
          profitMargin: Math.round(profitMargin * 10) / 10,
          efficiencyLossCost: Math.round(efficiencyLossCost * 100) / 100,
        };
      });

      const top5Profitable = [...woAnalysis]
        .filter(a => a.totalSalePrice > 0)
        .sort((a, b) => b.profitMargin - a.profitMargin)
        .slice(0, 5);

      const top5ToolCost = [...woAnalysis]
        .filter(a => a.toolCost > 0)
        .sort((a, b) => b.toolCost - a.toolCost)
        .slice(0, 5);

      const totalEfficiencyLoss = woAnalysis.reduce((s: number, a: any) => s + a.efficiencyLossCost, 0);

      res.json({
        top5Profitable,
        top5ToolCost,
        totalEfficiencyLoss: Math.round(totalEfficiencyLoss * 100) / 100,
        eurTryRate,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/reports/profitability", requireAdmin, async (_req, res) => {
    const [allLogs, allStopLogs, allMachines, allWorkOrders, allExpenses, allWoLines, allMonthlyExpenses, allRecurringExpenses] = await Promise.all([
      storage.getProductionLogs(),
      storage.getAllStopLogs(),
      storage.getMachines(),
      storage.getWorkOrders(),
      storage.getExpenses(),
      storage.getWorkOrderLines(),
      storage.getMonthlyExpenses(),
      storage.getRecurringExpenses(),
    ]);

    res.json({
      productionLogs: allLogs,
      stopLogs: allStopLogs,
      machines: allMachines,
      workOrders: allWorkOrders,
      expenses: allExpenses,
      workOrderLines: allWoLines,
      monthlyExpenses: allMonthlyExpenses,
      recurringExpenses: allRecurringExpenses,
    });
  });

  // ==================== PAGE PERMISSIONS (superadmin only) ====================
  app.get("/api/page-permissions", requireAdmin, async (_req, res) => {
    const perms = await storage.getPagePermissions();
    res.json(perms);
  });

  app.post("/api/page-permissions", requireAdmin, async (req, res) => {
    if (req.session.adminRole !== "superadmin") {
      return res.status(403).json({ message: "Sadece Süper Admin bu işlemi yapabilir" });
    }
    const { pageId, roleName, allowed } = req.body;
    if (!pageId || !roleName || typeof allowed !== "boolean") {
      return res.status(400).json({ message: "Geçersiz veri" });
    }
    await storage.setPagePermission(pageId, roleName, allowed);
    res.json({ success: true });
  });

  app.patch("/api/users/:id/admin-role", requireAdmin, async (req, res) => {
    if (req.session.adminRole !== "superadmin") {
      return res.status(403).json({ message: "Sadece Süper Admin bu işlemi yapabilir" });
    }
    const { adminRole } = req.body;
    if (!["superadmin", "manager", "staff"].includes(adminRole)) {
      return res.status(400).json({ message: "Geçersiz rol" });
    }
    const updated = await storage.updateUser(Number(req.params.id), { adminRole });
    const { password: _, ...safeUser } = updated;
    res.json(safeUser);
  });

  // ==================== EXCEL BULK UPLOAD ====================
  app.get("/api/work-orders/template/download", requireAdmin, async (_req, res) => {
    try {
      const headers = [
        "Is Emri No", "Musteri", "Parca Kodu", "Parca Adi",
        "Hedef Adet", "Birim Satis Fiyati (€)", "Malzeme Maliyeti (Birim)",
        "Takim Maliyeti (Birim)", "Para Birimi (EUR/TRY)", "Operasyon Rotasi"
      ];
      const exampleRow = [
        "IE-2026-001", "ABC Firma", "PRC-001", "Mil Saft 50mm",
        100, 25.50, 3.20, 1.50, "EUR", "OP10,OP20,OP30"
      ];
      const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
      ws["!cols"] = [
        { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 22 },
        { wch: 12 }, { wch: 22 }, { wch: 22 },
        { wch: 22 }, { wch: 20 }, { wch: 22 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Is Emirleri");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Disposition", "attachment; filename=is-emri-sablonu.xlsx");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.send(buf);
    } catch {
      res.status(500).json({ message: "Şablon oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin." });
    }
  });

  app.post("/api/work-orders/bulk-upload", requireAdmin, async (req, res) => {
    try {
      const { rows } = req.body;
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ message: "Yüklenecek veri bulunamadı. Lütfen Excel dosyasını kontrol edin." });
      }

      const allOperations = await storage.getOperations();
      const existingWorkOrders = await storage.getWorkOrders();
      const validationErrors: string[] = [];

      const groups: Record<string, typeof rows> = {};
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const key = row.orderNumber || "";
        if (!key) {
          validationErrors.push(`Satir ${i + 2}: Is emri numarasi bos.`);
          continue;
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push({ ...row, _rowIndex: i + 2 });
      }

      for (const [orderNumber, groupRows] of Object.entries(groups)) {
        const existing = existingWorkOrders.find(wo => wo.orderNumber === orderNumber);
        if (existing) {
          validationErrors.push(`Satir ${groupRows[0]._rowIndex}: "${orderNumber}" is emri numarasi zaten mevcut.`);
          continue;
        }

        const firstRow = groupRows[0];
        const routeCodes = (firstRow.operationRoute || "").split(",").map((c: string) => c.trim()).filter(Boolean);
        for (const code of routeCodes) {
          const op = allOperations.find(o => o.code.toLowerCase() === code.toLowerCase());
          if (!op) {
            validationErrors.push(`Satır ${firstRow._rowIndex}: "${code}" operasyon kodu bulunamadı.`);
          }
        }

        for (const row of groupRows) {
          const qty = parseInt(row.targetQty);
          if (!qty || qty <= 0) {
            validationErrors.push(`Satır ${row._rowIndex}: Hedef adet geçersiz veya boş.`);
          }
        }
      }

      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: `Yükleme başarısız: ${validationErrors.length} hata bulundu. Hiçbir kayıt oluşturulmadı.`,
          created: 0,
          errors: validationErrors,
        });
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        let createdCount = 0;

        for (const [orderNumber, groupRows] of Object.entries(groups)) {
          const firstRow = groupRows[0];
          const routeCodes = (firstRow.operationRoute || "").split(",").map((c: string) => c.trim()).filter(Boolean);
          const routeIds: number[] = [];
          for (const code of routeCodes) {
            const op = allOperations.find(o => o.code.toLowerCase() === code.toLowerCase());
            if (op) routeIds.push(op.id);
          }

          const totalQty = groupRows.reduce((s: number, r: any) => s + (parseInt(r.targetQty) || 0), 0);
          const firstUnitPrice = parseFloat(firstRow.unitPrice) || 0;

          const pgArray = `{${routeIds.join(",")}}`;

          const woResult = await client.query(
            `INSERT INTO work_orders (order_number, product_name, customer_name, target_quantity, completed_quantity, operation_route, current_operation_index, status, target_price)
             VALUES ($1, $2, $3, $4, 0, $5, 0, 'pending', $6)
             RETURNING id`,
            [
              orderNumber,
              firstRow.partName || firstRow.customerName || orderNumber,
              firstRow.customerName || null,
              totalQty,
              pgArray,
              String(firstUnitPrice),
            ]
          );
          const woId = woResult.rows[0].id;

          for (const row of groupRows) {
            const qty = parseInt(row.targetQty) || 0;
            const unitPrice = parseFloat(row.unitPrice) || 0;
            const materialCost = parseFloat(row.materialCost) || 0;
            const toolCost = parseFloat(row.toolCost) || 0;
            const costCurrency = (row.costCurrency || "EUR").toUpperCase();

            await client.query(
              `INSERT INTO work_order_lines (work_order_id, product_code, product_name, target_quantity, completed_quantity, target_price_per_unit, target_total_price, material_cost_per_unit, tool_cost_per_unit, cost_currency, status, current_operation)
               VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, 'pending', $10)`,
              [
                woId,
                row.partCode || "-",
                row.partName || "-",
                qty,
                String(unitPrice),
                String(qty * unitPrice),
                String(materialCost),
                String(toolCost),
                costCurrency === "TRY" ? "TRY" : "EUR",
                routeCodes[0] || null,
              ]
            );
          }

          for (let i = 0; i < routeIds.length; i++) {
            await client.query(
              `INSERT INTO work_order_operations (work_order_id, operation_id, sequence_number, planned_duration_minutes, status)
               VALUES ($1, $2, $3, 0, 'pending')`,
              [woId, routeIds[i], i + 1]
            );
          }

          createdCount++;
        }

        await client.query("COMMIT");
        res.json({ created: createdCount, errors: [] });
      } catch (txErr: any) {
        await client.query("ROLLBACK");
        console.error("Bulk upload transaction error:", txErr);
        res.status(500).json({
          message: "Yükleme sırasında bir hata oluştu. Tüm işlem geri alınarak hiçbir kayıt oluşturulmadı.",
          created: 0,
          errors: [`Veritabanı hatası: ${txErr.message || "Bilinmeyen hata"}`],
        });
      } finally {
        client.release();
      }
    } catch {
      res.status(500).json({ message: "Toplu yükleme sırasında bir sorun oluştu. Lütfen tekrar deneyin." });
    }
  });

  // ==================== WORK ORDER LINES ====================
  app.get("/api/work-order-lines", requireAuth, async (_req, res) => {
    const lines = await storage.getWorkOrderLines();
    res.json(lines);
  });

  app.get("/api/work-orders/:id/lines", requireAuth, async (req, res) => {
    const lines = await storage.getWorkOrderLinesByWorkOrder(Number(req.params.id));
    res.json(lines);
  });

  // ==================== WORK ORDER ATTACHMENTS ====================
  app.get("/api/work-orders/:id/attachments", requireAuth, async (req, res) => {
    const attachments = await storage.getWorkOrderAttachments(Number(req.params.id));
    res.json(attachments);
  });

  // ==================== OPERATOR ASSIGNMENTS (admin only) ====================
  app.get("/api/operator-assignments", requireAuth, async (_req, res) => {
    const assignments = await storage.getOperatorAssignments();
    res.json(assignments);
  });

  app.get("/api/operator-assignments/user/:userId", requireAuth, async (req, res) => {
    const allAssignments = await storage.getOperatorAssignments();
    const userAssignments = allAssignments.filter(a => a.userId === Number(req.params.userId));
    res.json(userAssignments);
  });

  app.post("/api/operator-assignments", requireAdmin, async (req, res) => {
    const schema = z.object({
      userId: z.number(),
      machineId: z.number(),
      workOrderLineId: z.number().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const assignment = await storage.createOperatorAssignment(parsed.data);
    res.json(assignment);
  });

  app.post("/api/operator-assignments/bulk", requireAdmin, async (req, res) => {
    const schema = z.object({
      userId: z.number(),
      machineIds: z.array(z.number()).min(1),
      workOrderLineId: z.number().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Lütfen tüm alanları doğru şekilde doldurun." });
    }
    const results = [];
    for (const machineId of parsed.data.machineIds) {
      const existing = (await storage.getOperatorAssignments()).find(
        a => a.userId === parsed.data.userId && a.machineId === machineId
      );
      if (!existing) {
        const assignment = await storage.createOperatorAssignment({
          userId: parsed.data.userId,
          machineId,
          workOrderLineId: parsed.data.workOrderLineId || null,
        });
        results.push(assignment);
      }
    }
    res.json(results);
  });

  app.delete("/api/operator-assignments/:id", requireAdmin, async (req, res) => {
    await storage.deleteOperatorAssignment(Number(req.params.id));
    res.json({ success: true });
  });

  // ==================== CHAT (admin + operator) ====================
  const chatMessageSchema = z.object({
    message: z.string().optional(),
    fileUrl: z.string().optional(),
  }).refine(data => data.message || data.fileUrl, { message: "Mesaj veya dosya gerekli" });

  app.get("/api/chat/read-status/:machineId", requireAuth, async (req, res) => {
    const machineId = Number(req.params.machineId);
    const userId = req.session.userId!;
    const userRole = req.session.role;
    if (userRole === "operator") {
      const machine = await storage.getMachine(machineId);
      if (!machine || machine.currentOperatorId !== userId) {
        return res.status(403).json({ message: "Bu makineye erisim yetkiniz yok" });
      }
    }
    const lastRead = await storage.getReadStatus(machineId, userId);
    res.json({ lastReadAt: lastRead ? lastRead.toISOString() : null });
  });

  app.get("/api/chat/unread-counts", requireAdmin, async (req, res) => {
    const userId = req.session.userId!;
    const allMessages = await storage.getAllChatMessages();
    const machines = await storage.getMachines();
    const counts: Record<number, number> = {};
    for (const m of machines) {
      const lastRead = await storage.getReadStatus(m.id, userId);
      const machineMessages = allMessages.filter(msg =>
        msg.machineId === m.id && !msg.isAdminMessage &&
        (!lastRead || (msg.createdAt && new Date(msg.createdAt) > lastRead))
      );
      counts[m.id] = machineMessages.length;
    }
    res.json(counts);
  });

  app.post("/api/chat/mark-read/:machineId", requireAuth, async (req, res) => {
    const machineId = Number(req.params.machineId);
    const userId = req.session.userId!;
    const userRole = req.session.role;
    if (userRole === "operator") {
      const machine = await storage.getMachine(machineId);
      if (!machine || machine.currentOperatorId !== userId) {
        return res.status(403).json({ message: "Bu makineye erisim yetkiniz yok" });
      }
    }
    await storage.markAsRead(machineId, userId);
    res.json({ success: true });
  });

  app.post("/api/chat/broadcast", requireAdmin, async (req, res) => {
    const parsed = chatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Geçersiz veri" });
    }
    const userId = req.session.userId!;
    const { message, fileUrl } = parsed.data;

    const machines = await storage.getMachines();
    const results = [];
    for (const machine of machines) {
      const created = await storage.createChatMessage({
        machineId: machine.id,
        userId,
        message: message || null,
        fileUrl: fileUrl || null,
        isAdminMessage: true,
      });
      results.push(created);
    }
    res.json({ sent: results.length });
  });

  app.get("/api/chat/:machineId", requireAuth, async (req, res) => {
    const machineId = Number(req.params.machineId);
    const messages = await storage.getChatMessagesByMachine(machineId);
    res.json(messages);
  });

  app.post("/api/chat/:machineId", requireAuth, async (req, res) => {
    const parsed = chatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Geçersiz veri" });
    }
    const machineId = Number(req.params.machineId);
    const userId = req.session.userId!;
    const user = await storage.getUser(userId);
    const isAdmin = user?.role === "admin";
    const { message, fileUrl } = parsed.data;

    const created = await storage.createChatMessage({
      machineId,
      userId,
      message: message || null,
      fileUrl: fileUrl || null,
      isAdminMessage: isAdmin,
    });
    res.json(created);
  });

  // ==================== TECHNICAL DRAWINGS (DMS) ====================
  app.get("/api/technical-drawings/:workOrderId", requireAuth, async (req, res) => {
    try {
      const workOrderId = Number(req.params.workOrderId);
      const drawings = await storage.getDrawingsByWorkOrder(workOrderId);
      res.json(drawings);
    } catch (error: any) {
      console.error("Get drawings error:", error);
      res.status(500).json({ message: "Teknik resimler yüklenirken hata oluştu." });
    }
  });

  app.get("/api/technical-drawings/:workOrderId/current", requireAuth, async (req, res) => {
    try {
      const workOrderId = Number(req.params.workOrderId);
      const drawing = await storage.getCurrentDrawing(workOrderId);
      res.json(drawing || null);
    } catch (error: any) {
      console.error("Get current drawing error:", error);
      res.status(500).json({ message: "Teknik resim yüklenirken hata oluştu." });
    }
  });

  const drawingUploadSchema = z.object({
    fileName: z.string().min(1),
    fileUrl: z.string().min(1),
    revisionNote: z.string().nullable().optional(),
    workOrderLineId: z.number().nullable().optional(),
  });

  app.post("/api/technical-drawings/:workOrderId", requireAdmin, async (req, res) => {
    try {
      const workOrderId = Number(req.params.workOrderId);
      if (isNaN(workOrderId)) {
        return res.status(400).json({ message: "Geçersiz iş emri ID." });
      }

      const parsed = drawingUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Dosya adi ve URL gereklidir." });
      }

      const { fileName, fileUrl, revisionNote, workOrderLineId } = parsed.data;

      const existingDrawings = await storage.getDrawingsByWorkOrder(workOrderId);
      const currentMax = existingDrawings.length > 0
        ? Math.max(...existingDrawings.map(d => d.revisionNumber))
        : 0;

      await storage.deactivateOldRevisions(workOrderId, workOrderLineId || null);

      const drawing = await storage.createDrawing({
        workOrderId,
        workOrderLineId: workOrderLineId || null,
        fileName,
        fileUrl,
        revisionNumber: currentMax + 1,
        revisionNote: revisionNote || null,
        uploadedBy: req.session.userId!,
        isCurrent: true,
      });

      res.json(drawing);
    } catch (error: any) {
      console.error("Create drawing error:", error);
      res.status(500).json({ message: "Teknik resim yüklenirken hata oluştu." });
    }
  });

  app.get("/api/technical-drawings/acknowledgments/:drawingId", requireAuth, async (req, res) => {
    try {
      const drawingId = Number(req.params.drawingId);
      const acks = await storage.getDrawingAcknowledgments(drawingId);
      res.json(acks);
    } catch (error: any) {
      res.status(500).json({ message: "Hata oluştu." });
    }
  });

  app.post("/api/technical-drawings/:drawingId/acknowledge", requireAuth, async (req, res) => {
    try {
      const drawingId = Number(req.params.drawingId);
      if (isNaN(drawingId)) {
        return res.status(400).json({ message: "Geçersiz çizim ID." });
      }
      const userId = req.session.userId!;

      const existingAcks = await storage.getDrawingAcknowledgments(drawingId);
      const alreadyAcked = existingAcks.some(a => a.userId === userId);
      if (alreadyAcked) {
        return res.json({ success: true, message: "Zaten onaylanmış." });
      }

      await storage.createDrawingAcknowledgment({ drawingId, userId });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Acknowledge drawing error:", error);
      res.status(500).json({ message: "Onay kaydedilirken hata oluştu." });
    }
  });

  // ==================== DASHBOARD (admin only) ====================
  app.get("/api/dashboard/stats", requireAdmin, async (_req, res) => {
    const [allMachines, allWorkOrders, allLogs, allOperations, allUsers, allStopReasons, allStopLogs, allAssignments, allRecurring, allWoLines] = await Promise.all([
      storage.getMachines(),
      storage.getWorkOrders(),
      storage.getProductionLogs(),
      storage.getOperations(),
      storage.getUsers(),
      storage.getStopReasons(),
      storage.getAllStopLogs(),
      storage.getOperatorAssignments(),
      storage.getRecurringExpenses(),
      storage.getWorkOrderLines(),
    ]);

    const safeUsers = allUsers.map(({ password: _, ...u }) => u);

    res.json({
      machines: allMachines,
      workOrders: allWorkOrders,
      productionLogs: allLogs,
      operations: allOperations,
      users: safeUsers,
      stopReasons: allStopReasons,
      stopLogs: allStopLogs,
      operatorAssignments: allAssignments,
      recurringExpenses: allRecurring,
      workOrderLines: allWoLines,
    });
  });

  // ==================== WORK ORDER OPERATIONS ====================
  app.get("/api/work-order-operations/:workOrderId", requireAuth, async (req, res) => {
    const ops = await storage.getWorkOrderOperations(Number(req.params.workOrderId));
    res.json(ops);
  });

  app.post("/api/work-order-operations/:workOrderId", requireAdmin, async (req, res) => {
    const workOrderId = Number(req.params.workOrderId);
    const schema = z.object({
      operationId: z.number(),
      sequenceNumber: z.number().min(0),
      plannedDurationMinutes: z.number().min(0).optional(),
      assignedMachineId: z.number().optional(),
      notes: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz veri." });

    const op = await storage.createWorkOrderOperation({
      workOrderId,
      operationId: parsed.data.operationId,
      sequenceNumber: parsed.data.sequenceNumber,
      plannedDurationMinutes: parsed.data.plannedDurationMinutes ?? null,
      assignedMachineId: parsed.data.assignedMachineId ?? null,
      status: "pending",
      producedQuantity: 0,
      acceptedQuantity: 0,
    });
    await storage.syncWorkOrderRoute(workOrderId);
    res.json(op);
  });

  app.patch("/api/work-order-operations/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getWorkOrderOperation(id);
    if (!existing) return res.status(404).json({ message: "Operasyon bulunamadı." });

    const schema = z.object({
      sequenceNumber: z.number().min(0).optional(),
      plannedDurationMinutes: z.number().min(0).nullable().optional(),
      assignedMachineId: z.number().nullable().optional(),
      assignedUserId: z.number().nullable().optional(),
      notes: z.string().nullable().optional(),
      producedQuantity: z.number().min(0).optional(),
      acceptedQuantity: z.number().min(0).optional(),
      status: z.enum(["pending", "in_progress", "completed"]).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz veri." });

    const updated = await storage.updateWorkOrderOperation(id, parsed.data);
    res.json(updated);
  });

  app.delete("/api/work-order-operations/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getWorkOrderOperation(id);
    if (!existing) return res.status(404).json({ message: "Operasyon bulunamadı." });
    await storage.deleteWorkOrderOperation(id);
    await storage.syncWorkOrderRoute(existing.workOrderId);
    res.json({ success: true });
  });

  app.post("/api/work-order-operations/:workOrderId/reorder", requireAdmin, async (req, res) => {
    const workOrderId = Number(req.params.workOrderId);
    const schema = z.object({ orderedIds: z.array(z.number()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz veri." });

    for (let i = 0; i < parsed.data.orderedIds.length; i++) {
      await storage.updateWorkOrderOperation(parsed.data.orderedIds[i], { sequenceNumber: i + 1 });
    }
    await storage.syncWorkOrderRoute(workOrderId);
    const ops = await storage.getWorkOrderOperations(workOrderId);
    res.json(ops);
  });

  app.get("/api/system-settings", requireAuth, async (_req, res) => {
    const settings = await storage.getSystemSettings();
    res.json(settings);
  });

  app.put("/api/system-settings", requireAdmin, async (req, res) => {
    const schema = z.object({
      companyName: z.string().min(1).optional(),
      companyLogo: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      webSite: z.string().nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Geçersiz veri." });
    const updated = await storage.updateSystemSettings(parsed.data);
    res.json(updated);
  });

  app.post("/api/work-order-operations/:id/approve", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getWorkOrderOperation(id);
    if (!existing) return res.status(404).json({ message: "Operasyon bulunamadı." });

    if (existing.approvalName) {
      return res.status(409).json({ message: "Bu operasyon zaten onaylanmış." });
    }

    const user = await storage.getUser(req.session.userId!);
    const approvalCode = `APR-${Date.now().toString(36).toUpperCase()}`;

    const updated = await storage.updateWorkOrderOperation(id, {
      approvalName: user?.fullName || "Bilinmeyen",
      approvalDate: new Date(),
      approvalCode,
      approvalRegistrationNumber: user?.registrationNumber || null,
    });
    res.json(updated);
  });

  return httpServer;
}