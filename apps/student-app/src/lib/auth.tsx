import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { t } from '@pep/shared';
import type { StudentMeDto } from '@pep/shared';
import { ApiFail, login } from './api';

type State =
  | { status: 'loading' }
  | { status: 'ready'; student: StudentMeDto }
  | { status: 'error'; message: string; retryable: boolean };

const Ctx = createContext<{ state: State; retry: () => void } | null>(null);

function describe(e: unknown): { message: string; retryable: boolean } {
  if (e instanceof ApiFail) {
    switch (e.code) {
      case 'NOT_LINKED': return { message: t('app_err_not_linked'), retryable: false };
      case 'STUDENT_INACTIVE': return { message: t('app_err_inactive'), retryable: false };
      case 'INIT_DATA_EXPIRED':
      case 'INIT_DATA_INVALID': return { message: t('app_err_expired'), retryable: false };
      case 'NOT_TELEGRAM': return { message: t('app_err_not_telegram'), retryable: false };
    }
  }
  return { message: t('app_err_generic'), retryable: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const run = useCallback(() => {
    setState({ status: 'loading' });
    login().then(
      (student) => setState({ status: 'ready', student }),
      (e: unknown) => setState({ status: 'error', ...describe(e) }),
    );
  }, []);
  useEffect(run, [run]);
  return <Ctx.Provider value={{ state, retry: run }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider topilmadi');
  return v;
}
