import { NavLink } from "react-router-dom";
import {
  ArrowLeftRight,
  Building2,
  CalendarClock,
  FolderTree,
  LayoutDashboard,
  Package,
  Warehouse
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: Role[];
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const navigation: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        roles: ["ADMIN", "STORE_MANAGER"]
      }
    ]
  },
  {
    title: "Inventory",
    items: [
      { label: "Stock", href: "/inventory", icon: Package },
      {
        label: "Categories",
        href: "/categories",
        icon: FolderTree,
        roles: ["ADMIN", "STORE_MANAGER"]
      }
    ]
  },
  {
    title: "Operations",
    items: [
      { label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
      {
        label: "Activity",
        href: "/activity",
        icon: CalendarClock,
        roles: ["ADMIN", "STORE_MANAGER"]
      }
    ]
  },
  {
    title: "Administration",
    items: [{ label: "Godowns", href: "/godowns", icon: Building2, roles: ["ADMIN"] }]
  }
];

function isItemVisible(item: NavItem, role: Role | null) {
  if (!item.roles) return true;
  return role !== null && item.roles.includes(role);
}

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const role = useAuthStore((s) => s.role);

  const visibleNavigation = navigation
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => isItemVisible(item, role))
    }))
    .filter((group) => group.items.length > 0);

  const linkClass = (isActive: boolean) =>
    cn(
      "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
      isActive
        ? "border border-primary/15 bg-primary-muted text-primary shadow-sm"
        : "text-muted-foreground hover:bg-primary-muted/70 hover:text-primary"
    );

  return (
    <aside
      className={cn(
        "flex h-full w-[240px] flex-col border-r border-sidebar-border bg-sidebar",
        className
      )}
    >
      <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b border-sidebar-border/60 px-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Warehouse className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight">Economic Hardware</p>
          <p className="truncate text-[11px] text-muted-foreground">Store</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2">
        <nav className="space-y-6 py-2" aria-label="Main navigation">
          {visibleNavigation.map((group) => (
            <div key={group.title}>
              <p className="mb-1.5 px-2.5 text-[11px] font-medium text-muted-foreground/70">
                {group.title}
              </p>
              <ul className="space-y-1">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      onClick={onNavigate}
                      className={({ isActive }) => linkClass(isActive)}
                    >
                      <item.icon
                        className="h-4 w-4 shrink-0 transition-colors duration-200 group-aria-[current=page]:text-primary"
                        aria-hidden="true"
                      />
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}
