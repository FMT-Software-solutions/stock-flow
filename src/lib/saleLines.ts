/**
 * A sale line is identified by one string. For stock-tracked products it is
 * the inventory row id (as it always was); for products that don't track
 * stock there is no inventory row, so the key names the product and variant.
 * Keeping one key lets discounts, drafts and quantity limits treat both kinds
 * of line the same way.
 */
const UNTRACKED_PREFIX = 'product:';

export function untrackedLineKey(productId: string, variantId?: string | null): string {
  return `${UNTRACKED_PREFIX}${productId}:${variantId ?? ''}`;
}

export function parseLineKey(key: string):
  | { inventoryId: string; productId: null; variantId: null }
  | { inventoryId: null; productId: string; variantId: string | null } {
  if (key.startsWith(UNTRACKED_PREFIX)) {
    const [productId, variantId] = key.slice(UNTRACKED_PREFIX.length).split(':');
    return { inventoryId: null, productId, variantId: variantId || null };
  }
  return { inventoryId: key, productId: null, variantId: null };
}

export const isUntrackedLine = (key: string) => key.startsWith(UNTRACKED_PREFIX);

/** "Tee" + {Size: "S"} → "Tee (Size: S)", the same shape stock rows use. */
export function lineProductName(name: string, attributes?: Record<string, string> | null, label?: string | null) {
  const attrs = Object.entries(attributes ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  const suffix = attrs || label;
  return suffix ? `${name} (${suffix})` : name;
}
