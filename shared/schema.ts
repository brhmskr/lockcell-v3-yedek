import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, pgEnum, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoleEnum = pgEnum("user_role", ["admin", "operator"]);
export const machineStatusEnum = pgEnum("machine_status", ["running", "idle", "stopped", "broken"]);
export const workOrderStatusEnum = pgEnum("work_order_status", ["pending", "in_progress", "completed"]);
export const workOrderLineStatusEnum = pgEnum("work_order_line_status", ["pending", "in_progress", "completed"]);
export const productionLogStatusEnum = pgEnum("production_log_status", ["running", "paused", "completed"]);

export const users = pgTable("users", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: userRoleEnum("role").notNull().default("operator"),
  adminRole: text("admin_role").default("staff"),
  registrationNumber: varchar("registration_number", { length: 20 }),
});

export const pagePermissions = pgTable("page_permissions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  pageId: text("page_id").notNull(),
  roleName: text("role_name").notNull(),
  allowed: boolean("allowed").notNull().default(true),
});

export const machines = pgTable("machines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  status: machineStatusEnum("status").notNull().default("idle"),
  currentOperatorId: integer("current_operator_id"),
  currentStopReasonId: integer("current_stop_reason_id"),
  statusChangedAt: timestamp("status_changed_at").defaultNow(),
  hourlyCost: numeric("hourly_cost").notNull().default("0"),
  sortOrder: integer("sort_order").notNull().default(0),
  imageUrl: text("image_url"),
  description: text("description"),
});

export const operations = pgTable("operations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const operationMachines = pgTable("operation_machines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  operationId: integer("operation_id").notNull(),
  machineId: integer("machine_id").notNull(),
});

export const workOrders = pgTable("work_orders", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  orderNumber: text("order_number").notNull().unique(),
  productName: text("product_name").notNull(),
  customerName: text("customer_name"),
  dueDate: timestamp("due_date"),
  targetQuantity: integer("target_quantity").notNull(),
  completedQuantity: integer("completed_quantity").notNull().default(0),
  operationRoute: integer("operation_route").array().notNull(),
  currentOperationIndex: integer("current_operation_index").notNull().default(0),
  status: workOrderStatusEnum("status").notNull().default("pending"),
  targetPrice: numeric("target_price").notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const workOrderLines = pgTable("work_order_lines", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workOrderId: integer("work_order_id").notNull(),
  productCode: text("product_code").notNull(),
  productName: text("product_name").notNull(),
  targetQuantity: integer("target_quantity").notNull(),
  completedQuantity: integer("completed_quantity").notNull().default(0),
  targetPricePerUnit: numeric("target_price_per_unit").notNull().default("0"),
  targetTotalPrice: numeric("target_total_price").notNull().default("0"),
  materialCostPerUnit: numeric("material_cost_per_unit").notNull().default("0"),
  toolCostPerUnit: numeric("tool_cost_per_unit").notNull().default("0"),
  costCurrency: text("cost_currency").notNull().default("EUR"),
  status: workOrderLineStatusEnum("status").notNull().default("pending"),
  currentOperation: text("current_operation"),
});

export const productRoutings = pgTable("product_routings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productCode: text("product_code").notNull(),
  operationCode: text("operation_code").notNull(),
  preferredMachineId: integer("preferred_machine_id"),
  sequenceNumber: integer("sequence_number").notNull().default(0),
});

export const workOrderAttachments = pgTable("work_order_attachments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workOrderId: integer("work_order_id").notNull(),
  workOrderLineId: integer("work_order_line_id"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
});

export const operatorAssignments = pgTable("operator_assignments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  machineId: integer("machine_id").notNull(),
  workOrderLineId: integer("work_order_line_id"),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const recurringExpenses = pgTable("recurring_expenses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  expenseName: text("expense_name").notNull(),
  monthlyAmount: numeric("monthly_amount").notNull(),
  months: jsonb("months").notNull().default(sql`'["1","2","3","4","5","6","7","8","9","10","11","12"]'::jsonb`),
  isActive: boolean("is_active").notNull().default(true),
});

export const monthlyExpenses = pgTable("monthly_expenses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  recurringId: integer("recurring_id").notNull(),
  monthYear: text("month_year").notNull(),
  amount: numeric("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const stopReasons = pgTable("stop_reasons", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
});

export const productionLogs = pgTable("production_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workOrderId: integer("work_order_id").notNull(),
  workOrderLineId: integer("work_order_line_id"),
  operationId: integer("operation_id").notNull(),
  machineId: integer("machine_id").notNull(),
  userId: integer("user_id").notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  producedQuantity: integer("produced_quantity").notNull().default(0),
  status: productionLogStatusEnum("status").notNull().default("running"),
});

export const stopLogs = pgTable("stop_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productionLogId: integer("production_log_id").notNull(),
  stopReasonId: integer("stop_reason_id").notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
});

export const expenses = pgTable("expenses", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  category: text("category").notNull(),
  amount: numeric("amount").notNull(),
  amountTl: numeric("amount_tl"),
  exchangeRate: numeric("exchange_rate"),
  amountEur: numeric("amount_eur"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertMachineSchema = createInsertSchema(machines).omit({ id: true });
export const insertOperationSchema = createInsertSchema(operations).omit({ id: true });
export const insertOperationMachineSchema = createInsertSchema(operationMachines).omit({ id: true });
export const insertWorkOrderSchema = createInsertSchema(workOrders).omit({ id: true, createdAt: true });
export const insertWorkOrderLineSchema = createInsertSchema(workOrderLines).omit({ id: true });
export const insertProductRoutingSchema = createInsertSchema(productRoutings).omit({ id: true });
export const insertWorkOrderAttachmentSchema = createInsertSchema(workOrderAttachments).omit({ id: true, uploadedAt: true });
export const insertOperatorAssignmentSchema = createInsertSchema(operatorAssignments).omit({ id: true, assignedAt: true });
export const insertRecurringExpenseSchema = createInsertSchema(recurringExpenses).omit({ id: true });
export const insertMonthlyExpenseSchema = createInsertSchema(monthlyExpenses).omit({ id: true, createdAt: true });
export const insertStopReasonSchema = createInsertSchema(stopReasons).omit({ id: true });
export const insertProductionLogSchema = createInsertSchema(productionLogs).omit({ id: true });
export const insertStopLogSchema = createInsertSchema(stopLogs).omit({ id: true });
export const insertExpenseSchema = createInsertSchema(expenses).omit({ id: true, createdAt: true });

export const technicalDrawings = pgTable("technical_drawings", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workOrderId: integer("work_order_id").notNull(),
  workOrderLineId: integer("work_order_line_id"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  revisionNumber: integer("revision_number").notNull().default(1),
  revisionDate: timestamp("revision_date").defaultNow(),
  revisionNote: text("revision_note"),
  uploadedBy: integer("uploaded_by").notNull(),
  isCurrent: boolean("is_current").notNull().default(true),
});

export const drawingAcknowledgments = pgTable("drawing_acknowledgments", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  drawingId: integer("drawing_id").notNull(),
  userId: integer("user_id").notNull(),
  acknowledgedAt: timestamp("acknowledged_at").defaultNow(),
});

export const productDefaults = pgTable("product_defaults", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  productCode: text("product_code").notNull().unique(),
  productName: text("product_name"),
  defaultUnitPrice: numeric("default_unit_price").default("0"),
  defaultMaterialCostPerUnit: numeric("default_material_cost_per_unit").default("0"),
  defaultToolCostPerUnit: numeric("default_tool_cost_per_unit").default("0"),
  defaultCostCurrency: text("default_cost_currency").default("EUR"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const costAuditLogs = pgTable("cost_audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workOrderId: integer("work_order_id").notNull(),
  productCode: text("product_code"),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  reason: text("reason").notNull(),
  scope: text("scope").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProductDefaultSchema = createInsertSchema(productDefaults).omit({ id: true, updatedAt: true });
export const insertCostAuditLogSchema = createInsertSchema(costAuditLogs).omit({ id: true, createdAt: true });

export const productionAuditLogs = pgTable("production_audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id").notNull(),
  workOrderId: integer("work_order_id"),
  workOrderLineId: integer("work_order_line_id"),
  productionLogId: integer("production_log_id"),
  action: text("action").notNull(),
  attemptedQuantity: integer("attempted_quantity"),
  maxAllowed: integer("max_allowed"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  machineId: integer("machine_id").notNull(),
  userId: integer("user_id").notNull(),
  message: text("message"),
  fileUrl: text("file_url"),
  isAdminMessage: boolean("is_admin_message").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTechnicalDrawingSchema = createInsertSchema(technicalDrawings).omit({ id: true, revisionDate: true });
export const insertDrawingAcknowledgmentSchema = createInsertSchema(drawingAcknowledgments).omit({ id: true, acknowledgedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });

export const chatReadStatus = pgTable("chat_read_status", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  machineId: integer("machine_id").notNull(),
  userId: integer("user_id").notNull(),
  lastReadAt: timestamp("last_read_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Machine = typeof machines.$inferSelect;
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type Operation = typeof operations.$inferSelect;
export type InsertOperation = z.infer<typeof insertOperationSchema>;
export type OperationMachine = typeof operationMachines.$inferSelect;
export type InsertOperationMachine = z.infer<typeof insertOperationMachineSchema>;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = z.infer<typeof insertWorkOrderSchema>;
export type WorkOrderLine = typeof workOrderLines.$inferSelect;
export type InsertWorkOrderLine = z.infer<typeof insertWorkOrderLineSchema>;
export type ProductRouting = typeof productRoutings.$inferSelect;
export type InsertProductRouting = z.infer<typeof insertProductRoutingSchema>;
export type WorkOrderAttachment = typeof workOrderAttachments.$inferSelect;
export type InsertWorkOrderAttachment = z.infer<typeof insertWorkOrderAttachmentSchema>;
export type OperatorAssignment = typeof operatorAssignments.$inferSelect;
export type InsertOperatorAssignment = z.infer<typeof insertOperatorAssignmentSchema>;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type InsertRecurringExpense = z.infer<typeof insertRecurringExpenseSchema>;
export type MonthlyExpense = typeof monthlyExpenses.$inferSelect;
export type InsertMonthlyExpense = z.infer<typeof insertMonthlyExpenseSchema>;
export type StopReason = typeof stopReasons.$inferSelect;
export type InsertStopReason = z.infer<typeof insertStopReasonSchema>;
export type ProductionLog = typeof productionLogs.$inferSelect;
export type InsertProductionLog = z.infer<typeof insertProductionLogSchema>;
export type StopLog = typeof stopLogs.$inferSelect;
export type InsertStopLog = z.infer<typeof insertStopLogSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type TechnicalDrawing = typeof technicalDrawings.$inferSelect;
export type InsertTechnicalDrawing = z.infer<typeof insertTechnicalDrawingSchema>;
export type DrawingAcknowledgment = typeof drawingAcknowledgments.$inferSelect;
export type InsertDrawingAcknowledgment = z.infer<typeof insertDrawingAcknowledgmentSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type PagePermission = typeof pagePermissions.$inferSelect;
export type ProductDefault = typeof productDefaults.$inferSelect;
export type InsertProductDefault = z.infer<typeof insertProductDefaultSchema>;
export type CostAuditLog = typeof costAuditLogs.$inferSelect;
export type InsertCostAuditLog = z.infer<typeof insertCostAuditLogSchema>;

export const systemConfig = pgTable("system_config", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const licenseAuditLogs = pgTable("license_audit_logs", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: integer("user_id"),
  serverId: text("server_id"),
  action: text("action").notNull(),
  licenseKey: text("license_key"),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SystemConfig = typeof systemConfig.$inferSelect;
export type LicenseAuditLog = typeof licenseAuditLogs.$inferSelect;

export const woOperationStatusEnum = pgEnum("wo_operation_status", ["pending", "in_progress", "completed"]);

export const workOrderOperations = pgTable("work_order_operations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  workOrderId: integer("work_order_id").notNull(),
  operationId: integer("operation_id").notNull(),
  sequenceNumber: integer("sequence_number").notNull().default(0),
  plannedDurationMinutes: integer("planned_duration_minutes"),
  actualStartDate: timestamp("actual_start_date"),
  actualEndDate: timestamp("actual_end_date"),
  assignedMachineId: integer("assigned_machine_id"),
  assignedUserId: integer("assigned_user_id"),
  producedQuantity: integer("produced_quantity").notNull().default(0),
  acceptedQuantity: integer("accepted_quantity").notNull().default(0),
  status: woOperationStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  approvalName: text("approval_name"),
  approvalDate: timestamp("approval_date"),
  approvalCode: text("approval_code"),
  approvalRegistrationNumber: text("approval_registration_number"),
});

export const insertWorkOrderOperationSchema = createInsertSchema(workOrderOperations).omit({ id: true });
export type WorkOrderOperation = typeof workOrderOperations.$inferSelect;
export type InsertWorkOrderOperation = z.infer<typeof insertWorkOrderOperationSchema>;

export const systemSettings = pgTable("system_settings", {
  id: integer("id").primaryKey().default(1),
  companyName: text("company_name").notNull().default("LOCKCELL MES"),
  companyLogo: text("company_logo"),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  webSite: text("web_site"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SystemSettings = typeof systemSettings.$inferSelect;
export type UpdateSystemSettings = Partial<Omit<typeof systemSettings.$inferSelect, "id" | "updatedAt">>;
