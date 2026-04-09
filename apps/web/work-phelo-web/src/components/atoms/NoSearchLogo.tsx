import Image from 'next/image';

export function NoSearchLogo() {
  return (
    <div className="flex justify-center">
      <div className="relative w-50 aspect-280/90">
        <Image
          src="/NoSearchLogo.png"
          alt="Search Logo"
          fill
          className="object-contain"
          sizes="(max-width: 1200px) 190px, 220px"
          priority
        />
      </div>
    </div>
  );
}
