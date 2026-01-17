# Generative AI Enhancements for StockFlow

This document captures practical, high-impact ways to integrate generative AI into StockFlow beyond the current “Generate product description” feature.

## Existing AI Foundation (Reusable)

- AI edge function with multi-provider fallback + per-organization daily limit + request logging:
  - [supabase/functions/generate-description/index.ts](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/supabase/functions/generate-description/index.ts)
- Reusable UI trigger and usage gating:
  - [src/components/shared/AiGeneratorButton.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/components/shared/AiGeneratorButton.tsx)
  - [src/contexts/AiUsageContext.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/contexts/AiUsageContext.tsx)
- Strong structured data sources (ideal AI context) already available via Dashboard/Reports RPCs:
  - [src/pages/Dashboard.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/Dashboard.tsx)
  - [src/pages/Reports.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/Reports.tsx)

## High-Impact AI Enhancements (Ranked)

### 1) Receipt/PDF → Expense Auto-Entry (AI extraction)

Problem solved: recording expenses is repetitive, slow, and error-prone.

User flow:
- User uploads a receipt (image/PDF) while adding an expense.
- Click “Extract from receipt”.
- AI returns structured fields to auto-fill: date, vendor, total, tax, suggested category/type, and a clean description.

Where it fits:
- Add a button in the expense flow: [src/pages/expenses/AddExpenseDialog.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/expenses/AddExpenseDialog.tsx)

How to implement (fits existing patterns):
- New edge function: extract-expense-from-receipt
  - Input: organizationId, attachmentUrl (and optionally branchId)
  - Output: structured JSON (single expense or multiple split items)
- Reuse existing organization_ai_usage + ai_request_logs patterns for rate limiting and auditability.

Why it’s a great fit:
- Expense attachments are already supported, including PDFs and images.
- This is immediately useful for real businesses.

### 2) AI Insights for Dashboard and Reports (narrative + actions)

Problem solved: users see numbers but still need “what should I do next?”

User flow:
- User clicks “AI Insights” on a dashboard card or report tab.
- AI returns:
  - a short summary in plain English
  - top risks (e.g., low stock, high debt, unusual expense spikes)
  - recommended actions (e.g., restock list, follow-up list)

Where it fits:
- Reports: [src/pages/Reports.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/Reports.tsx)
- Dashboard: [src/pages/Dashboard.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/Dashboard.tsx)

How to implement:
- New edge function: generate-report-insights
  - Input: reportType + report JSON already fetched by the UI
  - Output: structured JSON { summaryBullets, risks, actions }

Why it’s a great fit:
- Low engineering risk: the “context” is already computed and shaped by RPCs.
- High perceived value: turns stats into decisions.

### 3) Reorder Advisor (forecast + suggested reorder quantities)

Problem solved: overstock ties up cash; stockouts lose sales.

What it does:
- Estimates sales velocity per SKU using order history.
- Computes “days of stock remaining”.
- Suggests reorder quantities to reach a target coverage window (e.g., 14 or 30 days).

Recommended implementation approach:
- Start with deterministic calculation in a SQL RPC (fast, testable).
- Add AI on top for explanation and a prioritized “why these items” narrative.

Where it fits:
- Inventory low stock workflows: [src/pages/Inventory.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/Inventory.tsx)

### 4) AI-Assisted Discount Campaign Builder (goal-based)

Problem solved: discounts are powerful but hard to configure correctly.

User flow:
- User chooses a goal: “clear slow stock”, “increase revenue”, “win back customers”.
- AI suggests: discount type/value, duration, target selection, and a message template.

Where it fits:
- Discount creation/editing: [src/pages/inventory/components/CreateDiscountSheet.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/inventory/components/CreateDiscountSheet.tsx)

Optional synergy:
- Pair with SMS integration to push discount campaigns to selected customers.

### 5) Product Auto-Fill from Image/Label (vision)

Problem solved: product creation is time-consuming and error-prone.

User flow:
- User uploads product image.
- Click “Auto-fill from image”.
- AI extracts: product name, brand, pack size/unit, and suggests category + SKU format.

Where it fits:
- Product creation/edit flow: [src/pages/inventory/ProductForm.tsx](file:///c:/Users/USER/Desktop/DEV/FMT%20Software%20solutions/StockFlow/stock-flow/src/pages/inventory/ProductForm.tsx)

### 6) Customer Debt Follow-Up Assistant (SMS-ready)

Problem solved: collections takes time and writing consistent messages is hard.

What it does:
- Drafts polite, personalized payment reminders based on outstanding balances and dates.
- Proposes follow-up schedules and message variants.

Where it fits:
- Customers “owing” lists in reports and customer detail views.

Synergy:
- Directly supports the roadmap item “SMS integration”.

### 7) Natural Language Table Filtering (“show me…”) 

Problem solved: power users want quick answers without clicking filters.

User flow:
- User types: “show low stock items in Abuja branch updated in last 7 days”
- AI maps this into table filter controls and applies them.

Where it fits:
- Shared DataTable toolbar/filter sheet components.

## Suggested First Ship (Best ROI)

- Receipt/PDF → Expense auto-entry
- AI Insights on Reports (fast to build; immediately useful)
