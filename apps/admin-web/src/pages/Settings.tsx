import { useAuth } from '../lib/auth';
import { AuditPage } from './Audit';

export function SettingsPage() {
  const { admin, logout } = useAuth();
  return (
    <div className="space-y-6">
      <div className="page-title"><h1>Sozlamalar</h1></div>
      <section className="card" aria-labelledby="h-acc">
        <h2 id="h-acc" className="mb-3">Hisob</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-mute">Ism</dt><dd className="font-medium">{admin?.displayName ?? 'Administrator'}</dd>
          <dt className="text-mute">Telegram ID</dt><dd className="font-mono">{admin?.telegramId}</dd>
          <dt className="text-mute">Rol</dt><dd>Administrator</dd>
        </dl>
        <button className="btn-ghost mt-4" onClick={() => void logout()}>Chiqish</button>
      </section>
      <section className="card" aria-labelledby="h-roles">
        <h2 id="h-roles" className="mb-1">Rollar va ruxsatlar</h2>
        <p className="text-sm text-mute">Hozir tizimda bitta rol bor — administrator. Direktor, sinf rahbari va ota-ona rollari hali yaratilmagan; ular keyingi bosqichda qo'shiladi.</p>
      </section>
      <AuditPage />
    </div>
  );
}
