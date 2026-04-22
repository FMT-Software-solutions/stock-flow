import { API_ENDPOINTS, APP_ID } from '@/config/endpoints';

export interface SmsRecipient {
  phone: string;
  [key: string]: any;
}

export interface SendSmsPayload {
  sender: string;
  message: string;
  recipients: SmsRecipient[];
  scheduledDate?: string;
  sandbox?: boolean;
  organizationId?: string;
  appId?: string;
}

export const sendSmsMessage = async (payload: SendSmsPayload) => {
  try {
    const finalPayload = { ...payload, appId: APP_ID };
    const response = await fetch(API_ENDPOINTS.SMS.SEND_STANDARD, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalPayload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send SMS via backend');
    }

    return data;
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

export const getSmsDetails = async (smsId: string) => {
  try {
    const response = await fetch(API_ENDPOINTS.SMS.GET_DETAILS(smsId));
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch SMS details');
    }

    return data;
  } catch (error: any) {
    console.error('Error fetching SMS details:', error);
    throw error;
  }
};
