import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const variants = {
  primary: "bg-accent/90 hover:bg-accent text-atlas-navy-1 font-semibold border border-accent/50",
  outline: "border border-border text-text-muted hover:bg-card-hover hover:text-text-primary hover:border-border-light",
  danger: "bg-atlas-red/10 text-atlas-red hover:bg-atlas-red/20 border border-atlas-red/20",
  ghost: "text-text-muted hover:text-text-primary hover:bg-card-hover",
};

const sizes = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-wide transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export default Button;
