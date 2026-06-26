import { forwardRef, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { maskCPF, isValidCPF } from '@/lib/contractual/cpf';
import { onlyDigits } from '@/lib/contractual/format';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  showStatus?: boolean;
}

/** Input para CPF com máscara 000.000.000-00 e validação de dígito verificador.
 *  onChange entrega apenas dígitos. */
export const CPFInput = forwardRef<HTMLInputElement, Props>(function CPFInput(
  { value, onChange, placeholder = '000.000.000-00', className, required, disabled, showStatus = true },
  ref,
) {
  const digits = onlyDigits(value);
  const valid = digits.length === 11 ? isValidCPF(digits) : null;
  const invalid = digits.length === 11 && !valid;

  return (
    <div className="relative">
      <Input
        ref={ref}
        value={useMemo(() => maskCPF(digits), [digits])}
        onChange={(e) => onChange(onlyDigits(e.target.value).slice(0, 11))}
        placeholder={placeholder}
        disabled={disabled}
        inputMode="numeric"
        maxLength={14}
        className={cn(
          invalid && 'border-destructive focus-visible:ring-destructive',
          showStatus && 'pr-8',
          className,
        )}
        aria-invalid={invalid || undefined}
      />
      {showStatus && digits.length === 11 && (
        valid
          ? <CheckCircle2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
          : <AlertCircle className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
      )}
      {invalid && <p className="text-[11px] text-destructive mt-1">CPF inválido</p>}
      {required && digits.length > 0 && digits.length < 11 && (
        <p className="text-[11px] text-muted-foreground mt-1">CPF incompleto</p>
      )}
    </div>
  );
});
