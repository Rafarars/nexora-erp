'use client';

export function MenuButton({
  children,
  testId,
  type = 'button',
  onClick,
}: {
  children: React.ReactNode;
  testId: string;
  type?: 'button' | 'submit';
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      role="menuitem"
      onClick={onClick}
      data-testid={testId}
      className="hover:bg-surface block w-full rounded px-3 py-2 text-left text-sm"
    >
      {children}
    </button>
  );
}
