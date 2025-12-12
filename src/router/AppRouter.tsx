import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthRoute } from '../components/auth/AuthRoute';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';
import { AuthProvider } from '../contexts/AuthContext';
import { OrganizationProvider } from '../contexts/OrganizationContext';
import { BranchProvider } from '../contexts/BranchContext';
import { PaletteProvider } from '../contexts/PaletteContext';

// Auth pages
import { Login } from '../pages/auth/Login';
import { NewPassword } from '../pages/auth/NewPassword';
import { PasswordReset } from '../pages/auth/PasswordReset';

// Organization pages
import { OrganizationSelection } from '../pages/OrganizationSelection';

// Protected pages
import { Branches } from '../pages/Branches';
import { Dashboard } from '../pages/Dashboard';
import { Profile } from '../pages/Profile';
import { Settings } from '../pages/Settings';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { OrganizationSelectionProtectedRoute } from '@/components/auth/OrganizationSelectionProtectedRoute';
import UserManagement from '@/pages/UserManagement';
import UserDetails from '@/pages/UserDetails';

function AppRoutes() {
  return (
    <Routes>
      {/* Public/Auth routes */}
      <Route
        path="/login"
        element={
          <AuthRoute>
            <Login />
          </AuthRoute>
        }
      />
      <Route
        path="/password-reset"
        element={
          <AuthRoute>
            <PasswordReset />
          </AuthRoute>
        }
      />
      <Route
        path="/new-password"
        element={
          <AuthRoute>
            <NewPassword />
          </AuthRoute>
        }
      />

      {/* Organization selection route */}
      <Route
        path="/select-organization"
        element={
          <ProtectedRoute>
            <OrganizationSelection />
          </ProtectedRoute>
        }
      />

      {/* Protected routes with layout - requires organization */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <OrganizationSelectionProtectedRoute>
              <MainLayout />
            </OrganizationSelectionProtectedRoute>
          </ProtectedRoute>
        }
      >
        {/* Dashboard - default route */}
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Main application routes */}
        <Route
          path="branches"
          element={
            <PermissionGuard scope="branch_management">
              <Branches />
            </PermissionGuard>
          }
        />
        <Route path="profile" element={<Profile />} />
        <Route
          path="user-management"
          element={
            <PermissionGuard scope="user_management">
              <UserManagement />
            </PermissionGuard>
          }
        />
        <Route
          path="users/:userId"
          element={
            <PermissionGuard scope="user_management">
              <UserDetails />
            </PermissionGuard>
          }
        />
        <Route
          path="settings"
          element={
            <PermissionGuard scope="settings">
              <Settings />
            </PermissionGuard>
          }
        />
      </Route>

      {/* Catch-all route - redirect to dashboard if authenticated, login if not */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export function AppRouter() {
  return (
    <HashRouter>
      <AuthProvider>
        <OrganizationProvider>
          <BranchProvider>
            <PaletteProvider>
              <AppRoutes />
            </PaletteProvider>
          </BranchProvider>
        </OrganizationProvider>
      </AuthProvider>
    </HashRouter>
  );
}
