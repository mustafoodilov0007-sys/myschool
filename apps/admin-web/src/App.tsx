import { useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import { SettingsPage } from './pages/Settings';
import { AdministrationPage } from './pages/Administration';
import { AuditPage } from './pages/Audit';
import { Icon } from './components/icons';
import { CORE_MODULES, EXAM_MODULES } from './lib/modules';
import type { ModuleDef } from './lib/modules';
import { AuthCallback, Login } from './pages/Login';
import { AttendancePage, JournalPage, SchedulePage } from './pages/School';
import { Landing } from './pages/Landing';
import { ClassesPage } from './pages/Classes';
import { Dashboard } from './pages/Dashboard';
import { ExamResultsPage } from './pages/ExamResults';
import { ExamsPage } from './pages/Exams';
import { QuestionsPage } from './pages/Questions';
import { StudentsPage } from './pages/Students';
import { ComplaintsPage } from './pages/Complaints';
import { MaterialsPage } from './pages/Materials';
import { MessagesPage } from './pages/Messages';
import { ReportsPage } from './pages/Reports';

const NavItem = ({ m, onClick }: { m: ModuleDef; onClick: () => void }) => (
  <NavLink to={m.to} end={m.end} onClick={onClick} className={({ isActive }) => `side-item ${isActive ? 'active' : ''}`}>
    <span className="side-ico"><Icon name={m.icon} size={19} /></span>
    <span className="min-w-0"><span className="side-title block truncate">{m.title}</span><span className="side-sub block truncate">{m.sub}</span></span>
  </NavLink>
);

export function App() {
  const { loading, admin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Routes>
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/welcome" element={<Landing />} />
      <Route path="/login" element={admin ? <Navigate to="/" replace /> : <Login />} />
      <Route
        path="/*"
        element={
          loading ? <Spinner /> : !admin ? <Navigate to="/welcome" replace /> : (
            <div className="min-h-screen md:flex">
              <header className="side flex items-center justify-between px-4 py-3 md:hidden">
                <div className="flex items-center gap-2 font-bold text-white"><span className="side-logo">⚛️</span>Physics Exam Pro</div>
                <button className="side-btn" aria-label="Menyu" aria-expanded={menuOpen} aria-controls="admin-nav" onClick={() => setMenuOpen((v) => !v)}>
                  <Icon name="menu" size={20} />
                </button>
              </header>
              <aside id="admin-nav" className={`side ${menuOpen ? 'block' : 'hidden'} w-full shrink-0 p-4 md:sticky md:top-0 md:flex md:h-screen md:w-[19rem] md:flex-col md:overflow-hidden`}>
                <div className="mb-5 hidden items-center gap-3 px-1 md:flex">
                  <span className="side-logo">⚛️</span>
                  <div className="leading-tight"><div className="font-bold text-white">Physics Exam Pro</div><div className="text-xs text-white/60">Maktab boshqaruv platformasi</div></div>
                </div>
                <nav aria-label="Asosiy" className="side-scroll min-h-0 flex-1 space-y-1 md:overflow-y-auto">
                  {CORE_MODULES.map((m) => <NavItem key={m.to} m={m} onClick={() => setMenuOpen(false)} />)}
                  <div className="side-group">Fizika nazorati</div>
                  {EXAM_MODULES.map((m) => <NavItem key={m.to} m={m} onClick={() => setMenuOpen(false)} />)}
                </nav>
                <NavLink to="/administration" onClick={() => setMenuOpen(false)} className={({ isActive }) => `side-admin mt-4 shrink-0 ${isActive ? 'active' : ''}`}>
                  <Icon name="shield" size={18} /><span>Administratsiya</span><Icon name="chevron" size={16} />
                </NavLink>
                <div className="side-user mt-4 shrink-0">
                  <span className="side-ava" aria-hidden="true">{(admin.displayName ?? 'A').slice(0, 1).toUpperCase()}</span>
                  <div className="min-w-0 flex-1 leading-tight"><div className="truncate text-sm font-semibold text-white">{admin.displayName ?? 'Administrator'}</div><div className="text-xs text-white/60">Administrator</div></div>
                  <button className="side-btn" title="Chiqish" aria-label="Chiqish" onClick={() => void logout()}><Icon name="logout" size={18} /></button>
                </div>
              </aside>
              <main className="mx-auto min-w-0 max-w-7xl flex-1 p-4 md:p-6">
                <Routes>
                  <Route index element={<Dashboard />} />
                  <Route path="journal/:classId" element={<JournalPage />} />
                  <Route path="journal" element={<JournalPage />} />
                  <Route path="attendance/:classId" element={<AttendancePage />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="schedule/:classId" element={<SchedulePage />} />
                  <Route path="schedule" element={<SchedulePage />} />
                  <Route path="classes" element={<ClassesPage />} />
                  <Route path="students" element={<StudentsPage />} />
                  <Route path="questions" element={<QuestionsPage />} />
                  <Route path="exams" element={<ExamsPage />} />
                  <Route path="exams/:id/results" element={<ExamResultsPage />} />
                  <Route path="materials" element={<MaterialsPage />} />
                  <Route path="complaints" element={<ComplaintsPage />} />
                  <Route path="messages" element={<MessagesPage />} />
                  <Route path="reports" element={<ReportsPage />} />
                  <Route path="administration" element={<AdministrationPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="audit" element={<AuditPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          )
        }
      />
    </Routes>
  );
}
