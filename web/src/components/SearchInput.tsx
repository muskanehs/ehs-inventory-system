import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  ariaLabel?: string;
} & Pick<React.InputHTMLAttributes<HTMLInputElement>, "onKeyDown">;

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
  id = "search",
  ariaLabel,
  onKeyDown
}: SearchInputProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70 transition-colors duration-200 peer-focus:text-primary/70"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="peer h-9 bg-surface pl-9"
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  );
}

export { FilterBar } from "@/components/ui/surface";
