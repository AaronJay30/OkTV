import { Switch } from "@/components/ui/switch";

interface AdminFeatureTogglesProps {
    name: string;
    enabled: boolean;
    experimental: boolean;
    disabled?: boolean;
    onEnabledChange: (enabled: boolean) => void;
    onExperimentalChange: (experimental: boolean) => void;
}

export function AdminFeatureToggles({
    name,
    enabled,
    experimental,
    disabled = false,
    onEnabledChange,
    onExperimentalChange,
}: AdminFeatureTogglesProps) {
    return (
        <div className="flex w-32 shrink-0 flex-col justify-center gap-2">
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    Enabled
                </span>
                <Switch
                    checked={enabled}
                    onCheckedChange={onEnabledChange}
                    aria-label={`Enable ${name}`}
                    disabled={disabled}
                />
            </div>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    Experimental
                </span>
                <Switch
                    checked={experimental}
                    onCheckedChange={onExperimentalChange}
                    aria-label={`Mark ${name} experimental`}
                    disabled={disabled}
                />
            </div>
        </div>
    );
}
