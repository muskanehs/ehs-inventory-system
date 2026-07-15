import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { SessionBootstrap } from "@/components/SessionBootstrap";
import { useAuthStore } from "@/store/auth";
import LoginPage from "@/pages/LoginPage";
import ChangePasswordPage from "@/pages/auth/ChangePasswordPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import VerifyOtpPage from "@/pages/auth/VerifyOtpPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";

import { Skeleton } from "@/components/ui/skeleton";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const InventoryPage = lazy(() => import("@/pages/InventoryPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
const TransfersPage = lazy(() => import("@/pages/TransfersPage"));
const ActivityPage = lazy(() => import("@/pages/ActivityPage"));
const GodownsPage = lazy(() => import("@/pages/GodownsPage"));

function PageFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const profileLoading = useAuthStore((s) => s.profileLoading);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const location = useLocation();

  if (!hasHydrated || profileLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-4 w-32" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  return children;
}

function GodownHomeRedirect() {
  const role = useAuthStore((s) => s.role);
  if (role === "GODOWN_MANAGER") {
    return <Navigate to="/inventory" replace />;
  }
  return <DashboardPage />;
}

function RoleGuard({
  children,
  allowed
}: {
  children: JSX.Element;
  allowed: Array<"ADMIN" | "STORE_MANAGER" | "GODOWN_MANAGER" | "STAFF">;
}) {
  const role = useAuthStore((s) => s.role);
  if (!role || !allowed.includes(role)) {
    return <Navigate to="/inventory" replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
      <SessionBootstrap />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/forgot-password/verify" element={<VerifyOtpPage />} />
          <Route path="/forgot-password/reset" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<GodownHomeRedirect />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/products" element={<Navigate to="/inventory" replace />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/transfers" element={<TransfersPage />} />
            <Route
              path="/activity"
              element={
                <RoleGuard allowed={["ADMIN", "STORE_MANAGER"]}>
                  <ActivityPage />
                </RoleGuard>
              }
            />
            <Route path="/reports" element={<Navigate to="/" replace />} />
            <Route path="/godowns" element={<GodownsPage />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
