import { cn } from "@/lib/utils";

export function ExperimentalBadge({
    experimental,
    className,
}: {
    experimental: boolean;
    className?: string;
}) {
    if (!experimental) return null;

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-semibold text-amber-200",
                className
            )}
        >
            Experimental
        </span>
    );
}
