interface FormSectionProps {
  title: string;
  children: React.ReactNode;
}

export function FormSection({ title, children }: FormSectionProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
      {children}
    </div>
  );
}
