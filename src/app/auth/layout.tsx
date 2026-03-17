/**
 * Auth layout — scopes auth-specific color overrides
 * so they don't leak into the rest of the app.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className='auth-scope'
      style={
        {
          '--primary': 'oklch(0.609 0.126 221.7)',
          '--primary-foreground': 'oklch(0.985 0 0)',
          '--secondary': 'oklch(0.946 0.033 293)',
          '--secondary-foreground': 'oklch(0.37 0.124 293)',
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
