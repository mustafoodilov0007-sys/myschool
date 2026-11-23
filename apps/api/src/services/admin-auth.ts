import type { AdminMeDto } from '@pep/shared';
import type { Config } from '../config';
import type { Db, Pool } from '../db/pool';
import { withTx } from '../db/pool';
import { randomToken, sha256Hex } from '../lib/crypto';
import { forbidden, unauthorized } from '../lib/errors';
import type { Actor } from './audit';
import { writeAudit } from './audit';
import { createSession, touchSession } from './sessions';

/** Admin huquqining YAGONA manbai — serverdagi ADMIN_TELEGRAM_IDS ro'yxati. */
export const isAllowlistedAdmin = (cfg: Config, telegramId: number) => cfg.adminTelegramIds.includes(telegramId);

type AdminRow = { id: string; telegram_id: number; display_name: string | null; is_active: boolean };

async function upsertAdmin(db: Db, telegramId: number, displayName?: string | null): Promise<AdminRow> {
  const r = await db.query<AdminRow>(
    `INSERT INTO admins (telegram_id, display_name) VALUES ($1, $2)
     ON CONFLICT (telegram_id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, admins.display_name)
     RETURNING id, telegram_id, display_name, is_active`,
    [telegramId, displayName ?? null],
  );
  return r.rows[0] as AdminRow;
}

const toMe = (a: AdminRow): AdminMeDto => ({ id: a.id, telegramId: a.telegram_id, displayName: a.display_name });

/**
 * /admin buyrug'i: bir martalik, qisqa muddatli kirish havolasi.
 * Token URL fragmenti (#) da — server loglariga, Referer sarlavhasiga tushmaydi.
 */
export async function createAdminLoginLink(
  pool: Pool,
  cfg: Config,
  telegramId: number,
  displayName?: string | null,
): Promise<{ url: string; expiresAt: Date }> {
  if (!isAllowlistedAdmin(cfg, telegramId)) {
    await writeAudit(pool, { type: 'system' }, {
      action: 'admin.login_link_denied',
      entityType: 'telegram',
      entityId: String(telegramId),
    });
    throw forbidden('Bu buyruq faqat administrator uchun');
  }
  return withTx(pool, async (tx) => {
    const admin = await upsertAdmin(tx, telegramId, displayName);
    if (!admin.is_active) throw forbidden('Administrator hisobi o\'chirilgan');
    // Foydalanilmagan eski havolalar bekor qilinadi — bir vaqtda bitta faol havola
    await tx.query('UPDATE admin_login_tokens SET used_at = now() WHERE admin_id = $1 AND used_at IS NULL', [admin.id]);
    const token = randomToken(32);
    const r = await tx.query<{ expires_at: Date }>(
      `INSERT INTO admin_login_tokens (admin_id, token_hash, expires_at)
       VALUES ($1, $2, now() + ($3::int * interval '1 second')) RETURNING expires_at`,
      [admin.id, sha256Hex(token), cfg.adminLoginTokenTtlSeconds],
    );
    return {
      url: `${cfg.adminWebUrl}/auth/callback#token=${token}`,
      expiresAt: (r.rows[0] as { expires_at: Date }).expires_at,
    };
  });
}

/** Havolani sessiyaga almashtiradi. Atomik "used_at IS NULL" sharti tufayli token faqat bir marta ishlaydi. */
export async function exchangeLoginToken(
  pool: Pool,
  cfg: Config,
  token: string,
  userAgent?: string | null,
): Promise<{ session: { token: string; expiresAt: Date }; admin: AdminMeDto }> {
  return withTx(pool, async (tx) => {
    const used = await tx.query<{ admin_id: string }>(
      `UPDATE admin_login_tokens SET used_at = now()
        WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING admin_id`,
      [sha256Hex(token)],
    );
    const adminId = used.rows[0]?.admin_id;
    if (!adminId) throw unauthorized('Havola yaroqsiz yoki muddati tugagan. Botda /admin ni qayta yuboring');
    const a = await tx.query<AdminRow>('SELECT id, telegram_id, display_name, is_active FROM admins WHERE id = $1', [adminId]);
    const admin = a.rows[0];
    if (!admin || !admin.is_active || !isAllowlistedAdmin(cfg, admin.telegram_id)) throw forbidden();
    const session = await createSession(tx, { subject: 'admin', subjectId: admin.id, ttlHours: cfg.adminSessionTtlHours, userAgent });
    await writeAudit(tx, { type: 'admin', adminId: admin.id, telegramId: admin.telegram_id }, {
      action: 'admin.login',
      entityType: 'admin',
      entityId: admin.id,
    });
    return { session, admin: toMe(admin) };
  });
}

/** Faqat ALLOW_DEV_AUTH=true (lokal ishlab chiqish) — Telegramsiz admin kirishi. Productionda config rad etadi. */
export async function devAdminLogin(pool: Pool, cfg: Config, telegramId: number, userAgent?: string | null) {
  if (!cfg.allowDevAuth || cfg.isProd || !isAllowlistedAdmin(cfg, telegramId)) throw forbidden();
  return withTx(pool, async (tx) => {
    const admin = await upsertAdmin(tx, telegramId);
    if (!admin.is_active) throw forbidden();
    const session = await createSession(tx, { subject: 'admin', subjectId: admin.id, ttlHours: cfg.adminSessionTtlHours, userAgent });
    await writeAudit(tx, { type: 'admin', adminId: admin.id, telegramId }, { action: 'admin.login.dev', entityType: 'admin', entityId: admin.id });
    return { session, admin: toMe(admin) };
  });
}

export interface AdminContext {
  actor: Extract<Actor, { type: 'admin' }>;
  me: AdminMeDto;
  sessionId: string;
}

/** Cookie tokenidan admin kontekstini tiklaydi. Ro'yxatdan chiqarilgan admin sessiyasi darhol yaroqsiz bo'ladi. */
export async function authenticateAdmin(db: Db, cfg: Config, token: string): Promise<AdminContext | null> {
  const r = await db.query<AdminRow & { session_id: string; last_seen_at: Date }>(
    `SELECT se.id AS session_id, se.last_seen_at, a.id, a.telegram_id, a.display_name, a.is_active
       FROM sessions se JOIN admins a ON a.id = se.admin_id
      WHERE se.token_hash = $1 AND se.subject_type = 'admin' AND se.revoked_at IS NULL AND se.expires_at > now()`,
    [sha256Hex(token)],
  );
  const row = r.rows[0];
  if (!row || !row.is_active || !isAllowlistedAdmin(cfg, row.telegram_id)) return null;
  await touchSession(db, row.session_id, row.last_seen_at);
  return {
    actor: { type: 'admin', adminId: row.id, telegramId: row.telegram_id },
    me: toMe(row),
    sessionId: row.session_id,
  };
}
