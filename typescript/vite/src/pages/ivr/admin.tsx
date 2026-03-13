import { ReactNode, useEffect } from 'react';
import './ivr-admin.css';

type Toast = { kind: 'success' | 'danger'; text: string } | null;

export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

export function getErrorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function useToast(toast: Toast, clear: () => void) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clear, 3500);
    return () => clearTimeout(timer);
  }, [clear, toast]);
}

export function IvrPageHeader(props: {
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="card ivr-admin-hero">
      <div className="card-header flex-wrap gap-3">
        <div>
          <h3 className="ivr-admin-title">{props.title}</h3>
          <div className="text-sm mt-2 ivr-admin-description">{props.description}</div>
        </div>
        {props.actions && <div className="ms-auto flex flex-wrap gap-2">{props.actions}</div>}
      </div>
    </div>
  );
}

export function IvrStatCard(props: {
  label: string;
  value: ReactNode;
  meta?: string;
  tone?: 'teal' | 'blue' | 'amber' | 'rose';
}) {
  const tone = props.tone || 'teal';
  return (
    <div className={`card ivr-stat-card ${tone}`}>
      <div className="card-body">
        <div className={`ivr-stat-chip ${tone}`}>{props.label}</div>
        <div className="text-2xl font-semibold text-gray-900 mt-3">{props.value}</div>
        {props.meta && <div className="text-xs text-gray-600 mt-2">{props.meta}</div>}
      </div>
    </div>
  );
}

export function IvrToast({ toast }: { toast: Toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100] ivr-floating-toast">
      <div className={`alert ${toast.kind === 'success' ? 'alert-success' : 'alert-danger'}`}>
        {toast.text}
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-8 text-center text-gray-600">
        {text}
      </td>
    </tr>
  );
}
