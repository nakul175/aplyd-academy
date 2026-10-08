'use client';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useAcademy } from './academy-context';
export function FormError() {
  const context = useAcademy();
  return context?.error ? (
    <div role="alert" className="notice error-notice">
      <p>
        <strong>This needs your attention.</strong> {context.error}
      </p>
    </div>
  ) : null;
}
export function Field({ id, label, help, value, onChange, rows = 4, placeholder = '', ...props }: any) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help && <p id={`${id}-help`}>{help}</p>}
      <textarea
        id={id}
        aria-describedby={help ? `${id}-help` : undefined}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        maxLength={10000}
        {...props}
      />
    </div>
  );
}
export function Pick({ label, value, onChange, options, ...props }: any) {
  return (
    <Select value={value} onValueChange={onChange} {...props}>
      <SelectTrigger aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o: any) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Empty({ icon: Icon, title, body, action, onAction }: any) {
  return (
    <div className="empty-state">
      {Icon && <Icon size={32} />}
      <h2>{title}</h2>
      <p>{body}</p>
      {action && <Button onClick={onAction}>{action}</Button>}
    </div>
  );
}
export function Tag({ children, tone = '' }: any) {
  return <span className={`status-tag ${tone}`}>{children}</span>;
}
export function Head({ eyebrow, title, body, children }: any) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {body && <p>{body}</p>}
      </div>
      {children}
    </div>
  );
}
export const date = (v: string) =>
  new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
