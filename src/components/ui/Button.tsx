import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/classNames';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    isLoading?: boolean;
    variant?: 'primary' | 'secondary' | 'ghost' | 'link';
    fullWidth?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    className,
    isLoading,
    variant = 'primary',
    fullWidth = false,
    leftIcon,
    rightIcon,
    disabled,
    ...props
}) => {
    const baseStyles =
        "group inline-flex min-h-[var(--platform-touch-target)] items-center justify-center gap-2 rounded-[var(--radius)] px-5 py-3.5 font-bold transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--background))] disabled:cursor-not-allowed disabled:opacity-65";

    const variants = {
        primary:
            "bg-[hsl(var(--primary))] text-white shadow-[var(--platform-surface-shadow)] hover:brightness-110 active:translate-y-[1px]",
        secondary:
            "border border-[hsl(var(--border))] bg-white/10 text-white hover:bg-white/15 active:translate-y-[1px]",
        ghost:
            "text-slate-300 hover:bg-white/5 hover:text-white active:translate-y-[1px]",
        link:
            "min-h-0 rounded-none px-0 py-0 text-[hsl(var(--primary))] shadow-none hover:underline"
    };

    return (
        <button
            className={cn(
                baseStyles,
                variants[variant],
                fullWidth ? "w-full" : "w-auto",
                className
            )}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
            {!isLoading && leftIcon}
            {children}
            {!isLoading && rightIcon}
        </button>
    );
};
