import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Bell, Palette, Shield, Download, Plus, Package, Tags, Layers, ShoppingCart, Users, Truck, DollarSign } from 'lucide-react';
import { useRoleCheck } from '@/components/auth/RoleGuard';
import { navItems } from '@/config/navigation';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from '@/components/ui/command';
import { isElectron } from '@/utils/asset-path';
import { useSearchStore } from '@/stores/searchStore';

export function GlobalSearch() {
    const { isOpen, setIsOpen, toggleOpen } = useSearchStore();
    const navigate = useNavigate();
    const { checkPermission } = useRoleCheck();
    const isDev = import.meta.env.DEV;

    const handleSelect = useCallback(
        (path: string) => {
            setIsOpen(false);
            navigate(path);
        },
        [navigate, setIsOpen]
    );

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                toggleOpen();
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [toggleOpen]);

    const filteredNavItems = navItems.filter((item) => {
        if (item.devOnly && !isDev) return false;
        if (item.permission) {
            return checkPermission(item.permission.scope, item.permission.action);
        }
        return true;
    });

    const canManageOrgDetails = checkPermission('settings', 'manage_org_details');
    const canViewAppearance = checkPermission('settings', 'view_org_appearance_prefs');
    const canManageRoles = checkPermission('user_management', 'create') || checkPermission('user_management', 'edit');
    const canManageNotifications = checkPermission('settings', 'manage_notifications');

    const canCreateProduct = checkPermission('products', 'create');
    const canCreateOrder = checkPermission('orders', 'create');
    const canCreateCustomer = checkPermission('customers', 'create');
    const canCreateSupplier = checkPermission('suppliers', 'create');

    const canViewProducts = checkPermission('products');
    const canViewCategories = checkPermission('product_categories');
    const canViewVariations = checkPermission('variations');
    const canViewReports = checkPermission('reports');

    return (
        <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
            <CommandInput placeholder="Type a command or search..." />
            <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>

                <CommandGroup heading="Pages">
                    {filteredNavItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <CommandItem
                                key={item.to}
                                onSelect={() => handleSelect(item.to)}
                                className="flex items-center gap-2"
                            >
                                <Icon className="h-4 w-4" />
                                <span>{item.label}</span>
                            </CommandItem>
                        );
                    })}
                </CommandGroup>

                {canViewReports && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Reports">
                            <CommandItem onSelect={() => handleSelect('/reports?tab=products')} className="flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                <span>Products Report</span>
                            </CommandItem>
                            <CommandItem onSelect={() => handleSelect('/reports?tab=inventory')} className="flex items-center gap-2">
                                <Layers className="h-4 w-4" />
                                <span>Inventory Report</span>
                            </CommandItem>
                            <CommandItem onSelect={() => handleSelect('/reports?tab=sales_orders')} className="flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4" />
                                <span>Sales & Orders Report</span>
                            </CommandItem>
                            <CommandItem onSelect={() => handleSelect('/reports?tab=expenses')} className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                <span>Expenses Report</span>
                            </CommandItem>
                            <CommandItem onSelect={() => handleSelect('/reports?tab=customers')} className="flex items-center gap-2">
                                <Users className="h-4 w-4" />
                                <span>Customers Report</span>
                            </CommandItem>
                            <CommandItem onSelect={() => handleSelect('/reports?tab=suppliers')} className="flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                <span>Suppliers Report</span>
                            </CommandItem>
                        </CommandGroup>
                    </>
                )}

                {(canCreateOrder || canCreateProduct || canCreateCustomer || canCreateSupplier) && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Quick Actions">
                            {canCreateOrder && (
                                <CommandItem onSelect={() => handleSelect('/orders/new')} className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span>Create Order / Sale</span>
                                </CommandItem>
                            )}
                            {canCreateProduct && (
                                <CommandItem onSelect={() => handleSelect('/products/new')} className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span>Create Product</span>
                                </CommandItem>
                            )}
                            {canCreateCustomer && (
                                <CommandItem onSelect={() => handleSelect('/customers/new')} className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span>Create Customer</span>
                                </CommandItem>
                            )}
                            {canCreateSupplier && (
                                <CommandItem onSelect={() => handleSelect('/suppliers/new')} className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    <span>Create Supplier</span>
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </>
                )}

                {(canViewProducts || canViewCategories || canViewVariations) && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Products">
                            {canViewProducts && (
                                <CommandItem onSelect={() => handleSelect('/products?tab=products')} className="flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    <span>Product List</span>
                                </CommandItem>
                            )}
                            {canViewCategories && (
                                <CommandItem onSelect={() => handleSelect('/products?tab=categories')} className="flex items-center gap-2">
                                    <Tags className="h-4 w-4" />
                                    <span>Product Categories</span>
                                </CommandItem>
                            )}
                            {canViewVariations && (
                                <CommandItem onSelect={() => handleSelect('/products?tab=variations')} className="flex items-center gap-2">
                                    <Layers className="h-4 w-4" />
                                    <span>Product Variations</span>
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </>
                )}

                <CommandSeparator />

                <CommandGroup heading="Account & Organization">
                    <CommandItem onSelect={() => handleSelect('/profile')} className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Profile</span>
                    </CommandItem>
                    <CommandItem onSelect={() => handleSelect('/select-organization')} className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>Organization Selector</span>
                    </CommandItem>
                </CommandGroup>

                {(canManageOrgDetails || canViewAppearance || canManageRoles || canManageNotifications || isElectron()) && (
                    <>
                        <CommandSeparator />
                        <CommandGroup heading="Settings">
                            {canManageOrgDetails && (
                                <CommandItem onSelect={() => handleSelect('/settings?tab=organization')} className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4" />
                                    <span>Organization Details</span>
                                </CommandItem>
                            )}
                            {canViewAppearance && (
                                <CommandItem onSelect={() => handleSelect('/settings?tab=appearance')} className="flex items-center gap-2">
                                    <Palette className="h-4 w-4" />
                                    <span>Appearance</span>
                                </CommandItem>
                            )}
                            {canManageRoles && (
                                <CommandItem onSelect={() => handleSelect('/settings?tab=roles')} className="flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    <span>Roles and Permissions</span>
                                </CommandItem>
                            )}
                            {canManageNotifications && (
                                <CommandItem onSelect={() => handleSelect('/settings?tab=notifications')} className="flex items-center gap-2">
                                    <Bell className="h-4 w-4" />
                                    <span>Notifications</span>
                                </CommandItem>
                            )}
                            {isElectron() && (
                                <CommandItem onSelect={() => handleSelect('/settings?tab=updates')} className="flex items-center gap-2">
                                    <Download className="h-4 w-4" />
                                    <span>Updates</span>
                                </CommandItem>
                            )}
                        </CommandGroup>
                    </>
                )}
            </CommandList>
        </CommandDialog>
    );
}