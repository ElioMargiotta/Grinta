"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { AtSign, Mail, Search, UserCircle } from "lucide-react";
import {
  searchAccountDirectoryAction,
  type AccountDirectoryResult,
} from "@/app/[locale]/account-directory-actions";

export function AccountDirectoryInput({
  name,
  label,
  hint,
  placeholder,
  required = false,
  className = "",
  inputClassName = "",
  defaultValue = "",
  value: controlledValue,
  onValueChange,
}: {
  name: string;
  label: string;
  hint?: string;
  placeholder: string;
  required?: boolean;
  className?: string;
  inputClassName?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const listId = useId();
  const [value, setValue] = useState(defaultValue);
  const [results, setResults] = useState<AccountDirectoryResult[]>([]);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const currentValue = controlledValue ?? value;
  const isEmail = currentValue.includes("@") && !currentValue.trim().startsWith("@");
  const canSearch = currentValue.trim().length >= 2 && !isEmail;
  const visibleResults = canSearch ? results : [];

  useEffect(() => {
    const q = currentValue.trim();
    if (q.length < 2 || isEmail) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const rows = await searchAccountDirectoryAction(q);
        if (!cancelled) {
          setResults(rows);
          setOpen(rows.length > 0);
        }
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentValue, isEmail]);

  function updateValue(next: string) {
    if (controlledValue === undefined) setValue(next);
    if (
      next.trim().length < 2 ||
      (next.includes("@") && !next.trim().startsWith("@"))
    ) {
      setResults([]);
      setOpen(false);
    }
    onValueChange?.(next);
  }

  return (
    <label className={`relative flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      <div className="relative">
        {isEmail ? (
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        ) : (
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        )}
        <input
          name={name}
          value={currentValue}
          onChange={(e) => updateValue(e.target.value)}
          onFocus={() => setOpen(results.length > 0)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          required={required}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          className={`${inputClassName} pl-9`}
        />
      </div>
      {hint && <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</span>}

      {open && visibleResults.length > 0 && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
        >
          {visibleResults.map((account) => (
            <button
              key={account.userId}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                updateValue(`@${account.username}`);
                setOpen(false);
              }}
              className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <UserCircle className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {account.fullName || `@${account.username}`}
                </span>
                <span className="flex items-center gap-1 text-xs text-zinc-500">
                  <AtSign className="h-3 w-3" />
                  {account.username}
                </span>
              </span>
            </button>
          ))}
          {isPending && (
            <div className="px-3 py-2 text-xs text-zinc-500">...</div>
          )}
        </div>
      )}
    </label>
  );
}
