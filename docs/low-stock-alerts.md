# Low stock alerts — how they work today and what to fix

Reviewed 2026-10-26 (v1.1.8). Not fixed yet.

## How it works

- **Threshold:** `inventory.min_stock_level`, one number per stock row (product / variant or custom option / branch). Default 0.
- **Set from:** the product form's single "Low stock alert" field, which writes the same value to every stock row of the product (`save_product` `p_stock[].min_stock_level`) and shows the highest one when reopened. The old inventory details dialog can set one row.
- **Rule:** low = `0 < quantity <= min_stock_level`; out = `quantity <= 0`. A threshold of 0 never reports "low", only "out".
- **Shown in:**
  - Dashboard "Low Stock Items" card — `get_inventory_stats`, branch-filtered.
  - Dashboard Low Stock section, Inventory tab — rows low or out (`useInventoryEntries`), branch-filtered.
  - Dashboard Low Stock section, Products tab — `products_view.quantity` (sum over all branches) vs `MIN(min_stock_level)` of the product's rows; ignores the branch filter.
  - Stock on hand report (`get_inventory_report`) — low/out lists for items and products.
  - Inventory list badges and product page stock grid (amber = low, red = out, `stockTone`).

Production on 2026-10-26: 811 active stock rows, 63 with a threshold, 10 low, 278 out.

## Gaps

1. **No notifications.** Nothing reaches anyone (desktop, SMS, email); someone has to open the dashboard.
2. **New rows lose the alert.** Rows created by `find_or_create_stock_row` (stock tab cell on an empty branch, Add option, Add stock dialog, `adjust_stock`) start at 0 even when the product has an alert. Only the product form applies it to new rows.
3. **Product-level check is inconsistent.** Compares stock summed across all branches with a single row's threshold and ignores the branch filter, so a product can look fine while one branch is empty.
4. **No organization default** threshold, which is why most rows have none.
5. **No per-branch / per-option thresholds** in the new screens; one number per product only.

## Proposed fix

- Organization default threshold (Settings › Organization), used when a row has none.
- `find_or_create_stock_row` copies the product's alert (or the org default) onto new rows.
- Stock tab: set the alert per cell (branch × option) in the existing cell popover.
- Product-level low/out = "any branch row is low/out" within the selected branches, not the summed total.
- Optional daily alert: desktop notification (Electron main process) and/or SMS to owners/admins, listing low and out items per branch.
