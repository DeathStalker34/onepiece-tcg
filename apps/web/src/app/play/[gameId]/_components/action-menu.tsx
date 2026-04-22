'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ActionMenuOption {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ActionMenu({
  title,
  options,
  open,
  onOpenChange,
}: {
  title: string;
  options: ActionMenuOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <Button
              key={opt.label}
              variant="secondary"
              disabled={opt.disabled}
              onClick={() => {
                opt.onClick();
                onOpenChange(false);
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
