
import React from 'react';
import { Button, ButtonProps } from "./button";
import { cn } from "@/lib/utils";

interface TouchButtonProps extends ButtonProps {
  touchFriendly?: boolean;
}

const TouchButton = React.forwardRef<HTMLButtonElement, TouchButtonProps>(
  ({ className, touchFriendly = false, ...props }, ref) => {
    return (
      <Button
        className={cn(
          touchFriendly && "min-h-[44px] min-w-[44px] text-base",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

TouchButton.displayName = "TouchButton";

export { TouchButton };
