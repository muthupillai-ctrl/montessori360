import { PoolClient } from 'pg';
import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  AnnouncementRow, CircularRow, MessageRow, ConversationSummary,
  CreateAnnouncementDto, CreateCircularDto, SendMessageDto,
  AnnouncementFilters, MessageFilters,
} from './communication.types.js';
import type { PaginatedResponse } from '@montessori360/shared';

const CACHE_TTL = 120;

class CommunicationService {

  // ── Announcements ─────────────────────────────────────────────────────────

  async listAnnouncements(schema: string, filters: AnnouncementFilters): Promise<PaginatedResponse<AnnouncementRow>> {
    const { audience, class_id, published, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (audience)             { conditions.push(`a.audience IN ($${i++}, 'all')`);  params.push(audience); }
    if (published === true)   { conditions.push(`a.published_at IS NOT NULL`); }
    if (published === false)  { conditions.push(`a.published_at IS NULL`); }
    if (class_id)             { conditions.push(`($${i++} = ANY(a.class_ids) OR a.audience != 'class')`); params.push(class_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total FROM ${schema}.announcements a ${where}`,
      params
    );

    params.push(limit, offset);
    const rows = await tenantQuery<AnnouncementRow>(
      schema,
      `SELECT a.*,
              NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), '') AS author_name
       FROM   ${schema}.announcements a
       LEFT JOIN ${schema}.staff s ON s.id = a.created_by
       ${where}
       ORDER  BY a.created_at DESC
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    return {
      data: rows,
      meta: { total: parseInt(countRow.total), page, limit, totalPages: Math.ceil(parseInt(countRow.total) / limit) },
    };
  }

  async getAnnouncement(schema: string, id: string): Promise<AnnouncementRow> {
    const [row] = await tenantQuery<AnnouncementRow>(
      schema,
      `SELECT a.*,
              NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), '') AS author_name
       FROM   ${schema}.announcements a
       LEFT JOIN ${schema}.staff s ON s.id = a.created_by
       WHERE  a.id = $1`,
      [id]
    );
    if (!row) throw AppError.notFound('Announcement');
    return row;
  }

  async createAnnouncement(schema: string, dto: CreateAnnouncementDto, createdBy: string): Promise<AnnouncementRow> {
    return tenantTransaction(schema, async (client) => {
      const publishedAt = dto.publish_now ? new Date() : null;
      const { rows } = await client.query(
        `INSERT INTO ${schema}.announcements
           (title, body, audience, class_ids, attachments, published_at, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          dto.title, dto.body, dto.audience,
          dto.class_ids ?? [],
          JSON.stringify(dto.attachments ?? []),
          publishedAt,
          dto.expires_at ?? null,
          createdBy,
        ]
      );
      await cacheDelPattern(`${schema}:announcements:*`);
      return rows[0] as AnnouncementRow;
    });
  }

  async publishAnnouncement(schema: string, id: string): Promise<AnnouncementRow> {
    const [row] = await tenantQuery<AnnouncementRow>(
      schema,
      `UPDATE ${schema}.announcements
       SET published_at = now(), updated_at = now()
       WHERE id = $1 AND published_at IS NULL
       RETURNING *`,
      [id]
    );
    if (!row) throw AppError.badRequest('Announcement not found or already published');
    await cacheDelPattern(`${schema}:announcements:*`);
    return row;
  }

  async deleteAnnouncement(schema: string, id: string): Promise<void> {
    const { rows } = await tenantQuery(
      schema,
      `DELETE FROM ${schema}.announcements WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) throw AppError.notFound('Announcement');
    await cacheDelPattern(`${schema}:announcements:*`);
  }

  // ── Circulars ─────────────────────────────────────────────────────────────

  async listCirculars(schema: string, filters: AnnouncementFilters, userId: string = ''): Promise<PaginatedResponse<CircularRow>> {
    const { audience, class_id, published, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (audience)            { conditions.push(`c.audience IN ($${i++}, 'all')`);  params.push(audience); }
    if (published === true)  { conditions.push(`c.published_at IS NOT NULL`); }
    if (published === false) { conditions.push(`c.published_at IS NULL`); }
    if (class_id)            { conditions.push(`($${i++} = ANY(c.class_ids) OR c.audience != 'class')`); params.push(class_id); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total FROM ${schema}.circulars c ${where}`,
      params
    );

    params.push(limit, offset, userId);
    const rows = await tenantQuery<CircularRow>(
      schema,
      `SELECT c.*,
              NULLIF(TRIM(CONCAT(s.first_name, ' ', s.last_name)), '') AS author_name,
              COUNT(DISTINCT ca.id)::int AS acknowledged_count,
              EXISTS (
                SELECT 1 FROM ${schema}.circular_acknowledgements ua
                WHERE ua.circular_id = c.id AND ua.acknowledged_by = $${i + 2}
              ) AS user_acknowledged,
              (
                CASE c.audience
                  WHEN 'parents' THEN (SELECT COUNT(*) FROM ${schema}.students WHERE is_active = true)
                  WHEN 'staff'   THEN (SELECT COUNT(*) FROM ${schema}.staff   WHERE is_active = true)
                  WHEN 'all'     THEN (SELECT COUNT(*) FROM ${schema}.students WHERE is_active = true)
                                    + (SELECT COUNT(*) FROM ${schema}.staff   WHERE is_active = true)
                  ELSE 0
                END
              )::int AS total_recipients
       FROM   ${schema}.circulars c
       LEFT JOIN ${schema}.staff s ON s.id = c.created_by
       LEFT JOIN ${schema}.circular_acknowledgements ca ON ca.circular_id = c.id
       ${where}
       GROUP  BY c.id, s.first_name, s.last_name
       ORDER  BY c.created_at DESC
       LIMIT  $${i} OFFSET $${i + 1}`,
      params
    );

    return {
      data: rows,
      meta: { total: parseInt(countRow.total), page, limit, totalPages: Math.ceil(parseInt(countRow.total) / limit) },
    };
  }

  async createCircular(schema: string, dto: CreateCircularDto, createdBy: string): Promise<CircularRow> {
    return tenantTransaction(schema, async (client) => {
      const publishedAt = dto.publish_now ? new Date() : null;
      const { rows } = await client.query(
        `INSERT INTO ${schema}.circulars
           (title, body, audience, class_ids, attachments, requires_ack, published_at, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          dto.title, dto.body, dto.audience,
          dto.class_ids ?? [],
          JSON.stringify(dto.attachments ?? []),
          dto.requires_ack ?? true,
          publishedAt,
          dto.expires_at ?? null,
          createdBy,
        ]
      );
      return rows[0] as CircularRow;
    });
  }

  async acknowledgeCircular(schema: string, circularId: string, userId: string, userType: 'staff' | 'parent'): Promise<void> {
    // Verify circular exists and requires ack
    const [circular] = await tenantQuery<CircularRow>(
      schema,
      `SELECT id, requires_ack FROM ${schema}.circulars WHERE id = $1`,
      [circularId]
    );
    if (!circular) throw AppError.notFound('Circular');
    if (!circular.requires_ack) throw AppError.badRequest('This circular does not require acknowledgement');

    await tenantQuery(
      schema,
      `INSERT INTO ${schema}.circular_acknowledgements
         (circular_id, acknowledged_by, acknowledger_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (circular_id, acknowledged_by) DO NOTHING`,
      [circularId, userId, userType]
    );
  }

  async listStaffContacts(schema: string, excludeUserId: string): Promise<any[]> {
    const staff = await tenantQuery<any>(
      schema,
      `SELECT id,
              TRIM(CONCAT(first_name, ' ', last_name)) AS name,
              role,
              email,
              'staff' AS type
       FROM   ${schema}.staff
       WHERE  is_active = true AND id != $1
       ORDER  BY first_name`,
      [excludeUserId]
    );
    return staff;
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async sendMessage(schema: string, dto: SendMessageDto, senderId: string, senderType: 'staff' | 'parent'): Promise<MessageRow> {
    return tenantTransaction(schema, async (client) => {
      // Verify recipient exists
      const table = dto.recipient_type === 'staff' ? 'staff' : 'parent_accounts';
      const { rows: [recipient] } = await client.query(
        `SELECT id FROM ${schema}.${table} WHERE id = $1 AND is_active = true`,
        [dto.recipient_id]
      );
      if (!recipient) throw AppError.notFound('Recipient');

      const { rows } = await client.query(
        `INSERT INTO ${schema}.messages
           (sender_id, sender_type, recipient_id, recipient_type, body, attachments)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          senderId, senderType,
          dto.recipient_id, dto.recipient_type,
          dto.body,
          JSON.stringify(dto.attachments ?? []),
        ]
      );

      await cacheDel(`${schema}:conversations:${senderId}`);
      await cacheDel(`${schema}:conversations:${dto.recipient_id}`);
      return rows[0] as MessageRow;
    });
  }

  async getConversation(
    schema: string,
    userId: string, userType: 'staff' | 'parent',
    partnerId: string, partnerType: 'staff' | 'parent',
    filters: MessageFilters
  ): Promise<PaginatedResponse<MessageRow>> {
    const { page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;

    const [countRow] = await tenantQuery<{ total: string }>(
      schema,
      `SELECT COUNT(*)::text AS total
       FROM ${schema}.messages
       WHERE (sender_id = $1 AND sender_type = $2 AND recipient_id = $3 AND recipient_type = $4)
          OR (sender_id = $3 AND sender_type = $4 AND recipient_id = $1 AND recipient_type = $2)`,
      [userId, userType, partnerId, partnerType]
    );

    const rows = await tenantQuery<MessageRow>(
      schema,
      `SELECT m.*
       FROM   ${schema}.messages m
       WHERE  (m.sender_id = $1 AND m.sender_type = $2 AND m.recipient_id = $3 AND m.recipient_type = $4)
           OR (m.sender_id = $3 AND m.sender_type = $4 AND m.recipient_id = $1 AND m.recipient_type = $2)
       ORDER  BY m.created_at ASC
       LIMIT  $5 OFFSET $6`,
      [userId, userType, partnerId, partnerType, limit, offset]
    );

    // Mark messages to this user as read
    await tenantQuery(
      schema,
      `UPDATE ${schema}.messages
       SET is_read = true, read_at = now()
       WHERE recipient_id = $1 AND recipient_type = $2
         AND sender_id = $3 AND sender_type = $4
         AND is_read = false`,
      [userId, userType, partnerId, partnerType]
    );

    return {
      data: rows,
      meta: { total: parseInt(countRow.total), page, limit, totalPages: Math.ceil(parseInt(countRow.total) / limit) },
    };
  }

  async listConversations(schema: string, userId: string, userType: 'staff' | 'parent'): Promise<ConversationSummary[]> {
    const cacheKey = `${schema}:conversations:${userId}`;
    const cached = await cacheGet<ConversationSummary[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<ConversationSummary>(
      schema,
      `WITH partners AS (
         SELECT DISTINCT
           CASE WHEN sender_id = $1 THEN recipient_id   ELSE sender_id   END AS partner_id,
           CASE WHEN sender_id = $1 THEN recipient_type ELSE sender_type END AS partner_type
         FROM ${schema}.messages
         WHERE sender_id = $1 OR recipient_id = $1
       ),
       last_msgs AS (
         SELECT DISTINCT ON (
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END
         )
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS partner_id,
           body          AS last_message,
           created_at    AS last_message_at
         FROM ${schema}.messages
         WHERE sender_id = $1 OR recipient_id = $1
         ORDER BY
           CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END,
           created_at DESC
       ),
       unread AS (
         SELECT sender_id AS partner_id, COUNT(*)::int AS unread_count
         FROM ${schema}.messages
         WHERE recipient_id = $1 AND is_read = false
         GROUP BY sender_id
       )
       SELECT
         p.partner_id,
         CASE p.partner_type
           WHEN 'staff'  THEN NULLIF(TRIM(CONCAT(st.first_name, ' ', st.last_name)), '')
           WHEN 'parent' THEN NULLIF(TRIM(CONCAT(pa.first_name, ' ', pa.last_name)), '')
         END                                     AS partner_name,
         p.partner_type,
         lm.last_message,
         lm.last_message_at,
         COALESCE(u.unread_count, 0)             AS unread_count
       FROM   partners p
       JOIN   last_msgs lm ON lm.partner_id = p.partner_id
       LEFT JOIN ${schema}.staff st         ON st.id = p.partner_id AND p.partner_type = 'staff'
       LEFT JOIN ${schema}.parent_accounts pa ON pa.id = p.partner_id AND p.partner_type = 'parent'
       LEFT JOIN unread u ON u.partner_id = p.partner_id
       ORDER BY lm.last_message_at DESC`,
      [userId]
    );

    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async getUnreadCount(schema: string, userId: string): Promise<number> {
    const [row] = await tenantQuery<{ count: string }>(
      schema,
      `SELECT COUNT(*)::text AS count FROM ${schema}.messages
       WHERE recipient_id = $1 AND is_read = false`,
      [userId]
    );
    return parseInt(row.count);
  }

  async markAllRead(schema: string, userId: string, partnerId: string): Promise<void> {
    await tenantQuery(
      schema,
      `UPDATE ${schema}.messages
       SET is_read = true, read_at = now()
       WHERE recipient_id = $1 AND sender_id = $2 AND is_read = false`,
      [userId, partnerId]
    );
    await cacheDel(`${schema}:conversations:${userId}`);
  }
}

export const communicationService = new CommunicationService();
