import type { Category } from "@/types/inventory";

export const mockCategories: Category[] = [
    {
        id: "1",
        name: "Electronics",
        description: "Latest gadgets and devices",
        image: "https://placehold.co/400x300?text=Electronics",
        productCount: 15
    },
    {
        id: "2",
        name: "Laptops",
        description: "High performance computers",
        image: "https://placehold.co/400x300?text=Laptops",
        productCount: 8
    },
    {
        id: "3",
        name: "Tablets",
        description: "Portable touchscreen devices",
        image: "https://placehold.co/400x300?text=Tablets",
        productCount: 5
    },
    {
        id: "4",
        name: "Audio",
        description: "Headphones and speakers",
        image: "https://placehold.co/400x300?text=Audio",
        productCount: 12
    }
];
