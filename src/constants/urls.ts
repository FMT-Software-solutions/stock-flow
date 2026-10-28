export const buyNowURL = `https://fmtsoftware.com/checkout/9eb786bd-1414-4eb7-8e9a-d093382ff34e`
export const contactSupportURL = `https://fmtsoftware.com/contact`

/**
 * The checkout with this organization's details filled in, so upgrading from
 * a trial is one form check and a payment. Paying with the same email makes
 * the existing organization a paid one.
 */
export function buyNowURLFor(organization?: { name?: string | null; email?: string | null; phone?: string | null } | null) {
  const params = new URLSearchParams()
  if (organization?.email) params.set('email', organization.email)
  if (organization?.name) params.set('org', organization.name)
  if (organization?.phone) params.set('phone', organization.phone)
  const query = params.toString()
  return query ? `${buyNowURL}?${query}` : buyNowURL
}
