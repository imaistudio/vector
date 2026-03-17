'use client';

/**
 * Brand header for auth pages — logo mark + wordmark.
 * Centered above the form, no separate panel.
 */
export function AuthBrandHeader() {
  return (
    <div className='mb-8 flex flex-col items-center gap-4 lg:mb-10'>
      {/* Logo icon — uses the full SVG with dark bg so the gradient mark pops */}
      <img
        src='/icons/vector-logo.svg'
        alt='Vector'
        className='size-14 rounded-2xl shadow-lg shadow-black/10 lg:size-16'
      />
      <div className='text-center'>
        <h2 className='font-title text-foreground/40 text-lg font-semibold tracking-tight'>
          Vector
        </h2>
      </div>
    </div>
  );
}
