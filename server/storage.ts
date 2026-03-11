import { eq, and, or, isNull, asc, desc, ilike, gte, lte, count, sql } from "drizzle-orm";
import { db } from "./db";
import {
  users, machines, operations, operationMachines, workOrders,
  stopReasons, productionLogs, stopLogs, expenses,
  workOrderLines, productRoutings, workOrderAttachments,
  operatorAssignments, recurringExpenses, monthlyExpenses,
  chatMessages, chatReadStatus, pagePermissions,
  technicalDrawings, drawingAcknowledgments,
  productDefaults, costAuditLogs, productionAuditLogs,
  workOrderOperations,
  type User, type InsertUser,
  type PagePermission,
  type Machine, type InsertMachine,
  type Operation, type InsertOperation,
  type OperationMachine, type InsertOperationMachine,
  type WorkOrder, type InsertWorkOrder,
  type WorkOrderLine, type InsertWorkOrderLine,
  type ProductRouting, type InsertProductRouting,
  type WorkOrderAttachment, type InsertWorkOrderAttachment,
  type OperatorAssignment, type InsertOperatorAssignment,
  type RecurringExpense, type InsertRecurringExpense,
  type MonthlyExpense, type InsertMonthlyExpense,
  type StopReason, type InsertStopReason,
  type ProductionLog, type InsertProductionLog,
  type StopLog, type InsertStopLog,
  type Expense, type InsertExpense,
  type ChatMessage, type InsertChatMessage,
  type TechnicalDrawing, type InsertTechnicalDrawing,
  type DrawingAcknowledgment, type InsertDrawingAcknowledgment,
  type ProductDefault, type InsertProductDefault,
  type CostAuditLog, type InsertCostAuditLog,
  type WorkOrderOperation, type InsertWorkOrderOperation,
  systemSettings, type SystemSettings, type UpdateSystemSettings,
} from "@shared/schema";

export interface IStorage {
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  getMachines(): Promise<Machine[]>;
  getMachine(id: number): Promise<Machine | undefined>;
  createMachine(machine: InsertMachine): Promise<Machine>;
  updateMachine(id: number, data: Partial<Machine>): Promise<Machine>;
  deleteMachine(id: number): Promise<void>;

  getOperations(): Promise<Operation[]>;
  getOperation(id: number): Promise<Operation | undefined>;
  createOperation(op: InsertOperation): Promise<Operation>;
  updateOperation(id: number, data: Partial<Operation>): Promise<Operation>;
  deleteOperation(id: number): Promise<void>;
  getMachinesForOperation(operationId: number): Promise<Machine[]>;
  getOperationMachineLinks(operationId: number): Promise<OperationMachine[]>;
  createOperationMachine(data: InsertOperationMachine): Promise<void>;
  deleteOperationMachinesByOperation(operationId: number): Promise<void>;

  getWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrdersPaginated(opts: { page: number; pageSize: number; search?: string; status?: string; startDate?: string; endDate?: string }): Promise<{ data: WorkOrder[]; total: number; stats: { active: number; pending: number; completed: number } }>;
  getWorkOrder(id: number): Promise<WorkOrder | undefined>;
  createWorkOrder(wo: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: number, data: Partial<WorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(id: number): Promise<void>;

  getWorkOrderLines(): Promise<WorkOrderLine[]>;
  getWorkOrderLinesByWorkOrder(workOrderId: number): Promise<WorkOrderLine[]>;
  getWorkOrderLine(id: number): Promise<WorkOrderLine | undefined>;
  createWorkOrderLine(line: InsertWorkOrderLine): Promise<WorkOrderLine>;
  updateWorkOrderLine(id: number, data: Partial<WorkOrderLine>): Promise<WorkOrderLine>;
  deleteWorkOrderLine(id: number): Promise<void>;

  getProductRoutings(): Promise<ProductRouting[]>;
  getProductRoutingsByProduct(productCode: string): Promise<ProductRouting[]>;
  createProductRouting(routing: InsertProductRouting): Promise<ProductRouting>;
  updateProductRouting(id: number, data: Partial<ProductRouting>): Promise<ProductRouting>;
  deleteProductRouting(id: number): Promise<void>;

  getWorkOrderAttachments(workOrderId: number): Promise<WorkOrderAttachment[]>;
  createWorkOrderAttachment(attachment: InsertWorkOrderAttachment): Promise<WorkOrderAttachment>;
  deleteWorkOrderAttachment(id: number): Promise<void>;

  getOperatorAssignments(): Promise<OperatorAssignment[]>;
  getOperatorAssignmentsByMachine(machineId: number): Promise<OperatorAssignment[]>;
  createOperatorAssignment(assignment: InsertOperatorAssignment): Promise<OperatorAssignment>;
  deleteOperatorAssignment(id: number): Promise<void>;

  getRecurringExpenses(): Promise<RecurringExpense[]>;
  getRecurringExpense(id: number): Promise<RecurringExpense | undefined>;
  createRecurringExpense(expense: InsertRecurringExpense): Promise<RecurringExpense>;
  updateRecurringExpense(id: number, data: Partial<RecurringExpense>): Promise<RecurringExpense>;
  deleteRecurringExpense(id: number): Promise<void>;

  getMonthlyExpenses(): Promise<MonthlyExpense[]>;
  getMonthlyExpensesByMonth(monthYear: string): Promise<MonthlyExpense[]>;
  createMonthlyExpense(expense: InsertMonthlyExpense): Promise<MonthlyExpense>;
  updateMonthlyExpense(id: number, data: Partial<MonthlyExpense>): Promise<MonthlyExpense>;
  deleteMonthlyExpense(id: number): Promise<void>;

  getStopReasons(): Promise<StopReason[]>;
  createStopReason(sr: InsertStopReason): Promise<StopReason>;
  updateStopReason(id: number, data: Partial<StopReason>): Promise<StopReason>;
  deleteStopReason(id: number): Promise<void>;

  getProductionLogs(): Promise<ProductionLog[]>;
  getProductionLog(id: number): Promise<ProductionLog | undefined>;
  getActiveProductionLog(machineId: number): Promise<ProductionLog | undefined>;
  getActiveProductionLogByUser(userId: number): Promise<ProductionLog | undefined>;
  createProductionLog(log: InsertProductionLog): Promise<ProductionLog>;
  updateProductionLog(id: number, data: Partial<ProductionLog>): Promise<ProductionLog>;

  createProductionAuditLog(data: { userId: number; workOrderId?: number; workOrderLineId?: number; productionLogId?: number; action: string; attemptedQuantity?: number; maxAllowed?: number; errorMessage?: string }): Promise<void>;

  getStopLogs(productionLogId: number): Promise<StopLog[]>;
  getAllStopLogs(): Promise<StopLog[]>;
  getActiveStopLog(productionLogId: number): Promise<StopLog | undefined>;
  createStopLog(log: InsertStopLog): Promise<StopLog>;
  updateStopLog(id: number, data: Partial<StopLog>): Promise<StopLog>;

  getExpenses(): Promise<Expense[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: number, data: Partial<Expense>): Promise<Expense>;
  deleteExpense(id: number): Promise<void>;

  getChatMessagesByMachine(machineId: number): Promise<ChatMessage[]>;
  createChatMessage(msg: InsertChatMessage): Promise<ChatMessage>;
  getAllChatMessages(): Promise<ChatMessage[]>;
  getReadStatus(machineId: number, userId: number): Promise<Date | null>;
  markAsRead(machineId: number, userId: number): Promise<void>;

  getPagePermissions(): Promise<PagePermission[]>;
  setPagePermission(pageId: string, roleName: string, allowed: boolean): Promise<void>;

  getDrawingsByWorkOrder(workOrderId: number): Promise<TechnicalDrawing[]>;
  getCurrentDrawing(workOrderId: number): Promise<TechnicalDrawing | undefined>;
  createDrawing(drawing: InsertTechnicalDrawing): Promise<TechnicalDrawing>;
  deactivateOldRevisions(workOrderId: number, workOrderLineId?: number | null): Promise<void>;
  getDrawingAcknowledgments(drawingId: number): Promise<DrawingAcknowledgment[]>;
  createDrawingAcknowledgment(ack: InsertDrawingAcknowledgment): Promise<DrawingAcknowledgment>;

  getProductDefault(productCode: string): Promise<ProductDefault | undefined>;
  upsertProductDefault(data: InsertProductDefault): Promise<ProductDefault>;
  createCostAuditLog(log: InsertCostAuditLog): Promise<CostAuditLog>;
  getCostAuditLogs(workOrderId?: number): Promise<CostAuditLog[]>;

  getWorkOrderOperations(workOrderId: number): Promise<WorkOrderOperation[]>;
  getWorkOrderOperation(id: number): Promise<WorkOrderOperation | undefined>;
  createWorkOrderOperation(data: InsertWorkOrderOperation): Promise<WorkOrderOperation>;
  updateWorkOrderOperation(id: number, data: Partial<WorkOrderOperation>): Promise<WorkOrderOperation>;
  deleteWorkOrderOperation(id: number): Promise<void>;
  deleteWorkOrderOperationsByWorkOrder(workOrderId: number): Promise<void>;
  getWorkOrderOperationSummary(): Promise<Map<number, { total: number; completed: number }>>;
  syncWorkOrderRoute(workOrderId: number): Promise<void>;
  syncAllWorkOrderRoutes(): Promise<void>;

  getSystemSettings(): Promise<SystemSettings>;
  updateSystemSettings(data: UpdateSystemSettings): Promise<SystemSettings>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(user).returning();
    return created;
  }

  async updateUser(id: number, data: Partial<User>): Promise<User> {
    const [updated] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getMachines(): Promise<Machine[]> {
    return db.select().from(machines).orderBy(asc(machines.sortOrder), asc(machines.id));
  }

  async getMachine(id: number): Promise<Machine | undefined> {
    const [machine] = await db.select().from(machines).where(eq(machines.id, id));
    return machine;
  }

  async createMachine(machine: InsertMachine): Promise<Machine> {
    const [created] = await db.insert(machines).values(machine).returning();
    return created;
  }

  async updateMachine(id: number, data: Partial<Machine>): Promise<Machine> {
    const [updated] = await db.update(machines).set(data).where(eq(machines.id, id)).returning();
    return updated;
  }

  async deleteMachine(id: number): Promise<void> {
    await db.delete(operationMachines).where(eq(operationMachines.machineId, id));
    await db.delete(machines).where(eq(machines.id, id));
  }

  async getOperations(): Promise<Operation[]> {
    return db.select().from(operations).orderBy(asc(operations.sortOrder), asc(operations.id));
  }

  async getOperation(id: number): Promise<Operation | undefined> {
    const [op] = await db.select().from(operations).where(eq(operations.id, id));
    return op;
  }

  async createOperation(op: InsertOperation): Promise<Operation> {
    const [created] = await db.insert(operations).values(op).returning();
    return created;
  }

  async updateOperation(id: number, data: Partial<Operation>): Promise<Operation> {
    const [updated] = await db.update(operations).set(data).where(eq(operations.id, id)).returning();
    return updated;
  }

  async deleteOperation(id: number): Promise<void> {
    await db.delete(operationMachines).where(eq(operationMachines.operationId, id));
    await db.delete(operations).where(eq(operations.id, id));
  }

  async getMachinesForOperation(operationId: number): Promise<Machine[]> {
    const links = await db.select().from(operationMachines).where(eq(operationMachines.operationId, operationId));
    if (links.length === 0) return [];
    const machineIds = links.map(l => l.machineId);
    const result: Machine[] = [];
    for (const mid of machineIds) {
      const m = await this.getMachine(mid);
      if (m) result.push(m);
    }
    return result;
  }

  async getOperationMachineLinks(operationId: number): Promise<OperationMachine[]> {
    return db.select().from(operationMachines).where(eq(operationMachines.operationId, operationId));
  }

  async createOperationMachine(data: InsertOperationMachine): Promise<void> {
    await db.insert(operationMachines).values(data);
  }

  async deleteOperationMachinesByOperation(operationId: number): Promise<void> {
    await db.delete(operationMachines).where(eq(operationMachines.operationId, operationId));
  }

  async getWorkOrders(): Promise<WorkOrder[]> {
    return db.select().from(workOrders).orderBy(desc(workOrders.id));
  }

  async getWorkOrdersPaginated(opts: { page: number; pageSize: number; search?: string; status?: string; startDate?: string; endDate?: string }): Promise<{ data: WorkOrder[]; total: number; stats: { active: number; pending: number; completed: number } }> {
    const { page, pageSize, search, status, startDate, endDate } = opts;
    const conditions: ReturnType<typeof eq>[] = [];
    if (search) {
      conditions.push(or(ilike(workOrders.orderNumber, `%${search}%`), ilike(workOrders.productName, `%${search}%`)) as any);
    }
    if (status && status !== "all") {
      conditions.push(eq(workOrders.status, status as any));
    }
    if (startDate) {
      conditions.push(gte(workOrders.createdAt, new Date(startDate)) as any);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(workOrders.createdAt, end) as any);
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (page - 1) * pageSize;
    const [data, totalResult, allStatuses] = await Promise.all([
      db.select().from(workOrders).where(where).orderBy(desc(workOrders.createdAt)).limit(pageSize).offset(offset),
      db.select({ cnt: count() }).from(workOrders).where(where),
      db.select({ status: workOrders.status, cnt: count() }).from(workOrders).groupBy(workOrders.status),
    ]);
    const total = Number(totalResult[0]?.cnt ?? 0);
    const statsMap: Record<string, number> = {};
    for (const row of allStatuses) statsMap[row.status] = Number(row.cnt);
    return {
      data,
      total,
      stats: {
        active: statsMap["in_progress"] ?? 0,
        pending: statsMap["pending"] ?? 0,
        completed: statsMap["completed"] ?? 0,
      },
    };
  }

  async getWorkOrder(id: number): Promise<WorkOrder | undefined> {
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id));
    return wo;
  }

  async createWorkOrder(wo: InsertWorkOrder): Promise<WorkOrder> {
    const [created] = await db.insert(workOrders).values(wo).returning();
    return created;
  }

  async updateWorkOrder(id: number, data: Partial<WorkOrder>): Promise<WorkOrder> {
    const [updated] = await db.update(workOrders).set(data).where(eq(workOrders.id, id)).returning();
    return updated;
  }

  async deleteWorkOrder(id: number): Promise<void> {
    await db.delete(workOrders).where(eq(workOrders.id, id));
  }

  async getWorkOrderLines(): Promise<WorkOrderLine[]> {
    return db.select().from(workOrderLines);
  }

  async getWorkOrderLinesByWorkOrder(workOrderId: number): Promise<WorkOrderLine[]> {
    return db.select().from(workOrderLines).where(eq(workOrderLines.workOrderId, workOrderId));
  }

  async getWorkOrderLine(id: number): Promise<WorkOrderLine | undefined> {
    const [line] = await db.select().from(workOrderLines).where(eq(workOrderLines.id, id));
    return line;
  }

  async createWorkOrderLine(line: InsertWorkOrderLine): Promise<WorkOrderLine> {
    const [created] = await db.insert(workOrderLines).values(line).returning();
    return created;
  }

  async updateWorkOrderLine(id: number, data: Partial<WorkOrderLine>): Promise<WorkOrderLine> {
    const [updated] = await db.update(workOrderLines).set(data).where(eq(workOrderLines.id, id)).returning();
    return updated;
  }

  async deleteWorkOrderLine(id: number): Promise<void> {
    await db.delete(workOrderLines).where(eq(workOrderLines.id, id));
  }

  async getProductRoutings(): Promise<ProductRouting[]> {
    return db.select().from(productRoutings).orderBy(asc(productRoutings.sequenceNumber));
  }

  async getProductRoutingsByProduct(productCode: string): Promise<ProductRouting[]> {
    return db.select().from(productRoutings)
      .where(eq(productRoutings.productCode, productCode))
      .orderBy(asc(productRoutings.sequenceNumber));
  }

  async createProductRouting(routing: InsertProductRouting): Promise<ProductRouting> {
    const [created] = await db.insert(productRoutings).values(routing).returning();
    return created;
  }

  async updateProductRouting(id: number, data: Partial<ProductRouting>): Promise<ProductRouting> {
    const [updated] = await db.update(productRoutings).set(data).where(eq(productRoutings.id, id)).returning();
    return updated;
  }

  async deleteProductRouting(id: number): Promise<void> {
    await db.delete(productRoutings).where(eq(productRoutings.id, id));
  }

  async getWorkOrderAttachments(workOrderId: number): Promise<WorkOrderAttachment[]> {
    return db.select().from(workOrderAttachments).where(eq(workOrderAttachments.workOrderId, workOrderId));
  }

  async createWorkOrderAttachment(attachment: InsertWorkOrderAttachment): Promise<WorkOrderAttachment> {
    const [created] = await db.insert(workOrderAttachments).values(attachment).returning();
    return created;
  }

  async deleteWorkOrderAttachment(id: number): Promise<void> {
    await db.delete(workOrderAttachments).where(eq(workOrderAttachments.id, id));
  }

  async getOperatorAssignments(): Promise<OperatorAssignment[]> {
    return db.select().from(operatorAssignments);
  }

  async getOperatorAssignmentsByMachine(machineId: number): Promise<OperatorAssignment[]> {
    return db.select().from(operatorAssignments).where(eq(operatorAssignments.machineId, machineId));
  }

  async createOperatorAssignment(assignment: InsertOperatorAssignment): Promise<OperatorAssignment> {
    const [created] = await db.insert(operatorAssignments).values(assignment).returning();
    return created;
  }

  async deleteOperatorAssignment(id: number): Promise<void> {
    await db.delete(operatorAssignments).where(eq(operatorAssignments.id, id));
  }

  async getRecurringExpenses(): Promise<RecurringExpense[]> {
    return db.select().from(recurringExpenses);
  }

  async getRecurringExpense(id: number): Promise<RecurringExpense | undefined> {
    const [expense] = await db.select().from(recurringExpenses).where(eq(recurringExpenses.id, id));
    return expense;
  }

  async createRecurringExpense(expense: InsertRecurringExpense): Promise<RecurringExpense> {
    const [created] = await db.insert(recurringExpenses).values(expense).returning();
    return created;
  }

  async updateRecurringExpense(id: number, data: Partial<RecurringExpense>): Promise<RecurringExpense> {
    const [updated] = await db.update(recurringExpenses).set(data).where(eq(recurringExpenses.id, id)).returning();
    return updated;
  }

  async deleteRecurringExpense(id: number): Promise<void> {
    await db.delete(monthlyExpenses).where(eq(monthlyExpenses.recurringId, id));
    await db.delete(recurringExpenses).where(eq(recurringExpenses.id, id));
  }

  async getMonthlyExpenses(): Promise<MonthlyExpense[]> {
    return db.select().from(monthlyExpenses);
  }

  async getMonthlyExpensesByMonth(monthYear: string): Promise<MonthlyExpense[]> {
    return db.select().from(monthlyExpenses).where(eq(monthlyExpenses.monthYear, monthYear));
  }

  async createMonthlyExpense(expense: InsertMonthlyExpense): Promise<MonthlyExpense> {
    const [created] = await db.insert(monthlyExpenses).values(expense).returning();
    return created;
  }

  async updateMonthlyExpense(id: number, data: Partial<MonthlyExpense>): Promise<MonthlyExpense> {
    const [updated] = await db.update(monthlyExpenses).set(data).where(eq(monthlyExpenses.id, id)).returning();
    return updated;
  }

  async deleteMonthlyExpense(id: number): Promise<void> {
    await db.delete(monthlyExpenses).where(eq(monthlyExpenses.id, id));
  }

  async getStopReasons(): Promise<StopReason[]> {
    return db.select().from(stopReasons);
  }

  async createStopReason(sr: InsertStopReason): Promise<StopReason> {
    const [created] = await db.insert(stopReasons).values(sr).returning();
    return created;
  }

  async updateStopReason(id: number, data: Partial<StopReason>): Promise<StopReason> {
    const [updated] = await db.update(stopReasons).set(data).where(eq(stopReasons.id, id)).returning();
    return updated;
  }

  async deleteStopReason(id: number): Promise<void> {
    await db.delete(stopReasons).where(eq(stopReasons.id, id));
  }

  async getProductionLogs(): Promise<ProductionLog[]> {
    return db.select().from(productionLogs);
  }

  async getProductionLog(id: number): Promise<ProductionLog | undefined> {
    const [log] = await db.select().from(productionLogs).where(eq(productionLogs.id, id));
    return log;
  }

  async getActiveProductionLog(machineId: number): Promise<ProductionLog | undefined> {
    const [log] = await db.select().from(productionLogs).where(
      and(
        eq(productionLogs.machineId, machineId),
        isNull(productionLogs.endTime)
      )
    );
    return log;
  }

  async getActiveProductionLogByUser(userId: number): Promise<ProductionLog | undefined> {
    const [log] = await db.select().from(productionLogs).where(
      and(
        eq(productionLogs.userId, userId),
        isNull(productionLogs.endTime)
      )
    );
    return log;
  }

  async createProductionLog(log: InsertProductionLog): Promise<ProductionLog> {
    const [created] = await db.insert(productionLogs).values(log).returning();
    return created;
  }

  async updateProductionLog(id: number, data: Partial<ProductionLog>): Promise<ProductionLog> {
    const [updated] = await db.update(productionLogs).set(data).where(eq(productionLogs.id, id)).returning();
    return updated;
  }

  async createProductionAuditLog(data: { userId: number; workOrderId?: number; workOrderLineId?: number; productionLogId?: number; action: string; attemptedQuantity?: number; maxAllowed?: number; errorMessage?: string }): Promise<void> {
    await db.insert(productionAuditLogs).values(data);
  }

  async getStopLogs(productionLogId: number): Promise<StopLog[]> {
    return db.select().from(stopLogs).where(eq(stopLogs.productionLogId, productionLogId));
  }

  async getAllStopLogs(): Promise<StopLog[]> {
    return db.select().from(stopLogs);
  }

  async getActiveStopLog(productionLogId: number): Promise<StopLog | undefined> {
    const [log] = await db.select().from(stopLogs).where(
      and(
        eq(stopLogs.productionLogId, productionLogId),
        isNull(stopLogs.endTime)
      )
    );
    return log;
  }

  async createStopLog(log: InsertStopLog): Promise<StopLog> {
    const [created] = await db.insert(stopLogs).values(log).returning();
    return created;
  }

  async updateStopLog(id: number, data: Partial<StopLog>): Promise<StopLog> {
    const [updated] = await db.update(stopLogs).set(data).where(eq(stopLogs.id, id)).returning();
    return updated;
  }

  async getExpenses(): Promise<Expense[]> {
    return db.select().from(expenses);
  }

  async createExpense(expense: InsertExpense): Promise<Expense> {
    const [created] = await db.insert(expenses).values(expense).returning();
    return created;
  }

  async updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
    const [updated] = await db.update(expenses).set(data).where(eq(expenses.id, id)).returning();
    return updated;
  }

  async deleteExpense(id: number): Promise<void> {
    await db.delete(expenses).where(eq(expenses.id, id));
  }

  async getChatMessagesByMachine(machineId: number): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.machineId, machineId)).orderBy(asc(chatMessages.createdAt));
  }

  async createChatMessage(msg: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(msg).returning();
    return created;
  }

  async getAllChatMessages(): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).orderBy(asc(chatMessages.createdAt));
  }

  async getReadStatus(machineId: number, userId: number): Promise<Date | null> {
    const [row] = await db.select().from(chatReadStatus)
      .where(and(eq(chatReadStatus.machineId, machineId), eq(chatReadStatus.userId, userId)));
    return row?.lastReadAt || null;
  }

  async markAsRead(machineId: number, userId: number): Promise<void> {
    const [existing] = await db.select().from(chatReadStatus)
      .where(and(eq(chatReadStatus.machineId, machineId), eq(chatReadStatus.userId, userId)));
    if (existing) {
      await db.update(chatReadStatus).set({ lastReadAt: new Date() })
        .where(eq(chatReadStatus.id, existing.id));
    } else {
      await db.insert(chatReadStatus).values({ machineId, userId, lastReadAt: new Date() });
    }
  }

  async getPagePermissions(): Promise<PagePermission[]> {
    return db.select().from(pagePermissions);
  }

  async setPagePermission(pageId: string, roleName: string, allowed: boolean): Promise<void> {
    const [existing] = await db.select().from(pagePermissions)
      .where(and(eq(pagePermissions.pageId, pageId), eq(pagePermissions.roleName, roleName)));
    if (existing) {
      await db.update(pagePermissions).set({ allowed })
        .where(eq(pagePermissions.id, existing.id));
    } else {
      await db.insert(pagePermissions).values({ pageId, roleName, allowed });
    }
  }

  async getDrawingsByWorkOrder(workOrderId: number): Promise<TechnicalDrawing[]> {
    return db.select().from(technicalDrawings)
      .where(eq(technicalDrawings.workOrderId, workOrderId))
      .orderBy(desc(technicalDrawings.revisionNumber));
  }

  async getCurrentDrawing(workOrderId: number): Promise<TechnicalDrawing | undefined> {
    const [drawing] = await db.select().from(technicalDrawings)
      .where(and(eq(technicalDrawings.workOrderId, workOrderId), eq(technicalDrawings.isCurrent, true)))
      .orderBy(desc(technicalDrawings.revisionNumber))
      .limit(1);
    return drawing;
  }

  async createDrawing(drawing: InsertTechnicalDrawing): Promise<TechnicalDrawing> {
    const [created] = await db.insert(technicalDrawings).values(drawing).returning();
    return created;
  }

  async deactivateOldRevisions(workOrderId: number, workOrderLineId?: number | null): Promise<void> {
    if (workOrderLineId) {
      await db.update(technicalDrawings)
        .set({ isCurrent: false })
        .where(and(
          eq(technicalDrawings.workOrderId, workOrderId),
          eq(technicalDrawings.workOrderLineId, workOrderLineId)
        ));
    } else {
      await db.update(technicalDrawings)
        .set({ isCurrent: false })
        .where(eq(technicalDrawings.workOrderId, workOrderId));
    }
  }

  async getDrawingAcknowledgments(drawingId: number): Promise<DrawingAcknowledgment[]> {
    return db.select().from(drawingAcknowledgments)
      .where(eq(drawingAcknowledgments.drawingId, drawingId));
  }

  async createDrawingAcknowledgment(ack: InsertDrawingAcknowledgment): Promise<DrawingAcknowledgment> {
    const [created] = await db.insert(drawingAcknowledgments).values(ack).returning();
    return created;
  }

  async getProductDefault(productCode: string): Promise<ProductDefault | undefined> {
    const [result] = await db.select().from(productDefaults)
      .where(eq(productDefaults.productCode, productCode));
    return result;
  }

  async upsertProductDefault(data: InsertProductDefault): Promise<ProductDefault> {
    const existing = await this.getProductDefault(data.productCode);
    if (existing) {
      const [updated] = await db.update(productDefaults)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(productDefaults.productCode, data.productCode))
        .returning();
      return updated;
    }
    const [created] = await db.insert(productDefaults).values(data).returning();
    return created;
  }

  async createCostAuditLog(log: InsertCostAuditLog): Promise<CostAuditLog> {
    const [created] = await db.insert(costAuditLogs).values(log).returning();
    return created;
  }

  async getCostAuditLogs(workOrderId?: number): Promise<CostAuditLog[]> {
    if (workOrderId) {
      return db.select().from(costAuditLogs)
        .where(eq(costAuditLogs.workOrderId, workOrderId))
        .orderBy(desc(costAuditLogs.createdAt));
    }
    return db.select().from(costAuditLogs).orderBy(desc(costAuditLogs.createdAt));
  }

  async getWorkOrderOperations(workOrderId: number): Promise<WorkOrderOperation[]> {
    return db.select().from(workOrderOperations)
      .where(eq(workOrderOperations.workOrderId, workOrderId))
      .orderBy(asc(workOrderOperations.sequenceNumber));
  }

  async getWorkOrderOperation(id: number): Promise<WorkOrderOperation | undefined> {
    const [op] = await db.select().from(workOrderOperations).where(eq(workOrderOperations.id, id));
    return op;
  }

  async createWorkOrderOperation(data: InsertWorkOrderOperation): Promise<WorkOrderOperation> {
    const [created] = await db.insert(workOrderOperations).values(data).returning();
    return created;
  }

  async updateWorkOrderOperation(id: number, data: Partial<WorkOrderOperation>): Promise<WorkOrderOperation> {
    const [updated] = await db.update(workOrderOperations).set(data).where(eq(workOrderOperations.id, id)).returning();
    return updated;
  }

  async deleteWorkOrderOperation(id: number): Promise<void> {
    await db.delete(workOrderOperations).where(eq(workOrderOperations.id, id));
  }

  async deleteWorkOrderOperationsByWorkOrder(workOrderId: number): Promise<void> {
    await db.delete(workOrderOperations).where(eq(workOrderOperations.workOrderId, workOrderId));
  }

  async getWorkOrderOperationSummary(): Promise<Map<number, { total: number; completed: number }>> {
    const all = await db.select().from(workOrderOperations);
    const map = new Map<number, { total: number; completed: number }>();
    for (const op of all) {
      const entry = map.get(op.workOrderId) ?? { total: 0, completed: 0 };
      entry.total++;
      if (op.status === "completed") entry.completed++;
      map.set(op.workOrderId, entry);
    }
    return map;
  }

  async syncWorkOrderRoute(workOrderId: number): Promise<void> {
    const ops = await this.getWorkOrderOperations(workOrderId);
    const routeIds = ops.map((op) => op.operationId);
    await db.update(workOrders).set({ operationRoute: routeIds }).where(eq(workOrders.id, workOrderId));
  }

  async syncAllWorkOrderRoutes(): Promise<void> {
    const all = await db.select().from(workOrderOperations).orderBy(workOrderOperations.workOrderId, workOrderOperations.sequenceNumber);
    const routeMap = new Map<number, number[]>();
    for (const op of all) {
      const arr = routeMap.get(op.workOrderId) ?? [];
      arr.push(op.operationId);
      routeMap.set(op.workOrderId, arr);
    }
    for (const [woId, routeIds] of routeMap.entries()) {
      await db.update(workOrders).set({ operationRoute: routeIds }).where(eq(workOrders.id, woId));
    }
  }

  async getSystemSettings(): Promise<SystemSettings> {
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.id, 1));
    if (!row) {
      const [created] = await db.insert(systemSettings).values({ id: 1, companyName: "LOCKCELL MES" }).returning();
      return created;
    }
    return row;
  }

  async updateSystemSettings(data: UpdateSystemSettings): Promise<SystemSettings> {
    const [updated] = await db
      .update(systemSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(systemSettings.id, 1))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
