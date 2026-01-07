import type { StatsGroup } from "@/types/stats";
import type { InventoryEntry } from "@/types/inventory";
import { Package, AlertTriangle, DollarSign } from "lucide-react";

export const getInventoryStatsGroups = (formatCurrency: (amount: number) => string, isOwner: boolean): StatsGroup<InventoryEntry>[] => [
    {
        id: "inventory_overview",
        title: "Inventory Overview",
        icon: Package,
        fields: [
            {
                id: "total_entries",
                label: "Total Entries",
                calculate: (data) => ({ value: data.length })
            },
            {
                id: "total_quantity",
                label: "Total Quantity",
                calculate: (data) => ({ value: data.reduce((acc, curr) => acc + curr.quantity, 0) })
            }
        ]
    },
    {
        id: "stock_alerts",
        title: "Stock Alerts",
        icon: AlertTriangle,
        fields: [
            {
                id: "low_stock",
                label: "Low Stock",
                calculate: (data) => ({
                    value: data.filter(i => i.quantity <= i.minStockLevel && i.quantity > 0).length
                }),
                className: "text-yellow-600"
            },
            {
                id: "out_of_stock",
                label: "Out of Stock",
                calculate: (data) => ({
                    value: data.filter(i => i.quantity <= 0).length
                }),
                className: "text-red-600"
            }
        ]
    },
    {
        id: "valuation",
        title: "Valuation",
        icon: DollarSign,
        fields: [
            {
                id: "total_value",
                label: "Total Inventory Value",
                calculate: (data) => {
                    const total = data.reduce((acc, curr) => {
                        const price = curr.priceOverride ?? curr.variantPrice ?? curr.productPrice ?? 0;
                        return acc + (curr.quantity * price);
                    }, 0);
                    return { value: formatCurrency(total) };
                }
            }
        ],
        isHidden: !isOwner,
    }
];
