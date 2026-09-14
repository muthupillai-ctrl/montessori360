import pg, { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger.js';
import { DEFAULT_CURRICULUM } from '../modules/curriculum/curriculum.seed.js';

const { Pool: PgPool } = pg;

let pool: Pool;

export function getPool(): Pool {
  if (!pool) throw new Error('AMS database not connected. Call connectDatabase() first.');
  return pool;
}

export async function connectDatabase(): Promise<void> {
  const url = process.env['AMS_DATABASE_URL'] ?? process.env['DATABASE_URL'];
  if (!url) throw new Error('AMS_DATABASE_URL (or DATABASE_URL) is not configured');

  // Strip sslmode from URL — pg v8 treats sslmode=require as verify-full,
  // which conflicts with rejectUnauthorized:false used for cloud DBs.
  const cleanUrl = url.replace(/[?&]sslmode=[^&]*/g, '').replace(/\?$/, '');

  pool = new PgPool({
    connectionString: cleanUrl,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
    min: 0,
    max: parseInt(process.env['AMS_DATABASE_POOL_MAX'] ?? '10', 10),
    idleTimeoutMillis:    5_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: false,
  });

  pool.on('error', (err: any) => {
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
      logger.warn(`AMS PostgreSQL pool: idle connection dropped (${err.code})`);
    } else {
      logger.error('Unexpected AMS PostgreSQL pool error', err);
    }
  });

  const client = await pool.connect();
  const result = await client.query('SELECT version()');
  client.release();
  logger.info(`✅ AMS PostgreSQL connected: ${result.rows[0].version.split(' ').slice(0, 2).join(' ')}`);
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await getPool().query(sql, params);
  return result.rows as T[];
}

export async function tenantQuery<T = Record<string, unknown>>(
  tenantSchema: string,
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query(`SET search_path TO ${tenantSchema}, public`);
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function provisionTenant(tenantSchema: string): Promise<void> {
  const client: PoolClient = await getPool().connect();
  try {
    const { rows } = await client.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [tenantSchema]
    );
    if (rows.length === 0) {
      logger.info(`Provisioning AMS schema: ${tenantSchema}`);
      await client.query(`CREATE SCHEMA ${tenantSchema}`);
      logger.info(`AMS schema provisioned: ${tenantSchema}`);
    }
    // Always run (IF NOT EXISTS) so new tables are applied to existing schemas
    await client.query(`SET search_path TO ${tenantSchema}, public`);
    await applyTenantTables(client);
    await seedCurriculumIfEmpty(client);
  } finally {
    client.release();
  }
}

async function seedCurriculumIfEmpty(client: PoolClient): Promise<void> {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM curriculum_areas`);
  if (rows[0].count > 0) return;

  for (const area of DEFAULT_CURRICULUM) {
    const areaResult = await client.query(
      `INSERT INTO curriculum_areas (name, description, icon, color, sequence)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [area.name, area.description, area.icon, area.color, area.sequence]
    );
    const areaId = areaResult.rows[0].id;
    for (const act of area.activities) {
      await client.query(
        `INSERT INTO curriculum_activities (area_id, name, level, sequence)
         VALUES ($1, $2, $3, $4)`,
        [areaId, act.name, act.level, act.sequence]
      );
    }
  }
  logger.info('Seeded default Montessori curriculum areas and activities');
}

async function applyTenantTables(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS worksheets (
      id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title        VARCHAR(255) NOT NULL,
      description  TEXT,
      subject      VARCHAR(100),
      grade_level  VARCHAR(50),
      level        VARCHAR(20)  CHECK (level IN ('montessori','primary','high_school')),
      file_url     TEXT,
      content_html TEXT,
      source       VARCHAR(20)  NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','generated')),
      is_published BOOLEAN      NOT NULL DEFAULT false,
      created_by   UUID,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    ALTER TABLE IF EXISTS worksheets
      ADD COLUMN IF NOT EXISTS level VARCHAR(20)
      CHECK (level IN ('montessori','primary','high_school'));

    DROP TABLE IF EXISTS worksheet_assignments;

    CREATE TABLE IF NOT EXISTS assignments (
      id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      content_type  VARCHAR(20)  NOT NULL CHECK (content_type IN ('worksheet','lesson_plan','question_paper','curriculum_area')),
      content_id    UUID         NOT NULL,
      content_title VARCHAR(255) NOT NULL,
      class_id      UUID,
      class_name    VARCHAR(255),
      student_id    UUID,
      student_name  VARCHAR(255),
      due_date      DATE,
      assigned_by   UUID,
      assigned_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT chk_assign_target CHECK (class_id IS NOT NULL OR student_id IS NOT NULL)
    );

    CREATE INDEX IF NOT EXISTS idx_assignments_content ON assignments(content_type, content_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_class   ON assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_due     ON assignments(due_date);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS curriculum_areas (
      id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      name        VARCHAR(100) NOT NULL,
      description TEXT,
      icon        VARCHAR(10)  NOT NULL DEFAULT '📌',
      color       VARCHAR(20)  NOT NULL DEFAULT '#6B7280',
      sequence    INTEGER      NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS curriculum_activities (
      id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      area_id         UUID         NOT NULL REFERENCES curriculum_areas(id) ON DELETE CASCADE,
      name            VARCHAR(255) NOT NULL,
      description     TEXT,
      material_name   VARCHAR(255),
      sequence        INTEGER      NOT NULL DEFAULT 0,
      level           VARCHAR(20)  NOT NULL DEFAULT 'casa'
                      CHECK (level IN ('casa','lower_el','upper_el')),
      prerequisite_id UUID         REFERENCES curriculum_activities(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS child_activity_progress (
      id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id    UUID        NOT NULL,
      activity_id   UUID        NOT NULL REFERENCES curriculum_activities(id) ON DELETE CASCADE,
      status        VARCHAR(20) NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started','introduced','practicing','mastered')),
      notes         TEXT,
      introduced_at TIMESTAMPTZ,
      practiced_at  TIMESTAMPTZ,
      mastered_at   TIMESTAMPTZ,
      updated_by    UUID,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (student_id, activity_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cap_student  ON child_activity_progress(student_id);
    CREATE INDEX IF NOT EXISTS idx_cap_activity ON child_activity_progress(activity_id);
    CREATE INDEX IF NOT EXISTS idx_ca_area      ON curriculum_activities(area_id);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS lesson_plans (
      id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title               VARCHAR(255) NOT NULL,
      subject             VARCHAR(100),
      grade_level         VARCHAR(50),
      topic               VARCHAR(255),
      duration_minutes    INTEGER,
      learning_objectives TEXT,
      content_html        TEXT,
      source              VARCHAR(20)  NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','generated')),
      is_published        BOOLEAN      NOT NULL DEFAULT false,
      created_by          UUID,
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_lp_subject ON lesson_plans(subject);
    CREATE INDEX IF NOT EXISTS idx_lp_created ON lesson_plans(created_at DESC);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS question_papers (
      id                      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
      title                   VARCHAR(255) NOT NULL,
      subject                 VARCHAR(100),
      grade_level             VARCHAR(50),
      topic                   VARCHAR(255),
      total_marks             INTEGER,
      duration_minutes        INTEGER,
      difficulty_distribution VARCHAR(255),
      question_types          TEXT[],
      content_html            TEXT,
      source                  VARCHAR(20)  NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','generated')),
      is_published            BOOLEAN      NOT NULL DEFAULT false,
      created_by              UUID,
      created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
      updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_qp_subject ON question_papers(subject);
    CREATE INDEX IF NOT EXISTS idx_qp_created ON question_papers(created_at DESC);
  `);
}
