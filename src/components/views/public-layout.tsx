'use client';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className='bg-background flex min-h-screen flex-col'>
      <main className='flex-1'>{children}</main>
      <footer className='border-t py-4 text-center'>
        <span className='text-muted-foreground text-xs'>Powered by Vector</span>
      </footer>
    </div>
  );
}
