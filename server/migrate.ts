import pg from "pg";

export async function ensureSchema() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE machine_status AS ENUM('running', 'idle', 'stopped', 'broken');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE production_log_status AS ENUM('running', 'paused', 'completed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE user_role AS ENUM('admin', 'operator');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE work_order_status AS ENUM('pending', 'in_progress', 'completed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE work_order_line_status AS ENUM('pending', 'in_progress', 'completed');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        username text NOT NULL UNIQUE,
        password text NOT NULL,
        full_name text NOT NULL,
        role user_role NOT NULL DEFAULT 'operator'
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS machines (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        status machine_status NOT NULL DEFAULT 'idle',
        current_operator_id integer,
        current_stop_reason_id integer,
        status_changed_at timestamp DEFAULT now()
      )
    `);

    await client.query(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS hourly_cost numeric NOT NULL DEFAULT '0'`);
    await client.query(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`);
    await client.query(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS image_url text`);
    await client.query(`ALTER TABLE machines ADD COLUMN IF NOT EXISTS description text`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS operations (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        description text
      )
    `);

    await client.query(`ALTER TABLE operations ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS operation_machines (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        operation_id integer NOT NULL,
        machine_id integer NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        order_number text NOT NULL UNIQUE,
        product_name text NOT NULL,
        target_quantity integer NOT NULL,
        completed_quantity integer NOT NULL DEFAULT 0,
        operation_route integer[] NOT NULL,
        current_operation_index integer NOT NULL DEFAULT 0,
        status work_order_status NOT NULL DEFAULT 'pending',
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS target_price numeric NOT NULL DEFAULT '0'`);
    await client.query(`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS customer_name text`);
    await client.query(`ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS due_date timestamp`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stop_reasons (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        name text NOT NULL,
        code text NOT NULL UNIQUE
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS production_logs (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        work_order_id integer NOT NULL,
        operation_id integer NOT NULL,
        machine_id integer NOT NULL,
        user_id integer NOT NULL,
        start_time timestamp DEFAULT now(),
        end_time timestamp,
        produced_quantity integer NOT NULL DEFAULT 0,
        status production_log_status NOT NULL DEFAULT 'running'
      )
    `);

    await client.query(`ALTER TABLE production_logs ADD COLUMN IF NOT EXISTS work_order_line_id integer`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS stop_logs (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        production_log_id integer NOT NULL,
        stop_reason_id integer NOT NULL,
        start_time timestamp DEFAULT now(),
        end_time timestamp
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        category text NOT NULL,
        amount numeric NOT NULL,
        month integer NOT NULL,
        year integer NOT NULL,
        description text,
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_tl numeric`);
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS exchange_rate numeric`);
    await client.query(`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS amount_eur numeric`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_lines (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        work_order_id integer NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        product_code text NOT NULL,
        product_name text NOT NULL,
        target_quantity integer NOT NULL,
        completed_quantity integer NOT NULL DEFAULT 0,
        target_price_per_unit numeric NOT NULL DEFAULT '0',
        target_total_price numeric NOT NULL DEFAULT '0',
        status work_order_line_status NOT NULL DEFAULT 'pending',
        current_operation text
      )
    `);

    await client.query(`ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS material_cost_per_unit numeric NOT NULL DEFAULT '0'`);
    await client.query(`ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS tool_cost_per_unit numeric NOT NULL DEFAULT '0'`);
    await client.query(`ALTER TABLE work_order_lines ADD COLUMN IF NOT EXISTS cost_currency text NOT NULL DEFAULT 'EUR'`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_routings (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        product_code text NOT NULL,
        operation_code text NOT NULL,
        preferred_machine_id integer REFERENCES machines(id) ON DELETE SET NULL,
        sequence_number integer NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS work_order_attachments (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        work_order_id integer NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        work_order_line_id integer REFERENCES work_order_lines(id) ON DELETE SET NULL,
        file_name text NOT NULL,
        file_url text NOT NULL,
        uploaded_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS operator_assignments (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
        work_order_line_id integer REFERENCES work_order_lines(id) ON DELETE SET NULL,
        assigned_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS recurring_expenses (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        expense_name text NOT NULL,
        monthly_amount numeric NOT NULL,
        months jsonb NOT NULL DEFAULT '["1","2","3","4","5","6","7","8","9","10","11","12"]'::jsonb,
        is_active boolean NOT NULL DEFAULT true
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS monthly_expenses (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        recurring_id integer NOT NULL REFERENCES recurring_expenses(id) ON DELETE CASCADE,
        month_year text NOT NULL,
        amount numeric NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);

    const { rows: lineCount } = await client.query(`SELECT COUNT(*) as cnt FROM work_order_lines`);
    if (parseInt(lineCount[0].cnt) === 0) {
      const { rows: existingOrders } = await client.query(`
        SELECT id, product_name, target_quantity, completed_quantity, target_price, status
        FROM work_orders
      `);
      for (const wo of existingOrders) {
        const statusMap: Record<string, string> = {
          pending: "pending",
          in_progress: "in_progress",
          completed: "completed",
        };
        const lineStatus = statusMap[wo.status] || "pending";
        await client.query(`
          INSERT INTO work_order_lines (work_order_id, product_code, product_name, target_quantity, completed_quantity, target_price_per_unit, target_total_price, status)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::work_order_line_status)
        `, [
          wo.id,
          'PRD-' + wo.id,
          wo.product_name,
          wo.target_quantity,
          wo.completed_quantity,
          wo.target_price,
          wo.target_price,
          lineStatus,
        ]);
      }
      if (existingOrders.length > 0) {
        console.log(`Migrated ${existingOrders.length} work orders into work_order_lines`);
      }
    }

    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role text DEFAULT 'staff'`);

    await client.query(`UPDATE users SET admin_role = 'superadmin' WHERE role = 'admin' AND (admin_role IS NULL OR admin_role = 'staff')`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS page_permissions (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        page_id text NOT NULL,
        role_name text NOT NULL,
        allowed boolean NOT NULL DEFAULT true
      )
    `);

    const { rows: existingPerms } = await client.query(`SELECT COUNT(*) as cnt FROM page_permissions`);
    if (parseInt(existingPerms[0].cnt) === 0) {
      const defaultPerms = [
        { pageId: 'expenses', roleName: 'superadmin', allowed: true },
        { pageId: 'expenses', roleName: 'manager', allowed: false },
        { pageId: 'expenses', roleName: 'staff', allowed: false },
        { pageId: 'profitability', roleName: 'superadmin', allowed: true },
        { pageId: 'profitability', roleName: 'manager', allowed: false },
        { pageId: 'profitability', roleName: 'staff', allowed: false },
        { pageId: 'overview', roleName: 'superadmin', allowed: true },
        { pageId: 'overview', roleName: 'manager', allowed: true },
        { pageId: 'overview', roleName: 'staff', allowed: true },
        { pageId: 'chat', roleName: 'superadmin', allowed: true },
        { pageId: 'chat', roleName: 'manager', allowed: true },
        { pageId: 'chat', roleName: 'staff', allowed: true },
        { pageId: 'machines', roleName: 'superadmin', allowed: true },
        { pageId: 'machines', roleName: 'manager', allowed: true },
        { pageId: 'machines', roleName: 'staff', allowed: true },
        { pageId: 'operations', roleName: 'superadmin', allowed: true },
        { pageId: 'operations', roleName: 'manager', allowed: true },
        { pageId: 'operations', roleName: 'staff', allowed: true },
        { pageId: 'users', roleName: 'superadmin', allowed: true },
        { pageId: 'users', roleName: 'manager', allowed: true },
        { pageId: 'users', roleName: 'staff', allowed: false },
        { pageId: 'assignments', roleName: 'superadmin', allowed: true },
        { pageId: 'assignments', roleName: 'manager', allowed: true },
        { pageId: 'assignments', roleName: 'staff', allowed: true },
        { pageId: 'workorders', roleName: 'superadmin', allowed: true },
        { pageId: 'workorders', roleName: 'manager', allowed: true },
        { pageId: 'workorders', roleName: 'staff', allowed: true },
        { pageId: 'stopreasons', roleName: 'superadmin', allowed: true },
        { pageId: 'stopreasons', roleName: 'manager', allowed: true },
        { pageId: 'stopreasons', roleName: 'staff', allowed: true },
        { pageId: 'reports', roleName: 'superadmin', allowed: true },
        { pageId: 'reports', roleName: 'manager', allowed: true },
        { pageId: 'reports', roleName: 'staff', allowed: true },
        { pageId: 'efficiency', roleName: 'superadmin', allowed: true },
        { pageId: 'efficiency', roleName: 'manager', allowed: true },
        { pageId: 'efficiency', roleName: 'staff', allowed: true },
        { pageId: 'settings', roleName: 'superadmin', allowed: true },
        { pageId: 'settings', roleName: 'manager', allowed: false },
        { pageId: 'settings', roleName: 'staff', allowed: false },
      ];
      for (const p of defaultPerms) {
        await client.query(
          `INSERT INTO page_permissions (page_id, role_name, allowed) VALUES ($1, $2, $3)`,
          [p.pageId, p.roleName, p.allowed]
        );
      }
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS technical_drawings (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        work_order_id integer NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
        work_order_line_id integer REFERENCES work_order_lines(id) ON DELETE SET NULL,
        file_name text NOT NULL,
        file_url text NOT NULL,
        revision_number integer NOT NULL DEFAULT 1,
        revision_date timestamp DEFAULT now(),
        revision_note text,
        uploaded_by integer NOT NULL REFERENCES users(id),
        is_current boolean NOT NULL DEFAULT true
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS drawing_acknowledgments (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        drawing_id integer NOT NULL REFERENCES technical_drawings(id) ON DELETE CASCADE,
        user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        acknowledged_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS product_defaults (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        product_code text NOT NULL UNIQUE,
        product_name text,
        default_unit_price numeric DEFAULT '0',
        default_material_cost_per_unit numeric DEFAULT '0',
        default_tool_cost_per_unit numeric DEFAULT '0',
        default_cost_currency text DEFAULT 'EUR',
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cost_audit_logs (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        work_order_id integer NOT NULL,
        product_code text,
        field text NOT NULL,
        old_value text,
        new_value text,
        scope text NOT NULL,
        user_id integer NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`ALTER TABLE cost_audit_logs ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT ''`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS production_audit_logs (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        user_id integer NOT NULL,
        work_order_id integer,
        work_order_line_id integer,
        production_log_id integer,
        action text NOT NULL,
        attempted_quantity integer,
        max_allowed integer,
        error_message text,
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        key text NOT NULL UNIQUE,
        value text NOT NULL,
        updated_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS license_audit_logs (
        id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        user_id integer,
        server_id text,
        action text NOT NULL,
        license_key text,
        success boolean NOT NULL,
        error_message text,
        ip_address text,
        created_at timestamp DEFAULT now()
      )
    `);

    await client.query(`
      INSERT INTO system_config (key, value)
      VALUES ('installation_date', now()::text)
      ON CONFLICT (key) DO NOTHING
    `);

    await client.query("COMMIT");
    console.log("Database schema verified and synced successfully (v1.9)");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Schema sync error:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
