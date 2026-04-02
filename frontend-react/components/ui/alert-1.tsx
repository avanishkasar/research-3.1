"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button1 } from "@/components/ui/button-1";

const alertVariants = cva("flex w-full items-start gap-2 rounded-lg border p-3", {
  variants: {
    variant: {
      primary: "bg-blue-50 text-blue-900 border-blue-200",
      success: "bg-green-50 text-green-900 border-green-200",
      destructive: "bg-red-50 text-red-900 border-red-200",
      info: "bg-violet-50 text-violet-900 border-violet-200",
      warning: "bg-amber-50 text-amber-900 border-amber-200",
      secondary: "bg-muted text-foreground border-border",
    },
  },
  defaultVariants: {
    variant: "secondary",
  },
});

interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  close?: boolean;
  onClose?: () => void;
}

export function Alert({ className, variant, close, onClose, children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <div className="flex-1">{children}</div>
      {close && (
        <Button1 variant="inverse" mode="icon" onClick={onClose} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </Button1>
      )}
    </div>
  );
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h4 className={cn("text-sm font-semibold", className)} {...props} />;
}

export function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1 text-xs", className)} {...props} />;
}
