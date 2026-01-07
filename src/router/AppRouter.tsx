import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthRoute } from '../components/auth/AuthRoute';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { MainLayout } from '../components/layout/MainLayout';
import { AuthProvider } from '../contexts/AuthContext';
import { OrganizationProvider } from '../contexts/OrganizationContext';
import { BranchProvider } from '../contexts/BranchContext';
import { PaletteProvider } from '../contexts/PaletteContext';
import { AiUsageProvider } from '../contexts/AiUsageContext';

// Auth pages
import { Login } from '../pages/auth/Login';
import { NewPassword } from '../pages/auth/NewPassword';
import { PasswordReset } from '../pages/auth/PasswordReset';

// Organization pages
import { OrganizationSelection } from '../pages/OrganizationSelection';

// Protected pages
import { Branches } from '../pages/Branches';
import { Dashboard } from '../pages/Dashboard';
import { Inventory } from '../pages/Inventory';
import { ProductForm } from '../pages/inventory/ProductForm';
import { ProductDetails } from '../pages/inventory/ProductDetails';
import { InventoryItemDetails } from '../pages/inventory/InventoryItemDetails';
import { Orders } from '../pages/Orders';
import { OrderForm } from '../pages/orders/OrderForm';
import { Customers } from '../pages/Customers';
import { CustomerForm } from '../pages/customers/CustomerForm';
import CustomerDetails from '../pages/customers/CustomerDetails';
import { Suppliers } from '../pages/Suppliers';
import { SupplierForm } from '../pages/suppliers/SupplierForm';
import { Reports } from '../pages/Reports';
import { Expenses } from '../pages/Expenses';
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
        <Route
          path="inventory"
          element={
            <PermissionGuard scope="inventory">
              <Inventory />
            </PermissionGuard>
          }
        />
        <Route
          path="inventory/new"
          element={
            <PermissionGuard scope="products" action="create">
              <ProductForm />
            </PermissionGuard>
          }
        />
        <Route
          path="inventory/entry/:id"
          element={
            <PermissionGuard scope="inventory">
              <InventoryItemDetails />
            </PermissionGuard>
          }
        />
        <Route
          path="inventory/:id"
          element={
            <PermissionGuard scope="products">
              <ProductDetails />
            </PermissionGuard>
          }
        />
        <Route
          path="inventory/:id/edit"
          element={
            <PermissionGuard scope="products" action="edit">
              <ProductForm />
            </PermissionGuard>
          }
        />
        <Route
          path="orders"
          element={
            <PermissionGuard scope="orders">
              <Orders />
            </PermissionGuard>
          }
        />
        <Route
          path="orders/new"
          element={
            <PermissionGuard scope="orders" action="create">
              <OrderForm />
            </PermissionGuard>
          }
        />
        <Route
          path="orders/:id"
          element={
            <PermissionGuard scope="orders" action="edit">
              <OrderForm />
            </PermissionGuard>
          }
        />
        <Route
          path="orders/:id/edit"
          element={
            <PermissionGuard scope="orders" action="edit">
              <OrderForm />
            </PermissionGuard>
          }
        />
        <Route
          path="customers"
          element={
            <PermissionGuard scope="customers">
              <Customers />
            </PermissionGuard>
          }
        />
        <Route
          path="customers/new"
          element={
            <PermissionGuard scope="customers" action="create">
              <CustomerForm />
            </PermissionGuard>
          }
        />
        <Route
          path="customers/:id"
          element={
            <PermissionGuard scope="customers" action="edit">
              <CustomerForm />
            </PermissionGuard>
          }
        />
        <Route
          path="customers/details/:id"
          element={
            <PermissionGuard scope="customers">
              <CustomerDetails />
            </PermissionGuard>
          }
        />
        <Route
          path="suppliers"
          element={
            <PermissionGuard scope="suppliers">
              <Suppliers />
            </PermissionGuard>
          }
        />
        <Route
          path="suppliers/new"
          element={
            <PermissionGuard scope="suppliers" action="create">
              <SupplierForm />
            </PermissionGuard>
          }
        />
        <Route
          path="suppliers/:id"
          element={
            <PermissionGuard scope="suppliers" action="edit">
              <SupplierForm />
            </PermissionGuard>
          }
        />
        <Route
          path="reports"
          element={
            <PermissionGuard scope="reports">
              <Reports />
            </PermissionGuard>
          }
        />
        <Route
          path="expenses"
          element={
            <PermissionGuard scope="expenses">
              <Expenses />
            </PermissionGuard>
          }
        />

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
          <AiUsageProvider>
            <BranchProvider>
              <PaletteProvider>
                <AppRoutes />
              </PaletteProvider>
            </BranchProvider>
          </AiUsageProvider>
        </OrganizationProvider>
      </AuthProvider>
    </HashRouter>
  );
}
