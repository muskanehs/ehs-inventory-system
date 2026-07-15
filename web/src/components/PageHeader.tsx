import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className
}: PageHeaderProps) {
  return (
    <header className={cn("animate-fade-in", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2.5 flex items-center gap-1 text-xs text-muted-foreground"
        >
          {breadcrumbs.map((item, index) => (
            <span key={item.label} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 opacity-40" aria-hidden="true" />}
              {item.href ? (
                <Link to={item.href} className="transition-colors duration-150 hover:text-primary">
                  {item.label}
                </Link>
              ) : (
                <span className="font-medium text-foreground">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-balance text-[1.65rem] font-semibold tracking-tight text-foreground sm:text-[1.85rem] sm:leading-tight">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
    </header>
  );
}
