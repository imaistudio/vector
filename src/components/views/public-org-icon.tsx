'use client';

export function PublicOrgIcon({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className='size-4 shrink-0 rounded-full object-cover'
      />
    );
  }

  return (
    <span className='bg-muted text-muted-foreground flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase'>
      {name.charAt(0)}
    </span>
  );
}
