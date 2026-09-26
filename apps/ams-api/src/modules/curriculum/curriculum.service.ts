import { tenantQuery } from '../../config/database.js';
import { DEFAULT_CURRICULUM } from './curriculum.seed.js';
import type {
  AreaRow, ActivityRow, ProgressRow,
  CreateAreaDto, UpdateAreaDto,
  CreateActivityDto, UpdateActivityDto,
  UpsertProgressDto,
} from './curriculum.types.js';

// ── Areas ──────────────────────────────────────────────────────────────────

export async function listAreas(schema: string): Promise<AreaRow[]> {
  return tenantQuery<AreaRow>(schema, `
    SELECT a.*,
           COUNT(act.id)::int AS activity_count
    FROM   curriculum_areas a
    LEFT JOIN curriculum_activities act ON act.area_id = a.id
    GROUP BY a.id
    ORDER BY a.sequence, a.name
  `);
}

export async function getArea(schema: string, id: string): Promise<AreaRow | null> {
  const rows = await tenantQuery<AreaRow>(schema,
    `SELECT * FROM curriculum_areas WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function createArea(schema: string, dto: CreateAreaDto): Promise<AreaRow> {
  const rows = await tenantQuery<AreaRow>(schema, `
    INSERT INTO curriculum_areas (name, description, icon, color, sequence)
    VALUES ($1, $2, $3, $4, COALESCE($5, (SELECT COALESCE(MAX(sequence),0)+1 FROM curriculum_areas)))
    RETURNING *
  `, [dto.name, dto.description ?? null, dto.icon ?? '📌', dto.color ?? '#6B7280', dto.sequence ?? null]);
  return rows[0];
}

export async function updateArea(schema: string, id: string, dto: UpdateAreaDto): Promise<AreaRow | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (dto.name       !== undefined) { fields.push(`name = $${i++}`);        params.push(dto.name); }
  if (dto.description!== undefined) { fields.push(`description = $${i++}`); params.push(dto.description); }
  if (dto.icon       !== undefined) { fields.push(`icon = $${i++}`);        params.push(dto.icon); }
  if (dto.color      !== undefined) { fields.push(`color = $${i++}`);       params.push(dto.color); }
  if (dto.sequence   !== undefined) { fields.push(`sequence = $${i++}`);    params.push(dto.sequence); }
  if (!fields.length) return getArea(schema, id);
  fields.push(`updated_at = now()`);
  params.push(id);
  const rows = await tenantQuery<AreaRow>(schema,
    `UPDATE curriculum_areas SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, params);
  return rows[0] ?? null;
}

export async function deleteArea(schema: string, id: string): Promise<boolean> {
  const rows = await tenantQuery<{ id: string }>(schema,
    `DELETE FROM curriculum_areas WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

// ── Activities ─────────────────────────────────────────────────────────────

export async function listActivities(schema: string, areaId: string): Promise<ActivityRow[]> {
  return tenantQuery<ActivityRow>(schema, `
    SELECT * FROM curriculum_activities WHERE area_id = $1 ORDER BY sequence, name
  `, [areaId]);
}

export async function createActivity(schema: string, areaId: string, dto: CreateActivityDto): Promise<ActivityRow> {
  const rows = await tenantQuery<ActivityRow>(schema, `
    INSERT INTO curriculum_activities
      (area_id, name, description, material_name, sequence, level, prerequisite_id)
    VALUES (
      $1, $2, $3, $4,
      COALESCE($5, (SELECT COALESCE(MAX(sequence),0)+1 FROM curriculum_activities WHERE area_id = $1)),
      $6, $7
    )
    RETURNING *
  `, [
    areaId, dto.name, dto.description ?? null, dto.material_name ?? null,
    dto.sequence ?? null, dto.level ?? 'casa', dto.prerequisite_id ?? null,
  ]);
  return rows[0];
}

export async function updateActivity(schema: string, id: string, dto: UpdateActivityDto): Promise<ActivityRow | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (dto.name           !== undefined) { fields.push(`name = $${i++}`);            params.push(dto.name); }
  if (dto.description    !== undefined) { fields.push(`description = $${i++}`);     params.push(dto.description); }
  if (dto.material_name  !== undefined) { fields.push(`material_name = $${i++}`);   params.push(dto.material_name); }
  if (dto.sequence       !== undefined) { fields.push(`sequence = $${i++}`);        params.push(dto.sequence); }
  if (dto.level          !== undefined) { fields.push(`level = $${i++}`);           params.push(dto.level); }
  if (dto.prerequisite_id!== undefined) { fields.push(`prerequisite_id = $${i++}`); params.push(dto.prerequisite_id); }
  if (!fields.length) {
    const rows = await tenantQuery<ActivityRow>(schema,
      `SELECT * FROM curriculum_activities WHERE id = $1`, [id]);
    return rows[0] ?? null;
  }
  fields.push(`updated_at = now()`);
  params.push(id);
  const rows = await tenantQuery<ActivityRow>(schema,
    `UPDATE curriculum_activities SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, params);
  return rows[0] ?? null;
}

export async function deleteActivity(schema: string, id: string): Promise<boolean> {
  const rows = await tenantQuery<{ id: string }>(schema,
    `DELETE FROM curriculum_activities WHERE id = $1 RETURNING id`, [id]);
  return rows.length > 0;
}

// ── Progress ───────────────────────────────────────────────────────────────

export async function getStudentProgress(schema: string, studentId: string): Promise<ProgressRow[]> {
  return tenantQuery<ProgressRow>(schema, `
    SELECT
      COALESCE(p.id, gen_random_uuid())          AS id,
      $1::uuid                                   AS student_id,
      a.id                                       AS activity_id,
      a.name                                     AS activity_name,
      a.sequence                                 AS activity_sequence,
      ar.id                                      AS area_id,
      ar.name                                    AS area_name,
      ar.icon                                    AS area_icon,
      ar.color                                   AS area_color,
      ar.sequence                                AS area_sequence,
      COALESCE(p.status, 'not_started')          AS status,
      p.notes,
      p.introduced_at,
      p.practiced_at,
      p.mastered_at,
      p.updated_at
    FROM   curriculum_areas ar
    JOIN   curriculum_activities a  ON a.area_id = ar.id
    LEFT JOIN child_activity_progress p
           ON p.activity_id = a.id AND p.student_id = $1
    ORDER BY ar.sequence, ar.name, a.sequence, a.name
  `, [studentId]);
}

export async function upsertProgress(
  schema: string,
  studentId: string,
  activityId: string,
  dto: UpsertProgressDto,
  updatedBy: string,
): Promise<ProgressRow> {
  const timestampField: Record<string, string> = {
    introduced: 'introduced_at',
    practicing:  'practiced_at',
    mastered:    'mastered_at',
  };
  const tsCol = timestampField[dto.status];
  const tsClause = tsCol
    ? `, ${tsCol} = COALESCE(child_activity_progress.${tsCol}, now())`
    : '';

  const rows = await tenantQuery<ProgressRow>(schema, `
    INSERT INTO child_activity_progress (student_id, activity_id, status, notes, updated_by, updated_at${tsCol ? `, ${tsCol}` : ''})
    VALUES ($1, $2, $3, $4, $5, now()${tsCol ? ', now()' : ''})
    ON CONFLICT (student_id, activity_id) DO UPDATE
      SET status     = EXCLUDED.status,
          notes      = COALESCE(EXCLUDED.notes, child_activity_progress.notes),
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
          ${tsClause}
    RETURNING *
  `, [studentId, activityId, dto.status, dto.notes ?? null, updatedBy]);
  return rows[0];
}

// ── Progress Report ────────────────────────────────────────────────────────

export async function getProgressReport(schema: string, studentId: string): Promise<string> {
  const rows = await getStudentProgress(schema, studentId);

  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) {
    const key = r.area_name ?? 'Other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  }

  const statusLabel: Record<string, string> = {
    not_started: 'Not Started',
    introduced:  'Introduced',
    practicing:  'Practicing',
    mastered:    'Mastered',
  };
  const statusColor: Record<string, string> = {
    not_started: '#9CA3AF',
    introduced:  '#60A5FA',
    practicing:  '#FBBF24',
    mastered:    '#34D399',
  };

  const totalActivities = rows.length;
  const mastered  = rows.filter(r => r.status === 'mastered').length;
  const practicing = rows.filter(r => r.status === 'practicing').length;
  const introduced = rows.filter(r => r.status === 'introduced').length;

  const areaHtml = Object.entries(grouped).map(([areaName, activities]) => {
    const areaInfo = activities[0];
    const areaRows = activities.map(a => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:12px">${a.activity_name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;text-align:center">
          <span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:500;background:${statusColor[a.status]}22;color:${statusColor[a.status]}">
            ${statusLabel[a.status] ?? a.status}
          </span>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6B7280">${a.notes ?? ''}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f3f4f6;font-size:11px;color:#6B7280">${a.mastered_at ? new Date(a.mastered_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : ''}</td>
      </tr>`).join('');

    return `
      <div style="margin-bottom:24px;break-inside:avoid">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:#f9fafb;border-radius:8px 8px 0 0;border:1px solid #e5e7eb;border-bottom:none">
          <span style="font-size:18px">${areaInfo.area_icon}</span>
          <span style="font-weight:600;font-size:13px;color:#1F2937">${areaName}</span>
          <span style="margin-left:auto;font-size:11px;color:#6B7280">
            ${activities.filter(a => a.status === 'mastered').length}/${activities.length} mastered
          </span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;overflow:hidden">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;width:40%">Activity</th>
              <th style="padding:6px 10px;text-align:center;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;width:20%">Status</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;width:25%">Notes</th>
              <th style="padding:6px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#6B7280;width:15%">Mastered On</th>
            </tr>
          </thead>
          <tbody>${areaRows}</tbody>
        </table>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Progress Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1F2937; background: #fff; padding: 32px; }
  @media print {
    body { padding: 16px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>
  <div style="max-width:860px;margin:0 auto">

    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #e5e7eb">
      <div>
        <h1 style="font-size:20px;font-weight:700;color:#111827">Progress Report</h1>
        <div style="font-size:12px;color:#6B7280;margin-top:4px">Generated ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
      </div>
      <button class="no-print" onclick="window.print()" style="padding:8px 18px;background:#7C3AED;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer">
        Print / Save PDF
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      ${[
        { label: 'Total Activities', value: totalActivities, color: '#6B7280' },
        { label: 'Introduced',       value: introduced,      color: '#60A5FA' },
        { label: 'Practicing',       value: practicing,      color: '#FBBF24' },
        { label: 'Mastered',         value: mastered,        color: '#34D399' },
      ].map(s => `
        <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:700;color:${s.color}">${s.value}</div>
          <div style="font-size:11px;color:#6B7280;margin-top:4px">${s.label}</div>
        </div>`).join('')}
    </div>

    ${areaHtml}

  </div>
</body>
</html>`;
}

// ── Seed ───────────────────────────────────────────────────────────────────

export async function seedCurriculum(schema: string): Promise<{ areas: number; activities: number }> {
  const existing = await tenantQuery<{ count: string }>(schema,
    `SELECT COUNT(*)::text AS count FROM curriculum_areas`);
  if (parseInt(existing[0].count, 10) > 0) {
    return { areas: 0, activities: 0 };
  }

  let activityTotal = 0;
  for (const area of DEFAULT_CURRICULUM) {
    const [areaRow] = await tenantQuery<AreaRow>(schema, `
      INSERT INTO curriculum_areas (name, description, icon, color, sequence)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [area.name, area.description, area.icon, area.color, area.sequence]);

    for (const act of area.activities) {
      await tenantQuery(schema, `
        INSERT INTO curriculum_activities (area_id, name, level, sequence)
        VALUES ($1, $2, $3, $4)
      `, [areaRow.id, act.name, act.level, act.sequence]);
      activityTotal++;
    }
  }

  return { areas: DEFAULT_CURRICULUM.length, activities: activityTotal };
}
