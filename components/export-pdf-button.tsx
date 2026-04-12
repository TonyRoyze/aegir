"use client"

import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"

interface ExportPdfButtonProps {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  label?: string;
}

export function ExportPdfButton({ 
  variant = 'default',
  size = 'default',
  className = '',
  label = 'Print'
}: ExportPdfButtonProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Button 
      onClick={handlePrint} 
      variant={variant}
      size={size}
      className={`gap-2 font-semibold shadow-sm print:hidden ${className}`}
    >
      <Printer className="w-4 h-4" />
      {label}
    </Button>
  );
}
