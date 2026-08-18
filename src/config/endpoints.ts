/**
 * VITE_BACKEND_URL is baked in at build time and comes from gitignored env
 * files, so a build from a clean checkout or a second machine sees nothing.
 * Print Suite Pro shipped a release that way once — localhost:3001 compiled
 * into the installer, every SMS and purchase failing with "Failed to fetch"
 * against a server on the customer's own machine. Falling back to localhost
 * is only ever right in dev.
 */
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.DEV
    ? 'http://localhost:3001/api'
    : 'https://api.fmtsoftware.com/api');

export const APP_ID = 'stockflow'; //do not change this

export const API_ENDPOINTS = {
  SMS: {
    SEND_STANDARD: `${BACKEND_URL}/sms/send`,
    SEND_TEMPLATE: `${BACKEND_URL}/sms/send-template`,
    GET_DETAILS: (id: string) => `${BACKEND_URL}/sms/details/${id}`,
    NOTIFY_SENDER_ID: `${BACKEND_URL}/sms/sender-id/notify`,
  },
  PAYMENTS: {
    INITIALIZE_SMS_PURCHASE: `${BACKEND_URL}/payments/initialize-sms-purchase`,
    VERIFY_SMS_PURCHASE: `${BACKEND_URL}/payments/verify-sms-purchase`,
  }
};
