/**
 * Notifications (task 8.7).
 *
 * `database-schema.md`: bodies never contain image data or full purchase
 * details that would appear on a lock screen without consent. That is a rule
 * about what is WRITTEN, so it lives with whoever creates a notification — this
 * module only reads and marks read.
 *
 * navigation.md rule 6: a notification tap lands on the reviewable surface,
 * never a raw list. `entity_type` and `entity_id` are what let the client do
 * that, which is why they are returned rather than resolved here.
 */
import type { FastifyInstance } from 'fastify';
import type { Queryable } from '../../db/pool.js';
import { getPool } from '../../db/pool.js';
import { scopedQuery, type UserScope } from '../../db/scope.js';
import { requireAuth, requireScope } from '../../http/auth.js';
import { notFound, ErrorCode } from '../../http/errors.js';

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: Date | null;
  created_at: Date;
};

export class NotificationRepository {
  constructor(private readonly db: Queryable) {}

  async list(scope: UserScope, unreadOnly: boolean): Promise<NotificationRow[]> {
    const { rows } = await scopedQuery<NotificationRow>(
      this.db,
      scope,
      `select id, kind, title, body, entity_type, entity_id, read_at, created_at
         from notifications
        where user_id = $1 ${unreadOnly ? 'and read_at is null' : ''}
        order by created_at desc
        limit 100`,
      [scope.userId],
    );
    return rows;
  }

  async markRead(scope: UserScope, id: string): Promise<NotificationRow | null> {
    const { rows } = await scopedQuery<NotificationRow>(
      this.db,
      scope,
      `update notifications set read_at = coalesce(read_at, now())
        where user_id = $1 and id = $2
        returning id, kind, title, body, entity_type, entity_id, read_at, created_at`,
      [scope.userId, id],
    );
    return rows[0] ?? null;
  }

  /**
   * Create one.
   *
   * `title` and `body` are the caller's, and the caller is responsible for the
   * lock-screen rule — a body naming what someone bought and for how much is
   * exactly what that rule forbids.
   */
  async create(
    scope: UserScope,
    input: {
      kind: string;
      title: string;
      body: string | null;
      entityType: string | null;
      entityId: string | null;
    },
  ): Promise<NotificationRow> {
    const { rows } = await scopedQuery<NotificationRow>(
      this.db,
      scope,
      `insert into notifications (user_id, kind, title, body, entity_type, entity_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id, kind, title, body, entity_type, entity_id, read_at, created_at`,
      [scope.userId, input.kind, input.title, input.body, input.entityType, input.entityId],
    );
    const row = rows[0];
    if (!row) throw new Error('notification insert returned no row');
    return row;
  }
}

const serialize = (n: NotificationRow) => ({
  id: n.id,
  kind: n.kind,
  title: n.title,
  body: n.body,
  entity: n.entity_type && n.entity_id ? { type: n.entity_type, id: n.entity_id } : null,
  read_at: n.read_at?.toISOString() ?? null,
  created_at: n.created_at.toISOString(),
});

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  app.get('/notifications', { onRequest: requireAuth }, async (request) => {
    const query = request.query as Record<string, unknown>;
    const unread = String(query['unread'] ?? '') === 'true';
    const repo = new NotificationRepository(getPool());
    const rows = await repo.list(requireScope(request), unread);
    return { data: rows.map(serialize) };
  });

  app.post('/notifications/:id/read', { onRequest: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    const repo = new NotificationRepository(getPool());
    const row = await repo.markRead(requireScope(request), id);
    // A notification that is not this user's is invisible, not forbidden.
    if (!row) throw notFound(ErrorCode.jobNotFound);
    return serialize(row);
  });
}
