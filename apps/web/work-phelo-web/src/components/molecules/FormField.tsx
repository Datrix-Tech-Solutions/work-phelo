import { Input } from '@/components/atoms/Input';
import { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function FormField({
  label,
  registration,
  error,
  type = 'text',
  placeholder,
  readOnly,
}: FormFieldProps) {
  return (
    <Input
      label={label}
      type={type}
      placeholder={placeholder}
      readOnly={readOnly}
      error={error?.message}
      {...registration}
    />
  );
}
