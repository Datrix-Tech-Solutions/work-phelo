import { Input } from '@/components/atoms/Input';
import { PasswordInput } from '@/components/atoms/PasswordInput';
import { FieldError, UseFormRegisterReturn } from 'react-hook-form';

interface FormFieldProps {
  label: string;
  registration: UseFormRegisterReturn;
  error?: FieldError;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  rows?: number;
}

export function FormField({
  label,
  registration,
  error,
  type = 'text',
  placeholder,
  readOnly,
  rows,
}: FormFieldProps) {
  if (type === 'password') {
    return (
      <PasswordInput
        label={label}
        placeholder={placeholder}
        readOnly={readOnly}
        error={error?.message}
        {...registration}
      />
    );
  }

  return (
    <Input
      label={label}
      type={type as 'textarea'}
      placeholder={placeholder}
      readOnly={readOnly}
      error={error?.message}
      rows={rows}
      {...registration}
    />
  );
}
