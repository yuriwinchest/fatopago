import React, { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/classNames';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    labelRight?: React.ReactNode;
    error?: string;
    options: { value: string | number; label: string }[];
    placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, labelRight, error, options, placeholder = "Selecione", ...props }, ref) => {
        const baseSelectStyles =
            "w-full min-h-[var(--platform-touch-target)] touch-manipulation appearance-none rounded-[var(--radius)] border border-white/20 bg-white/95 px-4 py-3.5 text-[15px] font-medium text-[#25194a] outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";

        return (
            <div className="space-y-1.5 w-full">
                {label && (
                    <div className="ml-1 flex items-center justify-between gap-4">
                        <label className="block text-sm font-semibold text-slate-300">
                            {label}
                        </label>
                        {labelRight && (
                            <div className="text-xs font-medium text-slate-300">
                                {labelRight}
                            </div>
                        )}
                    </div>
                )}

                <div className="relative">
                    <select
                        ref={ref}
                        className={cn(
                            baseSelectStyles,
                            error && "border-red-400 focus:ring-red-400",
                            className
                        )}
                        {...props}
                    >
                        <option value="" disabled>{placeholder}</option>
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {/* Chevron icon custom */}
                    <div className="pointer-events-none absolute right-3 top-4 text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>

                {error && (
                    <p className="text-xs text-red-400 ml-1 font-medium animate-in fade-in slide-in-from-top-1">
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

Select.displayName = "Select";
