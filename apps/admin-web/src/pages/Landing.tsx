import { Link } from 'react-router-dom';
import { Icon } from '../components/icons';
import { CORE_MODULES, EXAM_MODULES } from '../lib/modules';

const ROLES = [
  { icon: '🎓', title: "O'quvchi", sub: "Imtihon topshirish va natijalarni ko'rish — Telegram bot orqali" },
  { icon: '👨‍🏫', title: "O'qituvchi / Administrator", sub: 'Imtihon, savollar va hisobotlarni boshqarish' },
];
const PUBLIC = [...CORE_MODULES.filter((m) => !m.end && m.to !== '/settings'), ...EXAM_MODULES.filter((m) => m.to !== '/complaints')];

/** Ochiq bosh sahifa: login/parol so'ramaydi, hech qanday maxfiy ma'lumot ko'rsatmaydi. */
export function Landing() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:py-10">
      <header className="hero">
        <h1 className="text-2xl font-bold">⚛️ Physics Exam Pro</h1>
        <small>Maktab fizika imtihonlari uchun yagona elektron platforma</small>
      </header>

      <section aria-labelledby="h-roles" className="space-y-2">
        <h2 id="h-roles">Kim uchun?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROLES.map((r) => (
            <div key={r.title} className="card flex items-start gap-3">
              <span className="module-icon" aria-hidden="true">{r.icon}</span>
              <div><div className="module-title">{r.title}</div><div className="module-sub">{r.sub}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="h-mod" className="card">
        <h2 id="h-mod" className="mb-2">Platforma bo'limlari</h2>
        <div className="grid gap-x-4 md:grid-cols-2">
          {PUBLIC.map((m) => (
            <div key={m.title} className="module-row hover:bg-transparent">
              <span className="module-icon"><Icon name={m.icon} size={22} /></span>
              <div><div className="module-title">{m.title}</div><div className="module-sub">{m.sub}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="card space-y-3 text-center">
        <p className="text-mute">O'quvchilar imtihonni maktab Telegram botidagi «Imtihon» tugmasi orqali boshlaydi.</p>
        <Link to="/login" className="btn w-full sm:w-auto">Administrator kirishi</Link>
      </section>
    </div>
  );
}
