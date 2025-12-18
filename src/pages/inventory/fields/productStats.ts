import type { StatsGroup } from "@/types/stats";
import type { Product } from "@/types/inventory";
import { Box, AlertTriangle, XCircle, DollarSign, Layers } from "lucide-react";

export const getProductStatsGroups = (formatCurrency: (amount: number) => string): StatsGroup<Product>[] => [
  {
    id: "overview",
    title: "Product Overview",
    icon: Box,
    fields: [
      {
        id: "total",
        label: "Total Products",
        calculate: (data) => ({ value: data.length }),
      },
      {
        id: "active",
        label: "Active",
        calculate: (data) => ({ 
            value: data.filter(p => p.status === 'published').length,
            subValue: `${((data.filter(p => p.status === 'published').length / (data.length || 1)) * 100).toFixed(0)}%`
        }),
        className: "text-green-600"
      },
      {
        id: "draft",
        label: "Draft",
        calculate: (data) => ({ value: data.filter(p => p.status === 'draft').length }),
      }
    ]
  },
  {
    id: "stock",
    title: "Stock Status",
    icon: Layers,
    fields: [
      {
        id: "total_stock",
        label: "Total Items",
        calculate: (data) => ({ value: data.reduce((acc, curr) => acc + (curr.quantity || 0), 0) }),
      },
      {
        id: "low_stock",
        label: "Low Stock",
        icon: AlertTriangle,
        calculate: (data) => ({ 
            value: data.filter(p => (p.quantity || 0) <= (p.minStockLevel || 0) && (p.quantity || 0) > 0).length 
        }),
        className: "text-yellow-600"
      },
      {
        id: "out_of_stock",
        label: "Out of Stock",
        icon: XCircle,
        calculate: (data) => ({ 
            value: data.filter(p => (p.quantity || 0) <= 0).length 
        }),
        className: "text-red-600"
      }
    ]
  },
  {
    id: "financials",
    title: "Financials",
    icon: DollarSign,
    fields: [
      {
        id: "total_value",
        label: "Total Value",
        calculate: (data) => {
            const total = data.reduce((acc, curr) => acc + ((curr.quantity || 0) * (curr.sellingPrice || 0)), 0);
            return { value: formatCurrency(total) };
        },
      },
      {
        id: "avg_price",
        label: "Avg Price",
        calculate: (data) => {
             const total = data.reduce((acc, curr) => acc + (curr.sellingPrice || 0), 0);
             const avg = data.length ? total / data.length : 0;
             return { value: formatCurrency(avg) };
        }
      }
    ]
  }
];
