import type { ExportField } from '@/hooks/useExport';
import type { Category, Product } from '@/types/inventory';

export const getCategoryExportFields = (products: Product[]): ExportField[] => [
  { id: 'image', label: 'Image', isSelectedByDefault: false, type: 'image' },
  { id: 'name', label: 'Name' },
  { id: 'description', label: 'Description' },
  {
    id: 'productCount',
    label: 'Product Count',
    accessorFn: (category: Category) =>
      products.filter(
        (p) => p.categoryId === category.id || p.category?.id === category.id
      ).length,
  },
];
