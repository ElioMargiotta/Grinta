import type { ReactNode, TextareaHTMLAttributes, InputHTMLAttributes } from "react";

const sharedInputClass =
  "w-full rounded-sm border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900/20 print:border-zinc-400 print:focus:ring-0";

export function SheetInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${sharedInputClass} ${className}`} />;
}

export function SheetTextarea(
  props: TextareaHTMLAttributes<HTMLTextAreaElement> & { rows?: number },
) {
  const { className = "", rows = 4, ...rest } = props;
  return (
    <textarea
      {...rest}
      rows={rows}
      className={`${sharedInputClass} resize-none ${className}`}
    />
  );
}

export function SectionHeader({
  title,
  right,
}: {
  title: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-y border-zinc-300 bg-zinc-100 px-3 py-1.5 print:bg-zinc-100">
      <div className="text-sm font-bold text-zinc-900">{title}</div>
      {right && <div className="text-sm text-zinc-700">{right}</div>}
    </div>
  );
}

export function ColumnHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 print:bg-zinc-50">
      {children}
    </div>
  );
}

/** Small inline helper text that disappears when printing. */
export function Hint({ children }: { children: ReactNode }) {
  return (
    <div className="mt-1 text-xs font-normal italic text-zinc-500 print:hidden">
      {children}
    </div>
  );
}

/** Helper banner that sits below a section header to explain what it is for. */
export function HintBanner({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-zinc-200 bg-blue-50/60 px-3 py-1.5 text-xs italic text-zinc-600 print:hidden">
      {children}
    </div>
  );
}
