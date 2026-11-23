import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ClassDto, StudentDto } from '@pep/shared';
import { api, errMsg } from '../lib/api';
import { Icon } from '../components/icons';
import type { IconName } from '../components/icons';
import { Modal, useAsync } from '../components/ui';
import { useToast } from '../components/Toast';

const DAYS = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
type Task = 'class' | 'student' | 'lesson';

const TASKS: { id: Task; icon: IconName; title: string; sub: string }[] = [
  { id: 'class', icon: 'classes', title: "Sinf qo'shish", sub: 'Yangi sinf yaratish (masalan: 8-A)' },
  { id: 'student', icon: 'userplus', title: "O'quvchi qo'shish", sub: "Sinfga o'quvchi qo'shish va ID kodi berish" },
  { id: 'lesson', icon: 'schedule', title: "Dars qo'shish", sub: "Sinf haftalik jadvaliga dars kiritish" },
];
const LINKS: { to: string; icon: IconName; title: string; sub: string }[] = [
  { to: '/students', icon: 'students', title: "O'quvchilarni ro'yxatdan qo'shish", sub: "Bir nechta o'quvchini bir yo'la kiritish va ID lar CSV" },
  { to: '/classes', icon: 'classes', title: 'Sinflarni boshqarish', sub: 'Nomini o\'zgartirish va arxivlash' },
  { to: '/exams', icon: 'exams', title: 'Imtihon yaratish', sub: 'Haftalik fizika imtihonlari' },
  { to: '/settings', icon: 'settings', title: 'Harakatlar tarixi', sub: 'Kim nima qilgani (audit)' },
];

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block text-sm"><span className="mb-1 block font-medium">{label}</span>{children}</label>
);

export function AdministrationPage() {
  const toast = useToast();
  const [task, setTask] = useState<Task | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const classes = useAsync(() => api<{ items: ClassDto[] }>('/api/admin/classes'), []);
  const items = classes.data?.items ?? [];
  const done = (msg: string) => { setLog((l) => [msg, ...l].slice(0, 6)); toast(msg); classes.reload(); setTask(null); };
  return (
    <div className="space-y-6">
      <div className="hero"><h1 className="text-2xl font-bold">Administratsiya</h1><small>Tizimni boshqarish vazifalari — tanlang va shu yerning o'zida bajaring</small></div>

      <section className="card" aria-labelledby="h-tasks">
        <h2 id="h-tasks" className="mb-2">Vazifalar</h2>
        <div className="grid gap-x-4 md:grid-cols-2">
          {TASKS.map((t) => (
            <button key={t.id} className="module-row w-full text-left" onClick={() => setTask(t.id)}>
              <span className="module-icon"><Icon name={t.icon} size={22} /></span>
              <span><span className="module-title block">{t.title}</span><span className="module-sub">{t.sub}</span></span>
              <span className="chev"><Icon name="chevron" size={18} /></span>
            </button>
          ))}
          <div className="module-row cursor-default opacity-60 hover:bg-transparent" aria-disabled="true">
            <span className="module-icon"><Icon name="userplus" size={22} /></span>
            <span><span className="module-title block">O'qituvchi qo'shish <span className="badge ml-1">Keyingi bosqichda</span></span><span className="module-sub">Hozir tizimda faqat administrator hisobi bor</span></span>
          </div>
        </div>
      </section>

      <section className="card" aria-labelledby="h-more">
        <h2 id="h-more" className="mb-2">Boshqa bo'limlar</h2>
        <div className="grid gap-x-4 md:grid-cols-2">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="module-row">
              <span className="module-icon"><Icon name={l.icon} size={22} /></span>
              <span><span className="module-title block">{l.title}</span><span className="module-sub">{l.sub}</span></span>
              <span className="chev"><Icon name="chevron" size={18} /></span>
            </Link>
          ))}
        </div>
      </section>

      {log.length > 0 && (
        <section className="card" aria-labelledby="h-log">
          <h2 id="h-log" className="mb-2">Hozir bajarilganlar</h2>
          <ul className="space-y-1 text-sm">{log.map((m, i) => <li key={i}>✅ {m}</li>)}</ul>
        </section>
      )}

      {task === 'class' && <ClassTask onClose={() => setTask(null)} onDone={done} />}
      {task === 'student' && <StudentTask classes={items} onClose={() => setTask(null)} onDone={done} />}
      {task === 'lesson' && <LessonTask classes={items} onClose={() => setTask(null)} onDone={done} />}
    </div>
  );
}

interface TaskProps { onClose: () => void; onDone: (msg: string) => void }

function ClassTask({ onClose, onDone }: TaskProps) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Sinf qo'shish" onClose={onClose}>
      <Field label="Sinf nomi"><input className="input" value={name} maxLength={40} placeholder="8-A" autoFocus onChange={(e) => setName(e.target.value)} /></Field>
      <p className="mt-2 text-sm text-mute">O'quvchi ID lari shu nomdan olinadi: 8-A → PH-8A-0417.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Bekor qilish</button>
        <button className="btn" disabled={!name.trim() || busy} onClick={async () => {
          setBusy(true);
          try { await api('/api/admin/classes', { method: 'POST', body: { name } }); onDone(`Sinf qo'shildi: ${name.trim()}`); } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
        }}>{busy ? 'Saqlanmoqda…' : "Qo'shish"}</button>
      </div>
    </Modal>
  );
}

function StudentTask({ classes, onClose, onDone }: TaskProps & { classes: ClassDto[] }) {
  const toast = useToast();
  const [classId, setClassId] = useState('');
  const [lastName, setLast] = useState('');
  const [firstName, setFirst] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = classId && firstName.trim() && lastName.trim();
  return (
    <Modal title="O'quvchi qo'shish" onClose={onClose}>
      {classes.length === 0 ? <p className="text-sm text-mute">Avval sinf qo'shing.</p> : (
        <div className="space-y-3">
          <Field label="Sinf"><select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Tanlang…</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Familiya"><input className="input" value={lastName} onChange={(e) => setLast(e.target.value)} /></Field>
          <Field label="Ism"><input className="input" value={firstName} onChange={(e) => setFirst(e.target.value)} /></Field>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Bekor qilish</button>
        <button className="btn" disabled={!ok || busy} onClick={async () => {
          setBusy(true);
          try {
            const s = await api<StudentDto>('/api/admin/students', { method: 'POST', body: { classId, firstName, lastName } });
            onDone(`O'quvchi qo'shildi: ${s.lastName} ${s.firstName} (${s.className}), ID: ${s.code}`);
          } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
        }}>{busy ? 'Saqlanmoqda…' : "Qo'shish"}</button>
      </div>
    </Modal>
  );
}

function LessonTask({ classes, onClose, onDone }: TaskProps & { classes: ClassDto[] }) {
  const toast = useToast();
  const [f, setF] = useState({ classId: '', weekday: 1, lessonNo: 1, subject: 'Fizika', room: '', startsAt: '', endsAt: '' });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const ok = f.classId && f.subject.trim() && f.lessonNo >= 1 && f.lessonNo <= 10;
  return (
    <Modal title="Dars qo'shish" onClose={onClose}>
      {classes.length === 0 ? <p className="text-sm text-mute">Avval sinf qo'shing.</p> : (
        <div className="space-y-3">
          <Field label="Sinf"><select className="input" value={f.classId} onChange={(e) => set('classId', e.target.value)}><option value="">Tanlang…</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Hafta kuni"><select className="input" value={f.weekday} onChange={(e) => set('weekday', Number(e.target.value))}>{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select></Field>
            <Field label="Dars raqami"><input type="number" min={1} max={10} className="input" value={f.lessonNo} onChange={(e) => set('lessonNo', Number(e.target.value))} /></Field>
          </div>
          <Field label="Fan"><input className="input" maxLength={60} value={f.subject} onChange={(e) => set('subject', e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Xona"><input className="input" maxLength={20} value={f.room} onChange={(e) => set('room', e.target.value)} /></Field>
            <Field label="Boshlanishi"><input type="time" className="input" value={f.startsAt} onChange={(e) => set('startsAt', e.target.value)} /></Field>
            <Field label="Tugashi"><input type="time" className="input" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} /></Field>
          </div>
          <p className="text-sm text-mute">Shu kun va raqamdagi dars mavjud bo'lsa, u yangilanadi.</p>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>Bekor qilish</button>
        <button className="btn" disabled={!ok || busy} onClick={async () => {
          setBusy(true);
          try {
            await api(`/api/admin/schedule/${f.classId}`, { method: 'PUT', body: { weekday: f.weekday, lessonNo: f.lessonNo, subject: f.subject, room: f.room || null, startsAt: f.startsAt || null, endsAt: f.endsAt || null } });
            const cn = classes.find((c) => c.id === f.classId)?.name ?? '';
            onDone(`Dars qo'shildi: ${cn}, ${DAYS[f.weekday - 1]}, ${f.lessonNo}-dars — ${f.subject.trim()}`);
          } catch (e) { toast(errMsg(e), 'err'); } finally { setBusy(false); }
        }}>{busy ? 'Saqlanmoqda…' : "Qo'shish"}</button>
      </div>
    </Modal>
  );
}
