import type { Metadata } from 'next';
import { LoginForm } from '@/sections/access/login-form';

export const metadata: Metadata = { title: 'Entrar · Nexora ERP' };

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xl font-semibold tracking-tight">NEXORA</p>
          <p className="text-muted mt-1 text-sm">Sistema de gestión empresarial</p>
        </div>

        <LoginForm />
      </div>
    </main>
  );
}
