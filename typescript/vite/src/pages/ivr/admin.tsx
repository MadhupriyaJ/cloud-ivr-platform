import { ReactNode, useEffect } from 'react';
import {
  Toolbar,
  ToolbarActions,
  ToolbarDescription,
  ToolbarHeading,
  ToolbarPageTitle
} from '@/partials/toolbar';

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
    <Toolbar>
      <ToolbarHeading>
        <ToolbarPageTitle text={props.title} />
        <ToolbarDescription>{props.description}</ToolbarDescription>
      </ToolbarHeading>
      {props.actions && <ToolbarActions>{props.actions}</ToolbarActions>}
    </Toolbar>
  );
}

export function IvrStatCard(props: {
  label: string;
  value: ReactNode;
  meta?: string;
  tone?: 'teal' | 'blue' | 'amber' | 'rose';
}) {
  const tone = props.tone || 'teal';
  const toneClass = {
    teal: 'border-success/20 bg-success/10 text-success',
    blue: 'border-primary/20 bg-primary/10 text-primary',
    amber: 'border-warning/20 bg-warning/10 text-warning',
    rose: 'border-danger/20 bg-danger/10 text-danger'
  }[tone];
  return (
    <div className="card border border-gray-200 shadow-none dark:border-coal-100">
      <div className="card-body">
        <div className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] ${toneClass}`}>
          {props.label}
        </div>
        <div className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">{props.value}</div>
        {props.meta && <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">{props.meta}</div>}
      </div>
    </div>
  );
}

export function IvrToast({ toast }: { toast: Toast }) {
  if (!toast) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[100]">
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
