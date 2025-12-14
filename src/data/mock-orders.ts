import { type Order } from "@/types/inventory";

export const mockOrders: Order[] = [
    {
        id: "1",
        orderNumber: "ORD-001",
        customerName: "John Doe",
        customerId: "101",
        date: "2023-10-01T10:30:00Z",
        status: "completed",
        totalAmount: 1199.00,
        paymentStatus: "paid",
        items: [
            {
                productId: "1",
                productName: "iPhone 14 Pro",
                quantity: 1,
                unitPrice: 999.00,
                total: 999.00
            },
            {
                productId: "4",
                productName: "AirPods Pro 2",
                quantity: 1,
                unitPrice: 200.00,
                total: 200.00
            }
        ]
    },
    {
        id: "2",
        orderNumber: "ORD-002",
        customerName: "Jane Smith",
        customerId: "102",
        date: "2023-10-02T14:15:00Z",
        status: "processing",
        totalAmount: 249.00,
        paymentStatus: "paid",
        items: [
            {
                productId: "4",
                productName: "AirPods Pro 2",
                quantity: 1,
                unitPrice: 249.00,
                total: 249.00
            }
        ]
    },
    {
        id: "3",
        orderNumber: "ORD-003",
        customerName: "Bob Johnson",
        customerId: "103",
        date: "2023-10-03T09:00:00Z",
        status: "pending",
        totalAmount: 1598.00,
        paymentStatus: "unpaid",
        items: [
            {
                productId: "3",
                productName: "iPad Pro 11\"",
                quantity: 2,
                unitPrice: 799.00,
                total: 1598.00
            }
        ]
    },
    {
        id: "4",
        orderNumber: "ORD-004",
        customerName: "Alice Brown",
        customerId: "104",
        date: "2023-10-04T16:45:00Z",
        status: "cancelled",
        totalAmount: 899.00,
        paymentStatus: "refunded",
        items: [
            {
                productId: "5",
                productName: "Samsung Galaxy S23",
                quantity: 1,
                unitPrice: 899.00,
                total: 899.00
            }
        ]
    },
    {
        id: "5",
        orderNumber: "ORD-005",
        customerName: "Charlie Wilson",
        customerId: "105",
        date: "2023-10-05T11:20:00Z",
        status: "completed",
        totalAmount: 2398.00,
        paymentStatus: "paid",
        items: [
            {
                productId: "2",
                productName: "MacBook Air M2",
                quantity: 2,
                unitPrice: 1199.00,
                total: 2398.00
            }
        ]
    }
];
