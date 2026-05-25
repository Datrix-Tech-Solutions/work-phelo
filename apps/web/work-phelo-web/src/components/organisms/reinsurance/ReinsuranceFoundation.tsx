import { ArrowRight, BriefcaseBusiness, Mail, ShieldCheck } from 'lucide-react';

const plannedAreas = [
  {
    name: 'Placements',
    description: 'Register and coordinate broker placement workflows.',
    icon: BriefcaseBusiness,
  },
  {
    name: 'Broker Mailbox',
    description: 'Link email threads and attachments to operational records.',
    icon: Mail,
  },
  {
    name: 'Controlled Access',
    description: 'Tenant-scoped records protected by Reinsurance permissions.',
    icon: ShieldCheck,
  },
];

export function ReinsuranceFoundation() {
  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6 md:p-8">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 px-6 py-8 text-white md:px-10 md:py-10">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="absolute bottom-0 left-40 h-32 w-72 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300">
            Operations / Reinsurance
          </p>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Broker operations workspace
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
            The Reinsurance service boundary is ready for placement, counterparty and embedded
            correspondence workflows. Business screens arrive in the first implementation sprint.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {plannedAreas.map(({ name, description, icon: Icon }) => (
          <article
            key={name}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="mt-5 text-base font-semibold text-slate-900">{name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-slate-900">MVP boundary confirmed</p>
          <p className="mt-1">
            Broker users only. No external portals and no automated email parsing.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 font-medium text-emerald-700">
          Foundation scaffold
          <ArrowRight className="h-4 w-4" />
        </span>
      </section>
    </div>
  );
}
