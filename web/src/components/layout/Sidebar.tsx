import { NavLink } from "react-router-dom";
import {
  ArrowLeftRight,
  Building2,
  CalendarClock,
  FolderTree,
  LayoutDashboard,
  Package,
  Warehouse,
  type LucideIcon
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
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
      "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors duration-150",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25",
      isActive
        ? "bg-primary-muted text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <aside
      className={cn(
        "flex h-full w-[248px] flex-col border-r border-sidebar-border bg-sidebar",
        className
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
          <Warehouse className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">
            Economic Hardware
          </p>
          <p className="truncate text-[11px] text-muted-foreground">Inventory</p>
        </div>
      </div>

      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-6 py-3" aria-label="Main navigation">
          {visibleNavigation.map((group) => (
            <div key={group.title}>
              <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground/80">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      to={item.href}
                      onClick={onNavigate}
                      className={({ isActive }) => linkClass(isActive)}
                    >
                      <item.icon
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 transition-colors duration-150",
                          "group-aria-[current=page]:text-primary"
                        )}
                        strokeWidth={1.75}
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
