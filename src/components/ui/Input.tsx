
import React, { InputHTMLAttributes, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import InputMask from 'react-input-mask';
import { cn } from '../../utils/classNames';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    labelRight?: React.ReactNode;
    error?: string;
    rightElement?: React.ReactNode;
    mask?: string;
    maskChar?: string | null;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, labelRight, error, type = 'text', rightElement, mask, maskChar, ...props }, ref) => {
        const [showPassword, setShowPassword] = useState(false);
        const isPassword = type === 'password';

        const baseInputStyles =
            "w-full min-h-[var(--platform-touch-target)] touch-manipulation rounded-[var(--radius)] border border-white/20 bg-white/95 px-4 py-3.5 text-[15px] font-medium text-[#25194a] outline-none transition-all duration-200 placeholder:text-gray-500 focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500";

        const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;
        const inputClassName = cn(
            baseInputStyles,
            (!!isPassword || !!rightElement) && "pr-10",
            error && "border-red-400 focus:ring-red-400",
            className
        );

        const MaskedInputComponent = InputMask as unknown as React.ComponentType<
            InputHTMLAttributes<HTMLInputElement> & {
                mask: string;
                maskChar?: string | null;
                inputRef?: React.Ref<HTMLInputElement>;
            }
        >;

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
                    {mask ? (
                        <MaskedInputComponent
                            {...props}
                            mask={mask}
                            maskChar={maskChar}
                            inputRef={ref}
                            type={inputType}
                            className={inputClassName}
                        />
                    ) : (
                        <input
                            {...props}
                            ref={ref}
                            type={inputType}
                            className={inputClassName}
                        />
                    )}

                    {isPassword && (
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3.5 text-gray-500 transition-colors hover:text-purple-700"
                            tabIndex={-1}
                        >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                    )}

                    {!isPassword && rightElement && (
                        <div className="absolute right-3 top-3.5 text-gray-400 pointer-events-none">
                            {rightElement}
                        </div>
                    )}
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

Input.displayName = "Input";
