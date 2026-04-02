"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const button1Variants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        inverse: "bg-transparent text-current hover:bg-accent",
        outline: "border border-input bg-background hover:bg-accent",
      },
      mode: {
        default: "h-9 px-3",
        icon: "h-7 w-7 p-0",
        link: "h-auto p-0 bg-transparent underline-offset-4 hover:underline",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      mode: "default",
      size: "md",
    },
  },
);

export interface Button1Props extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button1Variants> {
  asChild?: boolean;
}

export function Button1({ className, variant, mode, size, asChild = false, ...props }: Button1Props) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(button1Variants({ variant, mode, size, className }))} {...props} />;
}
