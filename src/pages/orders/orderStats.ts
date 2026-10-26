import type { PeriodFigures } from '@/hooks/useDashboardSummary';
import { changeVs } from '@/lib/statTones';
import type { StatTile } from '@/types/stats';
import type { Order } from '@/types/orders';

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v ?? 0);
  return Number.isNaN(n) ? 0 : n;
};
const status = (o: Order) => String(o.status || '').toLowerCase();
const isVoid = (o: Order) => ['cancelled', 'canceled', 'refunded'].includes(status(o)) || o.payment_status === 'refunded';

export const OWED_FILTER = ['unpaid', 'partial'];
export const PENDING_FILTER = ['pending', 'processing'];

/**
 * The Sales & Orders figures. Sales leave out cancelled and refunded orders,
 * as the dashboard and reports do.
 */
export function getOrderStatTiles({
  orders,
  money,
  previous,
  prevLabel,
  isActive,
  toggle,
}: {
  orders: Order[];
  money: (n: number) => string;
  previous?: PeriodFigures | null;
  prevLabel?: string | null;
  isActive: (id: string, values: string[]) => boolean;
  toggle: (id: string, values: string[]) => void;
}): { tiles: StatTile[]; footnote: string | null } {
  const sales = orders.filter((o) => !isVoid(o));
  const voided = orders.filter(isVoid);
  const net = sales.reduce((s, o) => s + num(o.total_amount), 0);
  const paid = sales.reduce((s, o) => s + num(o.paid_amount), 0);
  const owing = sales.filter((o) => num(o.total_amount) > num(o.paid_amount));
  const owed = owing.reduce((s, o) => s + num(o.total_amount) - num(o.paid_amount), 0);
  const completed = sales.filter((o) => status(o) === 'completed').length;
  const pending = orders.filter((o) => PENDING_FILTER.includes(status(o))).length;
  const discounts = sales.reduce((s, o) => s + num(o.discount), 0);
  const avg = sales.length ? net / sales.length : 0;
  const prevAvg = previous && previous.orders ? previous.net / previous.orders : previous ? 0 : undefined;

  const netChange = changeVs(net, previous?.net, prevLabel);
  const ordersChange = changeVs(sales.length, previous?.orders, prevLabel);
  const avgChange = changeVs(avg, prevAvg, prevLabel);

  const tiles: StatTile[] = [
    { id: 'net', label: 'Net sales', value: money(net), sub: netChange?.text, subTone: netChange?.tone },
    {
      id: 'orders',
      label: 'Orders',
      value: sales.length.toLocaleString(),
      sub: ordersChange?.text ?? (sales.length ? `${Math.round((completed / sales.length) * 100)}% completed` : undefined),
      subTone: ordersChange?.tone,
    },
    { id: 'avg', label: 'Average sale', value: money(avg), sub: avgChange?.text, subTone: avgChange?.tone },
    {
      id: 'paid',
      label: 'Paid',
      value: money(paid),
      valueTone: 'cash',
      sub: net > 0 ? `${Math.round((paid / net) * 100)}% of sales` : undefined,
    },
    {
      id: 'owed',
      label: 'Owed',
      value: money(owed),
      valueTone: owed > 0 ? 'debt' : undefined,
      sub: owing.length ? `${owing.length} ${owing.length === 1 ? 'sale' : 'sales'}` : 'Nothing owed',
      onClick: () => toggle('paymentStatus', OWED_FILTER),
      active: isActive('paymentStatus', OWED_FILTER),
    },
    {
      id: 'pending',
      label: 'Pending',
      value: pending.toLocaleString(),
      valueTone: pending > 0 ? 'warn' : undefined,
      sub: pending ? 'Not completed yet' : 'None',
      onClick: () => toggle('status', PENDING_FILTER),
      active: isActive('status', PENDING_FILTER),
    },
  ];

  const notes = [
    voided.length
      ? `Cancelled or refunded: ${voided.length} (${money(voided.reduce((s, o) => s + num(o.total_amount), 0))})`
      : null,
    discounts > 0 ? `Discounts given: ${money(discounts)}` : null,
  ].filter(Boolean);

  return { tiles, footnote: notes.length ? notes.join(' · ') : null };
}
