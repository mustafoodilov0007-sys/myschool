import type { IconName } from '../components/icons';

export interface ModuleDef { to: string; icon: IconName; title: string; sub: string; end?: boolean }

/** Platformaning asosiy tuzilmasi (yon menyu, bosh sahifa va ochiq sahifa — hammasi shu ro'yxatdan). */
export const CORE_MODULES: ModuleDef[] = [
  { to: '/', icon: 'dashboard', title: 'Dashboard', sub: 'Umumiy statistika', end: true },
  { to: '/students', icon: 'students', title: "O'quvchilar bazasi", sub: "O'quvchi profillari" },
  { to: '/classes', icon: 'classes', title: 'Sinflar va fanlar', sub: "Ta'lim tuzilmasi" },
  { to: '/journal', icon: 'journal', title: 'Elektron jurnal', sub: 'Baholar va mavzular' },
  { to: '/attendance', icon: 'attendance', title: 'Davomat', sub: 'Kelgan-kelmaganlar' },
  { to: '/schedule', icon: 'schedule', title: 'Dars jadvali', sub: 'Darslar taqsimoti' },
  { to: '/reports', icon: 'reports', title: 'Hisobotlar', sub: 'Statistik tahlil' },
  { to: '/messages', icon: 'messages', title: 'Xabarnomalar', sub: "O'quvchilar bilan aloqa" },
  { to: '/settings', icon: 'settings', title: 'Sozlamalar', sub: 'Tizim va harakatlar tarixi' },
];

/** Fizika nazorati (asl loyihaning imtihon vositalari) — alohida guruhda saqlanadi. */
export const EXAM_MODULES: ModuleDef[] = [
  { to: '/exams', icon: 'exams', title: 'Imtihonlar', sub: 'Yaratish, jadval va natijalar' },
  { to: '/questions', icon: 'questions', title: 'Savollar banki', sub: 'Savol, rasm va formulalar' },
  { to: '/materials', icon: 'materials', title: 'Materiallar', sub: "O'quv materiallari" },
  { to: '/complaints', icon: 'complaints', title: 'Shikoyatlar', sub: 'Murojaatlar va javoblar' },
];
