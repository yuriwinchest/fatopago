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
    const baseStyles = "font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-70 group";

    const variants = {
        primary: "bg-[#B084FF] hover:bg-[#9D5CFF] text-[#2c1a59] hover:text-white shadow-lg shadow-[#9D5CFF]/20 focus:ring-[#9D5CFF]",
        secondary: "bg-white/10 hover:bg-white/20 text-white border border-white/5 focus:ring-purple-500",
        ghost: "hover:bg-white/5 text-slate-300 hover:text-white focus:ring-purple-500",
        link: "text-[#B084FF] hover:underline p-0 h-auto font-bold"
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
