'use client';

import { useActionState } from 'react';
import { changePassword, updateProfile } from '@/app/(app)/perfil/actions';
import { Field, FormError, SubmitButton } from './field';
import { emptyState } from '@/shared/forms/form-state';

export function ProfileForms({ name, email }: { name: string; email: string }) {
  const [profileState, saveProfile, savingProfile] = useActionState(updateProfile, emptyState);
  const [passwordState, savePassword, savingPassword] = useActionState(changePassword, emptyState);

  return (
    <div className="max-w-md space-y-10">
      <section className="space-y-4" data-testid="profile-section">
        <div>
          <h2 className="text-base font-medium">Información del perfil</h2>
          <p className="text-muted mt-1 text-sm">Tu nombre, tal como lo ve el resto.</p>
        </div>

        <form action={saveProfile} className="space-y-4">
          <Field label="Nombre" name="name" testId="profile-name" defaultValue={name} />

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Correo
            </label>
            {/* El correo identifica la cuenta en todas las empresas: cambiarlo no es
                una preferencia personal, y por eso aqui solo se muestra. */}
            <input
              id="email"
              value={email}
              disabled
              data-testid="profile-email"
              className="border-line text-muted w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            <p className="text-muted text-xs">
              Para cambiar tu correo, pídeselo a un administrador de la empresa.
            </p>
          </div>

          <FormError message={profileState.error} testId="profile-error" />

          {profileState.done ? (
            <p className="text-sm text-emerald-600" data-testid="profile-saved">
              Perfil actualizado.
            </p>
          ) : null}

          <SubmitButton pending={savingProfile} testId="profile-submit">
            Guardar
          </SubmitButton>
        </form>
      </section>

      <section className="space-y-4" data-testid="password-section">
        <div>
          <h2 className="text-base font-medium">Contraseña</h2>
          <p className="text-muted mt-1 text-sm">
            Se pide la actual para que nadie la cambie desde una sesión abierta que no es suya.
          </p>
        </div>

        <form action={savePassword} className="space-y-4">
          <Field
            label="Contraseña actual"
            name="current"
            type="password"
            testId="password-current"
          />
          <Field label="Nueva contraseña" name="next" type="password" testId="password-next" />
          <Field
            label="Repite la nueva"
            name="confirmation"
            type="password"
            testId="password-confirmation"
          />

          <FormError message={passwordState.error} testId="password-error" />

          {passwordState.done ? (
            <p className="text-sm text-emerald-600" data-testid="password-saved">
              Contraseña cambiada.
            </p>
          ) : null}

          <SubmitButton pending={savingPassword} testId="password-submit">
            Cambiar contraseña
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
