const { createClient } = require('@libsql/client');
const crypto = require('crypto');
const db = createClient({ url: process.env.TURSO_DATABASE_URL || ('file:' + (process.env.RAILWAY_VOLUME_MOUNT_PATH || '/tmp') + '/school.db'), authToken: process.env.TURSO_AUTH_TOKEN });
const SECRET = process.env.SESSION_SECRET || '';
const UF = ['first_name','last_name','middle_name','phone','email','birth_date','gender','hire_date','education','category','bio','photo'];
const ST = ['keldi', 'kelmadi', 'kechikdi', 'uzrli'];
const q = async (sql, args = []) => (await db.execute({ sql, args })).rows.map(r => ({ ...r }));
const one = async (sql, args) => (await q(sql, args))[0];
const run = (sql, args = []) => db.execute({ sql, args });
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19); // UTC; UI shows Asia/Tashkent

const SCHEMA = [
`CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT)`,
`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,login TEXT UNIQUE NOT NULL,name TEXT NOT NULL,pass TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN('admin','director','teacher')),is_active INTEGER NOT NULL DEFAULT 1,created_at TEXT)`,
`CREATE TABLE IF NOT EXISTS teacher_subjects(user_id INTEGER NOT NULL REFERENCES users(id),subject_id INTEGER NOT NULL REFERENCES subjects(id),PRIMARY KEY(user_id,subject_id))`,
`CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY,name TEXT UNIQUE NOT NULL)`,
`CREATE TABLE IF NOT EXISTS classes(id INTEGER PRIMARY KEY,name TEXT NOT NULL,year TEXT NOT NULL,homeroom_id INTEGER REFERENCES users(id),UNIQUE(name,year))`,
`CREATE TABLE IF NOT EXISTS assignments(id INTEGER PRIMARY KEY,class_id INTEGER NOT NULL REFERENCES classes(id),subject_id INTEGER NOT NULL REFERENCES subjects(id),teacher_id INTEGER NOT NULL REFERENCES users(id),UNIQUE(class_id,subject_id))`,
`CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY,code TEXT UNIQUE,name TEXT NOT NULL,class_id INTEGER NOT NULL REFERENCES classes(id),status TEXT NOT NULL DEFAULT 'faol',parent_contact TEXT)`,
`CREATE TABLE IF NOT EXISTS timetable(id INTEGER PRIMARY KEY,class_id INTEGER NOT NULL REFERENCES classes(id),subject_id INTEGER NOT NULL REFERENCES subjects(id),teacher_id INTEGER NOT NULL REFERENCES users(id),weekday INTEGER NOT NULL CHECK(weekday BETWEEN 1 AND 7),start TEXT NOT NULL,end TEXT NOT NULL,room TEXT)`,
`CREATE TABLE IF NOT EXISTS lessons(id INTEGER PRIMARY KEY,class_id INTEGER NOT NULL,subject_id INTEGER NOT NULL,teacher_id INTEGER NOT NULL,date TEXT NOT NULL,topic TEXT,homework TEXT,note TEXT,UNIQUE(class_id,subject_id,date))`,
`CREATE TABLE IF NOT EXISTS grades(id INTEGER PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES students(id),class_id INTEGER NOT NULL,subject_id INTEGER NOT NULL,teacher_id INTEGER NOT NULL,date TEXT NOT NULL,type TEXT NOT NULL,value REAL NOT NULL,max REAL NOT NULL DEFAULT 5,comment TEXT,UNIQUE(student_id,subject_id,date,type))`,
`CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY,student_id INTEGER NOT NULL REFERENCES students(id),class_id INTEGER NOT NULL,subject_id INTEGER NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('keldi','kelmadi','kechikdi','uzrli')),note TEXT,UNIQUE(student_id,subject_id,date))`,
`CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY,user_id INTEGER,action TEXT,entity TEXT,entity_id TEXT,old TEXT,new TEXT,at TEXT)`,
`CREATE INDEX IF NOT EXISTS ix_g ON grades(class_id,subject_id)`,
`CREATE INDEX IF NOT EXISTS ix_a ON attendance(class_id,date)`,
`CREATE INDEX IF NOT EXISTS ix_t ON timetable(weekday,teacher_id)`];

let ready;
const init = () => ready || (ready = (async () => {
  await db.batch(SCHEMA, 'write');
  const have = (await q('PRAGMA table_info(users)')).map(c => c.name); // xavfsiz migratsiya: faqat yetishmaydigan ustunlar qo'shiladi
  for (const c of [...UF, 'experience_years']) if (!have.includes(c)) await run(`ALTER TABLE users ADD COLUMN ${c} ${c === 'experience_years' ? 'INTEGER' : 'TEXT'}`);
  await run(`INSERT OR IGNORE INTO settings VALUES('school_name','Deutsch School MCHJ')`);
  if (!(await one('SELECT id FROM users LIMIT 1')) && process.env.ADMIN_PASSWORD)
    await run('INSERT INTO users(login,name,pass,role,created_at) VALUES(?,?,?,?,?)', [process.env.ADMIN_LOGIN || 'admin', 'Administrator', hash(process.env.ADMIN_PASSWORD), 'admin', now()]);
})());

function hash(p) { const s = crypto.randomBytes(16).toString('hex'); return s + ':' + crypto.scryptSync(p, s, 32).toString('hex'); }
function verify(p, h) { const [s, k] = h.split(':'); const x = crypto.scryptSync(p, s, 32); return crypto.timingSafeEqual(x, Buffer.from(k, 'hex')); }
const sign = d => { const b = Buffer.from(JSON.stringify(d)).toString('base64url'); return b + '.' + crypto.createHmac('sha256', SECRET).update(b).digest('base64url'); };
function unsign(t) {
  const [b, s] = (t || '').split('.'); if (!b || !s) return null;
  const e = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  if (s.length !== e.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(e))) return null;
  const d = JSON.parse(Buffer.from(b, 'base64url').toString()); return d.exp > Date.now() ? d : null;
}
class HttpErr extends Error { constructor(c, m) { super(m); this.c = c; } }
const bad = (m, c = 400) => { throw new HttpErr(c, m); };
const audit = (u, action, entity, id, old, nw) => run('INSERT INTO audit_logs(user_id,action,entity,entity_id,old,new,at) VALUES(?,?,?,?,?,?,?)', [u.id, action, entity, String(id), old ? JSON.stringify(old) : null, nw ? JSON.stringify(nw) : null, now()]);

// ruxsatlar (backend darajasida)
const teaches = async (u, c, s) => u.role === 'admin' || !!(await one('SELECT 1 x FROM assignments WHERE class_id=? AND subject_id=? AND teacher_id=?', [c, s, u.id]));
const homeroom = async (u, c) => u.role === 'admin' || !!(await one('SELECT 1 x FROM classes WHERE id=? AND homeroom_id=?', [c, u.id]));
const canView = async (u, c, s) => u.role !== 'teacher' || (await homeroom(u, c)) || (s ? await teaches(u, c, s) : !!(await one('SELECT 1 x FROM assignments WHERE class_id=? AND teacher_id=?', [c, u.id])));
const need = (u, ...r) => { if (!r.includes(u.role)) bad('Ruxsat yo\'q', 403); };
const hhmm = s => /^([01]\d|2[0-3]):[0-5]\d$/.test(s || '') || bad('Vaqt formati HH:MM bo\'lishi kerak');

async function conflict(b, skip = 0) {
  const base = 'SELECT t.*,c.name cn,u.name un FROM timetable t JOIN classes c ON c.id=t.class_id JOIN users u ON u.id=t.teacher_id WHERE t.weekday=? AND t.start<? AND t.end>? AND t.id!=?';
  for (const r of await q(base, [b.weekday, b.end, b.start, skip])) {
    if (r.teacher_id == b.teacher_id) bad(`To'qnashuv: ${r.un} ${r.start}–${r.end} da ${r.cn} sinfida darsi bor`, 409);
    if (r.class_id == b.class_id) bad(`To'qnashuv: ${r.cn} sinfida ${r.start}–${r.end} da boshqa dars bor`, 409);
    if (b.room && r.room && r.room === b.room) bad(`To'qnashuv: ${b.room}-xona ${r.start}–${r.end} da band`, 409);
  }
}
const needStudent = async (id, c) => { const s = await one('SELECT * FROM students WHERE id=?', [id]); if (!s || s.class_id != c) bad('O\'quvchi bu sinfga tegishli emas'); if (s.status !== 'faol') bad('O\'quvchi arxivlangan'); return s; };

const routes = [];
const r = (m, p, f) => routes.push([m, new RegExp('^' + p + '$'), f]);

r('GET', '/public', async () => { const s = Object.fromEntries((await q('SELECT key,value FROM settings')).map(x => [x.key, x.value])); return { school_name: s.school_name, logo: s.logo || null, brand: s.brand || null }; });
r('POST', '/login', async ({ b }) => {
  if (!SECRET) bad('Server sozlanmagan', 500);
  const u = await one('SELECT * FROM users WHERE login=?', [String(b.login || '')]);
  if (!u || !u.is_active || !verify(String(b.password || ''), u.pass)) bad('Login yoki parol noto\'g\'ri', 401);
  return { body: { id: u.id, name: u.name, role: u.role }, cookie: sign({ id: u.id, exp: Date.now() + 12 * 3600e3 }) };
});
r('POST', '/logout', async () => ({ cookie: '' }));
r('GET', '/me', async ({ u }) => u);
r('PUT', '/settings', async ({ u, b }) => {
  need(u, 'admin'); const set = (k, v) => run('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, v]);
  if (b.school_name !== undefined) { const n = String(b.school_name).trim().slice(0, 100); if (n.length < 2) bad('Maktab nomi juda qisqa'); await set('school_name', n); }
  if (b.brand !== undefined && b.brand && !/^#[0-9a-fA-F]{6}$/.test(b.brand)) bad("Rang #RRGGBB formatida bo'lsin");
  if (b.logo && (String(b.logo).length > 300000 || !/^data:image\/(png|jpeg|webp);base64,/.test(b.logo))) bad("Logo PNG/JPG/WEBP va 300 KB dan kichik bo'lsin");
  if (b.brand !== undefined) await set('brand', b.brand || '');
  if (b.logo !== undefined) await set('logo', b.logo || '');
  await audit(u, 'update', 'settings', '-', null, { keys: Object.keys(b) }); return { ok: 1 };
});

const ROLES = ['admin', 'director', 'teacher'];
function profile(b, full) {
  const o = {};
  if (b.photo && String(b.photo).length > 300000) bad("Rasm juda katta");
  for (const k of UF) if (b[k] !== undefined) o[k] = String(b[k] ?? '').trim().slice(0, k === 'photo' ? 300000 : 500) || null;
  if (b.experience_years !== undefined) {
    if (b.experience_years === '' || b.experience_years === null) o.experience_years = null;
    else { const n = +b.experience_years; if (!(n >= 0 && n <= 60)) bad("Staj 0–60 yil oralig'ida bo'lishi kerak"); o.experience_years = Math.round(n); }
  }
  if ((full || 'first_name' in o) && (!o.first_name || o.first_name.length < 2)) bad("Ism kamida 2 harfdan iborat bo'lsin");
  if ((full || 'last_name' in o) && (!o.last_name || o.last_name.length < 2)) bad("Familiya kamida 2 harfdan iborat bo'lsin");
  if (o.phone && !/^\+?[0-9 ()-]{7,20}$/.test(o.phone)) bad("Telefon raqami noto'g'ri");
  if (o.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(o.email)) bad("Email noto'g'ri");
  for (const d of ['birth_date', 'hire_date']) if (o[d] && !/^\d{4}-\d{2}-\d{2}$/.test(o[d])) bad("Sana formati noto'g'ri");
  if (o.gender && !['erkak', 'ayol'].includes(o.gender)) bad("Jins noto'g'ri");
  if (o.photo && !/^data:image\/(jpeg|png|webp);base64,/.test(o.photo)) bad("Rasm formati noto'g'ri");
  return o;
}
async function subjIds(ids) {
  const c = [...new Set((Array.isArray(ids) ? ids : []).map(Number))];
  for (const x of c) if (!(await one('SELECT 1 x FROM subjects WHERE id=?', [x]))) bad('Fan topilmadi');
  return c;
}
const writeSubj = (uid, c) => db.batch([{ sql: 'DELETE FROM teacher_subjects WHERE user_id=?', args: [uid] }, ...c.map(x => ({ sql: 'INSERT INTO teacher_subjects VALUES(?,?)', args: [uid, x] }))], 'write');
const USEL = 'SELECT id,login,name,first_name,last_name,middle_name,phone,email,birth_date,gender,hire_date,experience_years,education,category,bio,photo,role,is_active FROM users';

r('GET', '/users', async ({ u }) => {
  need(u, 'admin', 'director');
  const us = await q(USEL + ' ORDER BY name');
  const ts = await q('SELECT ts.user_id,s.id sid,s.name FROM teacher_subjects ts JOIN subjects s ON s.id=ts.subject_id');
  us.forEach(x => { x.subjects = ts.filter(t => t.user_id == x.id).map(t => ({ id: t.sid, name: t.name })); });
  return us;
});
r('POST', '/users', async ({ u, b }) => {
  need(u, 'admin'); const o = profile(b, true);
  if (!/^[a-z0-9._-]{3,30}$/i.test(b.login || '')) bad("Login 3–30 ta lotin harf, raqam yoki . _ - belgilaridan iborat bo'lsin");
  if (String(b.password || '').length < 8) bad("Parol kamida 8 belgi bo'lsin");
  if (!ROLES.includes(b.role)) bad("Noto'g'ri rol");
  if (await one('SELECT 1 x FROM users WHERE login=?', [b.login])) bad('Bu login band', 409);
  const sids = await subjIds(b.subject_ids);
  const name = [o.last_name, o.first_name, o.middle_name].filter(Boolean).join(' ');
  const x = await run(`INSERT INTO users(login,name,pass,role,created_at,experience_years,${UF.join(',')}) VALUES(?,?,?,?,?,?,${UF.map(() => '?').join(',')})`,
    [b.login, name, hash(b.password), b.role, now(), o.experience_years ?? null, ...UF.map(k => o[k] ?? null)]);
  const id = Number(x.lastInsertRowid); await writeSubj(id, sids);
  await audit(u, 'create', 'user', id, null, { login: b.login, role: b.role, subjects: sids }); return { id };
});
r('PATCH', '/users/(\\d+)', async ({ u, b, m }) => {
  need(u, 'admin'); const id = +m[1]; const old = await one('SELECT * FROM users WHERE id=?', [id]); if (!old) bad('Topilmadi', 404);
  if (id === u.id && b.is_active === 0) bad("O'zingizni faolsizlantira olmaysiz");
  if (b.role && !ROLES.includes(b.role)) bad("Noto'g'ri rol");
  if (b.password && String(b.password).length < 8) bad("Parol kamida 8 belgi bo'lsin");
  const o = profile(b, false), sids = b.subject_ids !== undefined ? await subjIds(b.subject_ids) : null;
  const n = { ...old, ...o }; n.name = [n.last_name, n.first_name, n.middle_name].filter(Boolean).join(' ') || old.name;
  await run(`UPDATE users SET name=?,role=?,is_active=?,pass=?,experience_years=?,${UF.map(k => k + '=?').join(',')} WHERE id=?`,
    [n.name, b.role ?? old.role, b.is_active ?? old.is_active, b.password ? hash(b.password) : old.pass, n.experience_years ?? null, ...UF.map(k => n[k] ?? null), id]);
  if (sids) await writeSubj(id, sids);
  await audit(u, 'update', 'user', id, { role: old.role, is_active: old.is_active }, { role: b.role, is_active: b.is_active, fields: Object.keys(o).filter(k => k !== 'photo'), subjects: sids }); return { ok: 1 };
});

r('GET', '/subjects', async () => q('SELECT * FROM subjects ORDER BY name'));
r('POST', '/subjects', async ({ u, b }) => { need(u, 'admin'); if (!b.name) bad('Fan nomi kerak'); await run('INSERT OR IGNORE INTO subjects(name) VALUES(?)', [b.name.trim()]); return { ok: 1 }; });
r('GET', '/classes', async ({ u }) => q(u.role === 'teacher'
  ? 'SELECT DISTINCT c.*,(SELECT name FROM users WHERE id=c.homeroom_id) homeroom FROM classes c LEFT JOIN assignments a ON a.class_id=c.id WHERE c.homeroom_id=? OR a.teacher_id=? ORDER BY c.name'
  : 'SELECT c.*,(SELECT name FROM users WHERE id=c.homeroom_id) homeroom FROM classes c ORDER BY c.name', u.role === 'teacher' ? [u.id, u.id] : []));
r('POST', '/classes', async ({ u, b }) => {
  need(u, 'admin'); if (!b.name || !b.year) bad('Sinf nomi va o\'quv yili kerak');
  try { const x = await run('INSERT INTO classes(name,year,homeroom_id) VALUES(?,?,?)', [b.name.trim(), b.year.trim(), b.homeroom_id || null]); await audit(u, 'create', 'class', x.lastInsertRowid, null, b); return { id: Number(x.lastInsertRowid) }; }
  catch { bad('Bu sinf shu yilda mavjud', 409); }
});
r('GET', '/assignments', async ({ u }) => { const rows = await q('SELECT a.*,s.name subject,u.name teacher,c.name class FROM assignments a JOIN subjects s ON s.id=subject_id JOIN users u ON u.id=teacher_id JOIN classes c ON c.id=class_id'); return u.role === 'teacher' ? rows.filter(x => x.teacher_id === u.id) : rows; });
r('POST', '/assignments', async ({ u, b }) => { need(u, 'admin'); await run('INSERT INTO assignments(class_id,subject_id,teacher_id) VALUES(?,?,?) ON CONFLICT(class_id,subject_id) DO UPDATE SET teacher_id=excluded.teacher_id', [b.class_id, b.subject_id, b.teacher_id]); await audit(u, 'assign', 'assignment', `${b.class_id}-${b.subject_id}`, null, b); return { ok: 1 }; });

r('GET', '/students', async ({ u, qs }) => { const c = +qs.class_id; if (!c) bad('class_id kerak'); if (!(await canView(u, c))) bad('Ruxsat yo\'q', 403); return q('SELECT * FROM students WHERE class_id=? ORDER BY status,name', [c]); });
r('POST', '/students', async ({ u, b }) => {
  const c = +b.class_id; if (!(await homeroom(u, c))) bad('Ruxsat yo\'q', 403);
  const rows = Array.isArray(b.rows) ? b.rows : []; let added = 0; const skipped = [];
  for (const [i, x] of rows.entries()) {
    const name = String(x.name || '').trim(), code = String(x.code || '').trim() || null;
    if (name.length < 3) { skipped.push(`${i + 1}-qator: ism noto'g'ri`); continue; }
    if (code && await one('SELECT 1 x FROM students WHERE code=?', [code])) { skipped.push(`${i + 1}-qator: kod takror (${code})`); continue; }
    if (await one('SELECT 1 x FROM students WHERE class_id=? AND lower(name)=lower(?)', [c, name])) { skipped.push(`${i + 1}-qator: takror (${name})`); continue; }
    await run('INSERT INTO students(code,name,class_id,parent_contact) VALUES(?,?,?,?)', [code, name, c, x.parent_contact || null]); added++;
  }
  await audit(u, 'import', 'student', c, null, { added }); return { added, skipped };
});
r('PATCH', '/students/(\\d+)', async ({ u, b, m }) => {
  const s = await one('SELECT * FROM students WHERE id=?', [+m[1]]); if (!s) bad('Topilmadi', 404);
  if (!(await homeroom(u, s.class_id)) || (b.class_id && !(await homeroom(u, +b.class_id)))) bad('Ruxsat yo\'q', 403);
  await run('UPDATE students SET name=?,class_id=?,status=? WHERE id=?', [b.name ?? s.name, b.class_id ?? s.class_id, b.status ?? s.status, s.id]);
  await audit(u, 'update', 'student', s.id, { class_id: s.class_id, status: s.status }, b); return { ok: 1 };
});

r('GET', '/timetable', async ({ u, qs }) => {
  const w = [], a = [];
  if (qs.class_id) { w.push('t.class_id=?'); a.push(+qs.class_id); }
  if (qs.teacher_id) { w.push('t.teacher_id=?'); a.push(+qs.teacher_id); }
  if (qs.weekday) { w.push('t.weekday=?'); a.push(+qs.weekday); }
  return q(`SELECT t.*,c.name class,s.name subject,u.name teacher FROM timetable t JOIN classes c ON c.id=class_id JOIN subjects s ON s.id=subject_id JOIN users u ON u.id=teacher_id ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY weekday,start`, a);
});
const ttSave = async (u, b, id) => {
  need(u, 'admin'); hhmm(b.start); hhmm(b.end); if (b.start >= b.end) bad('Tugash vaqti boshlanishdan keyin bo\'lishi kerak');
  await conflict(b, id || 0);
  if (id) { await run('UPDATE timetable SET class_id=?,subject_id=?,teacher_id=?,weekday=?,start=?,end=?,room=? WHERE id=?', [b.class_id, b.subject_id, b.teacher_id, b.weekday, b.start, b.end, b.room || null, id]); return { id }; }
  const x = await run('INSERT INTO timetable(class_id,subject_id,teacher_id,weekday,start,end,room) VALUES(?,?,?,?,?,?,?)', [b.class_id, b.subject_id, b.teacher_id, b.weekday, b.start, b.end, b.room || null]); return { id: Number(x.lastInsertRowid) };
};
r('POST', '/timetable', async ({ u, b }) => ttSave(u, b));
r('PUT', '/timetable/(\\d+)', async ({ u, b, m }) => ttSave(u, b, +m[1]));
r('DELETE', '/timetable/(\\d+)', async ({ u, m }) => { need(u, 'admin'); await run('DELETE FROM timetable WHERE id=?', [+m[1]]); return { ok: 1 }; });

r('GET', '/journal', async ({ u, qs }) => {
  const c = +qs.class_id, s = +qs.subject_id; if (!c || !s) bad('class_id va subject_id kerak');
  if (!(await canView(u, c, s))) bad('Ruxsat yo\'q', 403);
  const p = [c, s];
  return {
    can_edit: await teaches(u, c, s),
    students: await q("SELECT id,name,code FROM students WHERE class_id=? AND status='faol' ORDER BY name", [c]),
    grades: await q('SELECT student_id,date,type,value,max,comment FROM grades WHERE class_id=? AND subject_id=?', p),
    attendance: await q('SELECT student_id,date,status,note FROM attendance WHERE class_id=? AND subject_id=?', p),
    lessons: await q('SELECT date,topic,homework,note FROM lessons WHERE class_id=? AND subject_id=? ORDER BY date DESC LIMIT 30', p)
  };
});
const dateOk = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') || bad('Sana formati YYYY-MM-DD');
r('PUT', '/grades', async ({ u, b }) => {
  const { student_id: sid, class_id: c, subject_id: s, date, type } = b; dateOk(date);
  if (!(await teaches(u, c, s))) bad('Bu sinf/fan uchun ruxsatingiz yo\'q', 403); await needStudent(sid, c);
  const old = await one('SELECT * FROM grades WHERE student_id=? AND subject_id=? AND date=? AND type=?', [sid, s, date, type]);
  if (b.value === null || b.value === '' || b.value === undefined) { // baho o'chirish: nol emas, yozuv yo'q
    if (old) { await run('DELETE FROM grades WHERE id=?', [old.id]); await audit(u, 'delete', 'grade', old.id, old, null); } return { ok: 1 };
  }
  const max = +b.max || 5, v = +b.value; if (!(v >= 0 && v <= max)) bad(`Baho 0 dan ${max} gacha bo'lishi kerak`);
  await run('INSERT INTO grades(student_id,class_id,subject_id,teacher_id,date,type,value,max,comment) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(student_id,subject_id,date,type) DO UPDATE SET value=excluded.value,max=excluded.max,comment=excluded.comment,teacher_id=excluded.teacher_id', [sid, c, s, u.id, date, type, v, max, b.comment || null]);
  await audit(u, old ? 'update' : 'create', 'grade', `${sid}-${s}-${date}-${type}`, old && { value: old.value, max: old.max }, { value: v, max }); return { ok: 1 };
});
r('PUT', '/attendance', async ({ u, b }) => {
  const { student_id: sid, class_id: c, subject_id: s, date } = b; dateOk(date);
  if (!(await teaches(u, c, s))) bad('Ruxsatingiz yo\'q', 403); await needStudent(sid, c);
  const old = await one('SELECT * FROM attendance WHERE student_id=? AND subject_id=? AND date=?', [sid, s, date]);
  if (!b.status) { if (old) { await run('DELETE FROM attendance WHERE id=?', [old.id]); await audit(u, 'delete', 'attendance', old.id, old, null); } return { ok: 1 }; }
  if (!ST.includes(b.status)) bad('Noto\'g\'ri holat');
  await run('INSERT INTO attendance(student_id,class_id,subject_id,date,status,note) VALUES(?,?,?,?,?,?) ON CONFLICT(student_id,subject_id,date) DO UPDATE SET status=excluded.status,note=excluded.note', [sid, c, s, date, b.status, b.note || null]);
  await audit(u, old ? 'update' : 'create', 'attendance', `${sid}-${s}-${date}`, old && { status: old.status }, { status: b.status }); return { ok: 1 };
});
r('PUT', '/lessons', async ({ u, b }) => {
  const { class_id: c, subject_id: s, date } = b; dateOk(date); if (!(await teaches(u, c, s))) bad('Ruxsatingiz yo\'q', 403);
  const old = await one('SELECT * FROM lessons WHERE class_id=? AND subject_id=? AND date=?', [c, s, date]);
  await run('INSERT INTO lessons(class_id,subject_id,teacher_id,date,topic,homework,note) VALUES(?,?,?,?,?,?,?) ON CONFLICT(class_id,subject_id,date) DO UPDATE SET topic=excluded.topic,homework=excluded.homework,note=excluded.note,teacher_id=excluded.teacher_id', [c, s, u.id, date, b.topic || '', b.homework || '', b.note || '']);
  await audit(u, old ? 'update' : 'create', 'lesson', `${c}-${s}-${date}`, old && { topic: old.topic, homework: old.homework }, { topic: b.topic, homework: b.homework }); return { ok: 1 };
});
r('GET', '/reports/class', async ({ u, qs }) => {
  const c = +qs.class_id; if (!(await canView(u, c))) bad('Ruxsat yo\'q', 403);
  const own = u.role === 'teacher' && !(await homeroom(u, c)); // fan o'qituvchisi faqat o'z fanlarini ko'radi
  const sf = own ? 'AND g.subject_id IN(SELECT subject_id FROM assignments WHERE class_id=? AND teacher_id=?)' : '';
  const sa = own ? [c, c, u.id] : [c, c];
  return {
    students: await q("SELECT id,name FROM students WHERE class_id=? AND status='faol' ORDER BY name", [c]),
    grades: await q(`SELECT g.student_id,s.name subject,ROUND(AVG(g.value*100.0/g.max),1) pct,COUNT(*) n FROM grades g JOIN subjects s ON s.id=g.subject_id WHERE g.class_id=? ${sf.replace('g.class_id=?', '')} GROUP BY g.student_id,g.subject_id`, own ? [c, c, u.id] : [c]),
    attendance: own ? [] : await q('SELECT student_id,status,COUNT(*) n FROM attendance WHERE class_id=? GROUP BY student_id,status', [c])
  };
});
r('GET', '/audit', async ({ u }) => { need(u, 'admin'); return q('SELECT a.*,u.name user FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200'); });
r('GET', '/backup', async ({ u }) => {
  need(u, 'admin'); const out = { exported_at: now() };
  for (const t of ['settings', 'users', 'subjects', 'classes', 'assignments', 'students', 'timetable', 'lessons', 'grades', 'attendance', 'audit_logs']) out[t] = await q(`SELECT * FROM ${t}`);
  out.users.forEach(x => delete x.pass); return out;
});

exports.handler = async ev => {
  const H = { 'content-type': 'application/json', 'cache-control': 'no-store' };
  try {
    await init();
    const path = (ev.path || '').replace(/^\/(\.netlify\/functions\/api|api)/, '') || '/';
    const method = ev.httpMethod, hit = routes.find(x => x[0] === method && x[1].test(path));
    if (!hit) bad('Topilmadi', 404);
    let u = null; const open = path === '/login' || path === '/public' || path === '/logout';
    if (!open) {
      const ck = /(?:^|;\s*)sid=([^;]+)/.exec(ev.headers?.cookie || ''); const d = unsign(ck && ck[1]);
      u = d && await one('SELECT id,name,role FROM users WHERE id=? AND is_active=1', [d.id]); if (!u) bad('Kirish talab qilinadi', 401);
    }
    const b = ev.body ? JSON.parse(ev.body) : {};
    const res = await hit[2]({ u, b, qs: ev.queryStringParameters || {}, m: hit[1].exec(path) });
    if (res && 'cookie' in res) {
      const val = res.cookie ? `sid=${res.cookie}; Max-Age=43200` : 'sid=; Max-Age=0';
      return { statusCode: 200, headers: { ...H, 'set-cookie': `${val}; Path=/; HttpOnly; Secure; SameSite=Strict` }, body: JSON.stringify(res.body || { ok: 1 }) };
    }
    return { statusCode: 200, headers: H, body: JSON.stringify(res) };
  } catch (e) {
    if (e instanceof HttpErr) return { statusCode: e.c, headers: H, body: JSON.stringify({ error: e.message }) };
    console.error(e); return { statusCode: 500, headers: H, body: JSON.stringify({ error: 'Server xatosi' }) };
  }
};
