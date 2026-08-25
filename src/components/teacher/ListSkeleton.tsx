import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholder for the teacher list screens (templates, questions,
 * grading, stuck). Mirrors the card-row layout those lists render so the
 * page doesn't reflow when real data arrives.
 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul className="flex flex-col gap-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i}>
          <Card className="flex flex-row items-center gap-4 rounded-2xl px-4 py-3.5">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </Card>
        </li>
      ))}
    </ul>
  );
}
