import React, { SelectHTMLAttributes } from 'react';
import { cn } from '../../utils/classNames';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: { value: string | number; label: string }[];
    placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, label, error, options, placeholder = "Selecione", ...props }, ref) => {
        const baseSelectStyles = "w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all text-gray-900 font-medium disabled:bg-gray-100 disabled:text-gray-500 appearance-none";

        return (
            <div className="space-y-1.5 w-full">
                {label && (
                    <label className="text-sm font-semibold text-slate-300 ml-1 block">
                        {label}
                    </label>
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
                    <div className="absolute right-3 top-4 pointer-events-none text-gray-500">
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
