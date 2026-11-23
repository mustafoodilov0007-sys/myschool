import { Link } from 'react-router-dom';
import type { ClassDto } from '@pep/shared';
import { api, errMsg } from '../lib/api';
import { Empty, Spinner, useAsync } from './ui';

/** O'quv yili: 1-sentabrdan boshlanadi (Toshkent vaqti bilan). */
const academicYear = () => {
  const t = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tashkent' });
  const y = Number(t.slice(0, 4));
  const a = Number(t.slice(5, 7)) >= 9 ? y : y - 1;
  return `${a}/${a + 1}`;
};
const gradeOf = (name: string) => { const m = /^\s*(\d{1,2})/.exec(name); return m ? Number(m[1]) : 0; };

/** eMaktab tartibi: sinflar parallellar bo'yicha ustunlarga bo'linadi (1…11), faqat qo'shilgan sinflar chiqadi. */
export function ClassIndex({ base, title, hint }: { base: string; title: string; hint: string }) {
  const d = useAsync(() => api<{ items: ClassDto[] }>('/api/admin/classes'), []);
  const cols = new Map<number, ClassDto[]>();
  for (const c of d.data?.items ?? []) { const g = gradeOf(c.name); cols.set(g, [...(cols.get(g) ?? []), c]); }
  const grades = [...cols.keys()].sort((a, b) => (a || 99) - (b || 99));
  return (
    <div className="space-y-4">
      <div className="page-title"><h1>{title}</h1></div>
      <section className="card" aria-label="Sinflar">
        <div className="flex flex-wrap items-center gap-3"><h2>{academicYear()} o'quv yili</h2><span className="badge">Joriy yil</span></div>
        <p className="mt-1 text-sm text-mute">{hint}</p>
        {d.loading ? <Spinner /> : d.error ? <p role="alert" className="text-danger">{errMsg(d.error)}</p> : grades.length === 0 ? (
          <div className="mt-4"><Empty>Hali sinf qo'shilmagan. <Link className="font-semibold text-brand underline" to="/administration">Administratsiya</Link> bo'limida sinf qo'shing.</Empty></div>
        ) : (
          <div className="mt-6 flex flex-wrap gap-x-12 gap-y-8">
            {grades.map((g) => (
              <div key={g} className="class-col">
                <div className="class-grade" aria-hidden="true">{g || '•'}</div>
                {cols.get(g)!.sort((a, b) => a.name.localeCompare(b.name, 'uz')).map((c) => (
                  <Link key={c.id} to={`${base}/${c.id}`} className="class-link" title={`${c.studentCount} ta o'quvchi`}>{c.name}</Link>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
