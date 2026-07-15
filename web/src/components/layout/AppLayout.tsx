import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/sidebar";

export function AppLayout() {
  const collapsed = useSidebarStore((s) => s.collapsed);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <div
        className={cn(
          "hidden h-full shrink-0 overflow-hidden transition-[width] duration-200 ease-out md:block",
          collapsed ? "w-0" : "w-[248px]"
        )}
      >
        <Sidebar className="sticky top-0 h-[100dvh]" />
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
