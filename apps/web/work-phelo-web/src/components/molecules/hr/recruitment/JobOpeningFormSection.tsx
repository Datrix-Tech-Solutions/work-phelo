import { cardClass } from '@/lib/utils';

interface Props {
  title: string;
  description?: string;
  children: React.ReactNode;
}

/** A form section on its own card, with its header above the fields. */
export function JobOpeningFormSection({ title, description, children }: Props) {
  return (
    <section className={cardClass('flex flex-col gap-4 p-6')}>
      <div className="flex flex-col gap-1">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</h2>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">{children}</div>
    </section>
  );
}
