export function Field({
  label,
  name,
  type = 'text',
  required = true,
  testId,
  defaultValue,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  testId: string;
  defaultValue?: string;
  // Sin esto el navegador adivina, y un formulario con correo y contrasena le parece
  // un login: rellena el alta de otra persona con las credenciales guardadas.
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        data-testid={testId}
        className="border-line w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500"
      />
    </div>
  );
}

export function FormError({ message, testId }: { message: string | null; testId: string }) {
  if (!message) return null;

  return (
    <p role="alert" data-testid={testId} className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">
      {message}
    </p>
  );
}

export function SubmitButton({
  children,
  pending,
  testId,
}: {
  children: React.ReactNode;
  pending: boolean;
  testId: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid={testId}
      className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-neutral-900"
    >
      {pending ? 'Guardando…' : children}
    </button>
  );
}
