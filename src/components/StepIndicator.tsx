import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  steps: string[];
  current: number; // 0-based
}

export default function StepIndicator({ steps, current }: Props) {
  return (
    <ol className="flex w-full items-center gap-2 sm:gap-4">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-3 min-w-0">
            <div
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                done && "bg-primary border-primary text-primary-foreground",
                active && "border-primary text-primary bg-primary/10",
                !done && !active && "border-border text-muted-foreground bg-background"
              )}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-medium",
                  active ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </p>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("h-px flex-1 transition-colors", done ? "bg-primary" : "bg-border")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
