import { StockListTable } from './LowStockTable';
import type { StockListItem } from './stockItems';

export function OutOfStockTable(props: { products: StockListItem[]; groupByCategory: boolean }) {
  return <StockListTable {...props} emptyText="No out of stock products." />;
}
