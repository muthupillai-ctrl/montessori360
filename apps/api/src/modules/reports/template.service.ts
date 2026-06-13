import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  ReportTemplateRow, CreateTemplateDto, UpdateTemplateDto,
  SectionConfig,
} from './template.types.js';
import { DEFAULT_SECTIONS, DEFAULT_TEMPLATE } from './template.types.js';

const CACHE_TTL = 600;

class TemplateService {

  // ── List all templates for a school ──────────────────────────────────────
  async list(schema: string): Promise<ReportTemplateRow[]> {
    const cacheKey = `${schema}:report_templates`;
    const cached = await cacheGet<ReportTemplateRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<ReportTemplateRow>(
      schema,
      `SELECT * FROM ${schema}.report_templates WHERE is_active = true ORDER BY is_default DESC, name`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  // ── Get single template ───────────────────────────────────────────────────
  async getById(schema: string, id: string): Promise<ReportTemplateRow> {
    const [row] = await tenantQuery<ReportTemplateRow>(
      schema, `SELECT * FROM ${schema}.report_templates WHERE id = $1`, [id]
    );
    if (!row) throw AppError.notFound('Template');
    return row;
  }

  // ── Get template for a class (falls back to school default) ──────────────
  async getForClass(schema: string, classId: string): Promise<ReportTemplateRow> {
    const cacheKey = `${schema}:class_template:${classId}`;
    const cached = await cacheGet<ReportTemplateRow>(cacheKey);
    if (cached) return cached;

    // Try class-assigned template first
    const [classTemplate] = await tenantQuery<ReportTemplateRow>(
      schema,
      `SELECT t.*
       FROM   ${schema}.report_templates t
       JOIN   ${schema}.classes c ON c.report_template_id = t.id
       WHERE  c.id = $1 AND t.is_active = true`,
      [classId]
    );

    if (classTemplate) {
      await cacheSet(cacheKey, classTemplate, CACHE_TTL);
      return classTemplate;
    }

    // Fall back to school default
    const [defaultTemplate] = await tenantQuery<ReportTemplateRow>(
      schema,
      `SELECT * FROM ${schema}.report_templates WHERE is_default = true AND is_active = true LIMIT 1`
    );

    if (defaultTemplate) {
      await cacheSet(cacheKey, defaultTemplate, CACHE_TTL);
      return defaultTemplate;
    }

    // Return built-in hardcoded default if no template exists yet
    return { ...DEFAULT_TEMPLATE, id: 'builtin', created_by: null, created_at: new Date(), updated_at: new Date() };
  }

  // ── Create template ───────────────────────────────────────────────────────
  async create(schema: string, dto: CreateTemplateDto, createdBy: string): Promise<ReportTemplateRow> {
    return tenantTransaction(schema, async (client) => {
      // If setting as default, unset existing default first
      if (dto.is_default) {
        await client.query(
          `UPDATE ${schema}.report_templates SET is_default = false WHERE is_default = true`
        );
      }

      const sections = this.mergeSections(dto.sections);

      const { rows } = await client.query(
        `INSERT INTO ${schema}.report_templates
           (name, description, logo_url, primary_colour, secondary_colour,
            accent_colour, font, sections, is_default, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          dto.name,
          dto.description ?? null,
          dto.logo_url ?? null,
          dto.primary_colour ?? '#1F3864',
          dto.secondary_colour ?? '#2E5AA8',
          dto.accent_colour ?? '#D6E4F0',
          dto.font ?? 'helvetica',
          JSON.stringify(sections),
          dto.is_default ?? false,
          createdBy,
        ]
      );

      await cacheDel(`${schema}:report_templates`);
      return rows[0] as ReportTemplateRow;
    });
  }

  // ── Update template ───────────────────────────────────────────────────────
  async update(schema: string, id: string, dto: UpdateTemplateDto, updatedBy: string): Promise<ReportTemplateRow> {
    await this.getById(schema, id);

    return tenantTransaction(schema, async (client) => {
      if (dto.is_default) {
        await client.query(
          `UPDATE ${schema}.report_templates SET is_default = false WHERE is_default = true AND id != $1`,
          [id]
        );
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      let i = 1;

      const mapping: Record<string, unknown> = {
        name:             dto.name,
        description:      dto.description,
        logo_url:         dto.logo_url,
        primary_colour:   dto.primary_colour,
        secondary_colour: dto.secondary_colour,
        accent_colour:    dto.accent_colour,
        font:             dto.font,
        is_default:       dto.is_default,
      };

      for (const [col, val] of Object.entries(mapping)) {
        if (val !== undefined) {
          fields.push(`${col} = $${i++}`);
          values.push(val);
        }
      }

      if (dto.sections !== undefined) {
        const merged = this.mergeSections(dto.sections);
        fields.push(`sections = $${i++}`);
        values.push(JSON.stringify(merged));
      }

      if (!fields.length) throw AppError.badRequest('No fields to update');
      fields.push(`updated_at = now()`);
      values.push(id);

      const { rows } = await client.query(
        `UPDATE ${schema}.report_templates SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
      );

      await cacheDel(`${schema}:report_templates`);
      await cacheDel(`${schema}:class_template:*`);
      return rows[0] as ReportTemplateRow;
    });
  }

  // ── Assign template to a class ────────────────────────────────────────────
  async assignToClass(schema: string, classId: string, templateId: string): Promise<void> {
    // Verify template exists
    await this.getById(schema, templateId);

    const [cls] = await tenantQuery(
      schema, `SELECT id FROM ${schema}.classes WHERE id = $1`, [classId]
    );
    if (!cls) throw AppError.notFound('Class');

    await tenantQuery(
      schema,
      `UPDATE ${schema}.classes SET report_template_id = $1, updated_at = now() WHERE id = $2`,
      [templateId, classId]
    );
    await cacheDel(`${schema}:class_template:${classId}`);
  }

  // ── Remove template from class (revert to school default) ─────────────────
  async unassignFromClass(schema: string, classId: string): Promise<void> {
    await tenantQuery(
      schema,
      `UPDATE ${schema}.classes SET report_template_id = NULL, updated_at = now() WHERE id = $1`,
      [classId]
    );
    await cacheDel(`${schema}:class_template:${classId}`);
  }

  // ── Delete (soft) ─────────────────────────────────────────────────────────
  async deactivate(schema: string, id: string): Promise<void> {
    const template = await this.getById(schema, id);
    if (template.is_default) throw AppError.badRequest('Cannot delete the default template. Set another as default first.');

    await tenantQuery(
      schema,
      `UPDATE ${schema}.report_templates SET is_active = false, updated_at = now() WHERE id = $1`,
      [id]
    );
    await cacheDel(`${schema}:report_templates`);
  }

  // ── Private: merge provided sections with defaults ────────────────────────
  private mergeSections(input?: SectionConfig[]): SectionConfig[] {
    if (!input || !input.length) return DEFAULT_SECTIONS;

    // Start from defaults, override with provided values
    const merged = DEFAULT_SECTIONS.map(def => {
      const override = input.find(s => s.key === def.key);
      return override ? { ...def, ...override } : def;
    });

    // Add any new custom sections not in defaults
    input.forEach(s => {
      if (!merged.find(m => m.key === s.key)) merged.push(s);
    });

    return merged.sort((a, b) => a.order - b.order);
  }
}

export const templateService = new TemplateService();
