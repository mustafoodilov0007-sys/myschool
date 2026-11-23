import type { DashboardDto } from '@pep/shared';
import type { Db, Pool } from '../db/pool';
import { listAudit } from './audit';

export async function getDashboard(db: Db): Promise<DashboardDto> {
  const counts = await db.query<{ classes: number; total: number; active: number; linked: number; now: Date }>(
    `SELECT (SELECT count(*) FROM classes WHERE NOT is_archived)::int AS classes,
            count(*)::int AS total,
            count(*) FILTER (WHERE is_active)::int AS active,
            count(*) FILTER (WHERE is_active AND telegram_id IS NOT NULL)::int AS linked,
            now() AS now
       FROM students`,
  );
  const c = counts.rows[0] as { classes: number; total: number; active: number; linked: number; now: Date };
  const backup = await db.query<{ status: string; finished_at: Date | null }>(
    'SELECT status, finished_at FROM backups ORDER BY started_at DESC LIMIT 1',
  );
  const b = backup.rows[0];
  return {
    classes: c.classes,
    students: { total: c.total, active: c.active, linked: c.linked, unlinked: c.active - c.linked },
    recentAudit: await listAudit(db, 10),
    system: {
      dbOk: true,
      serverTime: c.now.toISOString(),
      lastBackupAt: b?.finished_at?.toISOString() ?? null,
      lastBackupStatus: b?.status ?? null,
    },
  };
}

/** Bot holati va update dedupe. */
export async function getBotState(db: Db, telegramId: number) {
  const r = await db.query<{ step: string; data: Record<string, unknown> }>(
    'SELECT step, data FROM bot_states WHERE telegram_id = $1',
    [telegramId],
  );
  return r.rows[0] ?? null;
}

export async function putBotState(db: Db, telegramId: number, step: string, data: Record<string, unknown>) {
  await db.query(
    `INSERT INTO bot_states (telegram_id, step, data) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (telegram_id) DO UPDATE SET step = EXCLUDED.step, data = EXCLUDED.data, updated_at = now()`,
    [telegramId, step, JSON.stringify(data)],
  );
}

export async function deleteBotState(db: Db, telegramId: number) {
  await db.query('DELETE FROM bot_states WHERE telegram_id = $1', [telegramId]);
}

/** true — update birinchi marta ko'rilyapti (qayta ishlash kerak); false — takroriy. */
export async function claimUpdate(db: Db, updateId: number): Promise<boolean> {
  const r = await db.query('INSERT INTO processed_updates (update_id) VALUES ($1) ON CONFLICT DO NOTHING', [updateId]);
  return (r.rowCount ?? 0) === 1;
}

/** Muddati o'tgan yozuvlarni tozalaydi (soatiga bir marta chaqiriladi). */
export async function housekeeping(pool: Pool): Promise<Record<string, number>> {
  const q = async (sql: string) => (await pool.query(sql)).rowCount ?? 0;
  return {
    sessions: await q(`DELETE FROM sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days'`),
    adminTokens: await q(`DELETE FROM admin_login_tokens WHERE expires_at < now() - interval '1 day'`),
    confirmations: await q(`DELETE FROM registration_confirmations WHERE expires_at < now() - interval '1 day'`),
    updates: await q(`DELETE FROM processed_updates WHERE received_at < now() - interval '3 days'`),
    botStates: await q(`DELETE FROM bot_states WHERE updated_at < now() - interval '7 days'`),
    loginAttempts: await q(`DELETE FROM login_attempts WHERE created_at < now() - interval '30 days'`),
  };
}
