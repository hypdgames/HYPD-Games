import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-lime text-black hover:bg-lime/90 font-bold rounded-[20px]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-[20px]",
        outline: "border border-border bg-transparent hover:bg-card hover:text-foreground rounded-pill",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-[20px]",
        ghost: "hover:bg-card hover:text-foreground rounded-[16px]",
        link: "text-primary underline-offset-4 hover:underline",
        gradient: "btn-gradient text-white font-bold rounded-[20px]",
        pill: "bg-muted text-foreground rounded-pill hover:bg-muted/80",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-9 rounded-[12px] px-3 text-xs",
        lg: "h-14 px-8 text-base",
        icon: "h-10 w-10 rounded-[16px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
