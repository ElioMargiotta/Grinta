import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, id, className = "", ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
        >
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`h-10 rounded-lg border bg-white px-3 text-sm text-zinc-900 shadow-sm transition placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 dark:bg-zinc-900 dark:text-zinc-100 ${
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/15"
            : "border-zinc-200 hover:border-zinc-300 focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        } ${className}`}
        {...props}
      />
      {error ? (
        <span className="text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>
      ) : null}
    </div>
  ),
);
Input.displayName = "Input";
