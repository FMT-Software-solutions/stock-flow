import type { Customer } from "@/types/inventory";


export const mockCustomers: Customer[] = [
    {
        id: "101",
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+1 (555) 123-4567",
        address: "123 Main St, New York, NY 10001",
        totalOrders: 15,
        totalSpent: 2500.50,
        lastOrderDate: "2023-10-01T10:30:00Z"
    },
    {
        id: "102",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@example.com",
        phone: "+1 (555) 987-6543",
        address: "456 Oak Ave, Los Angeles, CA 90001",
        totalOrders: 8,
        totalSpent: 1200.75,
        lastOrderDate: "2023-10-02T14:15:00Z"
    },
    {
        id: "103",
        firstName: "Bob",
        lastName: "Johnson",
        email: "bob.j@example.com",
        phone: "+1 (555) 456-7890",
        address: "789 Pine Ln, Chicago, IL 60601",
        totalOrders: 3,
        totalSpent: 450.00,
        lastOrderDate: "2023-09-25T09:00:00Z"
    },
    {
        id: "104",
        firstName: "Alice",
        lastName: "Brown",
        email: "alice.b@example.com",
        phone: "+1 (555) 222-3333",
        address: "321 Elm St, Houston, TX 60601",
        totalOrders: 22,
        totalSpent: 5600.25,
        lastOrderDate: "2023-10-04T16:45:00Z"
    },
    {
        id: "105",
        firstName: "Charlie",
        lastName: "Wilson",
        email: "charlie.w@example.com",
        phone: "+1 (555) 777-8888",
        address: "654 Maple Dr, Phoenix, AZ 85001",
        totalOrders: 5,
        totalSpent: 890.50,
        lastOrderDate: "2023-10-05T11:20:00Z"
    }
];
