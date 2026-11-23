import { Link } from 'react-router-dom';
import type { DashboardDto } from '@pep/shared';
import { formatTashkent } from '@pep/shared';
import { api, errMsg } from '../lib/api';
import { Spinner, useAsync } from '../components/ui';
import { Icon } from '../components/icons';
import { CORE_MODULES, EXAM_MODULES } from '../lib/modules';
import type { ModuleDef } from '../lib/modules';

const Stat = ({ label, value }: { label: string; value: number | string }) => (
  <div className="card">
    <div className="text-sm text-mute">{label}</div>
    <div className="text-3xl font-bold">{value}</div>
  </div>
);

const ModuleCard = ({ id, title, items }: { id: string; title: string; items: ModuleDef[] }) => (
  <section className="card" aria-labelledby={id}>
    <h2 id={id} className="mb-2 font-semibold">{title}</h2>
    <div className="grid gap-x-4 md:grid-cols-2">
      {items.map((m) => (
        <Link key={m.to} to={m.to} className="module-row">
          <span className="module-icon"><Icon name={m.icon} size={22} /></span>
          <span><span className="module-title block">{m.title}</span><span className="module-sub">{m.sub}</span></span>
          <span className="chev"><Icon name="chevron" size={18} /></span>
        </Link>
      ))}
    </div>
  </section>
);

interface BackupRow { id: string; status: string; file_name: string | null; size_bytes: string | null; started_at: string; error: string | null; restore_tested_at: string | null }

export function Dashboard() {
  const { data, error, loading } = useAsync(() => api<DashboardDto>('/api/admin/dashboard'), []);
  const backups = useAsync(() => api<{ items: BackupRow[] }>('/api/admin/backups'), []);
  if (loading) return <Spinner />;
  if (error || !data) return <p role="alert" className="text-danger">{errMsg(error)}</p>;
  return (
    <div className="space-y-6">
      <div className="hero"><h1 className="text-2xl font-bold">Physics Exam Pro</h1><small>Maktab fizika imtihon tizimi — boshqaruv paneli</small></div>
      <Link to="/administration" className="admin-cta">
        <span className="module-icon"><Icon name="shield" size={22} /></span>
        <span className="min-w-0 flex-1"><span className="module-title block">Administratsiya</span><span className="module-sub">Sinf, o'quvchi va dars qo'shish — boshqaruv vazifalari ro'yxati</span></span>
        <Icon name="chevron" size={18} />
      </Link>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Faol sinflar" value={data.classes} />
        <Stat label="Faol o'quvchilar" value={data.students.active} />
        <Stat label="Telegramga bog'langan" value={data.students.linked} />
        <Stat label="Hali bog'lanmagan" value={data.students.unlinked} />
      </div>
      <ModuleCard id="h-mod" title="Modullar" items={CORE_MODULES.filter((m) => !m.end)} />
      <ModuleCard id="h-exam" title="Fizika nazorati" items={EXAM_MODULES} />
      <section className="card">
        <h2 className="mb-2 font-semibold">Tizim holati</h2>
        <ul className="space-y-1 text-sm">
          <li>Ma'lumotlar bazasi: {data.system.dbOk ? '✅ ishlayapti' : '❌ xato'}</li>
          <li>Server vaqti: {formatTashkent(data.system.serverTime)} (Toshkent)</li>
          <li>Oxirgi zaxira nusxasi: {data.system.lastBackupAt ? `${formatTashkent(data.system.lastBackupAt)} (${data.system.lastBackupStatus ?? ''})` : 'hali yo\'q — docs/BACKUP.md bo\'yicha zaxira skriptini ishga tushiring'}</li>
        </ul>
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Zaxira nusxalar</h2>
        {!backups.data || backups.data.items.length === 0 ? <p className="text-sm text-mute">Yozuv yo'q. Zaxira skripti ishga tushirilganda shu yerda ko'rinadi (docs/BACKUP.md).</p> : (
          <ul className="divide-y divide-line text-sm">
            {backups.data.items.slice(0, 7).map((b) => (
              <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{b.status === 'ok' ? '✅' : b.status === 'failed' ? '❌' : '⏳'} {b.file_name ?? '—'}{b.size_bytes ? ` · ${(Number(b.size_bytes) / 1048576).toFixed(1)} MB` : ''}{b.error ? ` · ${b.error.slice(0, 80)}` : ''}</span>
                <span className="text-mute">{formatTashkent(b.started_at)}{b.restore_tested_at ? ' · tiklash sinalgan ✔' : ' · tiklash sinalmagan'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="mb-2 font-semibold">Oxirgi harakatlar</h2>
        {data.recentAudit.length === 0 ? <p className="text-mute">Hali harakatlar yo'q</p> : (
          <ul className="divide-y divide-line text-sm">
            {data.recentAudit.map((a) => (
              <li key={a.id} className="flex justify-between gap-4 py-2">
                <span>{a.action}</span>
                <span className="text-mute">{formatTashkent(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
