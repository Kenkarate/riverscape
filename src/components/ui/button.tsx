import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium tracking-wide transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-gold text-forest-dark hover:bg-gold-light shadow-lg shadow-gold/20 hover:shadow-xl hover:shadow-gold/30 hover:-translate-y-0.5",
        forest:
          "bg-forest text-cream hover:bg-forest-light shadow-lg hover:-translate-y-0.5",
        outline:
          "border border-cream/60 text-cream hover:bg-cream hover:text-forest backdrop-blur-sm",
        outlineDark:
          "border border-forest/30 text-forest hover:bg-forest hover:text-cream",
        ghost: "text-forest hover:bg-forest/5",
      },
      size: {
        sm: "h-9 px-5 text-xs",
        md: "h-11 px-7",
        lg: "h-14 px-9 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
