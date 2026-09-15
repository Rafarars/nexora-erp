// El selector de los formularios de la empresa, con la misma presentacion que los campos de texto.
export function Select({
  label,
  name,
  testId,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  testId: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} data-testid={testId} className="border-line bg-background w-full rounded-md border px-3 py-2 text-sm">
        {children}
      </select>
    </div>
  );
}
