import crypto from 'crypto';

export interface PayFastPaymentPayload {
  merchant_id: string;
  merchant_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  name_first?: string;
  name_last?: string;
  email_address?: string;
  m_payment_id: string;
  amount: string; // e.g. "100.00"
  item_name: string;
  item_description?: string;
  custom_str1?: string;
  custom_str2?: string;
  custom_int1?: string;
  custom_int2?: string;
  [key: string]: string | undefined;
}

/**
 * Standard PayFast URL encoder (RFC 3986)
 */
function payFastEncode(val: string): string {
  return encodeURIComponent(val.trim())
    .replace(/%20/g, '+')
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * Get PayFast Process Base URL based on environment setting
 */
export function getPayFastUrl(): string {
  const isSandbox = process.env.PAYFAST_SANDBOX !== 'false';
  return isSandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';
}

/**
 * Get PayFast ITN Validation Host URL based on environment setting
 */
export function getPayFastValidateUrl(): string {
  const isSandbox = process.env.PAYFAST_SANDBOX !== 'false';
  return isSandbox
    ? 'https://sandbox.payfast.co.za/eng/query/validate'
    : 'https://www.payfast.co.za/eng/query/validate';
}

/**
 * Generate MD5 Signature for PayFast payment payload or ITN verification
 */
export function generatePayFastSignature(
  data: Record<string, string | number | undefined | null>,
  passphrase?: string
): string {
  let pfOutput = '';

  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      if (val !== undefined && val !== null && String(val).trim() !== '' && key !== 'signature') {
        pfOutput += `${key}=${payFastEncode(String(val))}&`;
      }
    }
  }

  // Remove trailing '&'
  pfOutput = pfOutput.slice(0, -1);

  const merchantId = String(data.merchant_id || process.env.PAYFAST_MERCHANT_ID || '').trim();
  const isDefaultSandbox = merchantId === '10000100';
  const pfPassphrase = passphrase || process.env.PAYFAST_PASSPHRASE || (isDefaultSandbox ? 'jt7NOE43FZPn' : undefined);

  if (pfPassphrase && pfPassphrase.trim() !== '') {
    pfOutput += `&passphrase=${payFastEncode(pfPassphrase)}`;
  }

  return crypto.createHash('md5').update(pfOutput).digest('hex');
}

/**
 * Build URL Query String matching exact PayFast encoding and field order
 */
export function buildPayFastQueryString(
  data: Record<string, string | number | undefined | null>
): string {
  const params: string[] = [];

  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const val = data[key];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        params.push(`${key}=${payFastEncode(String(val))}`);
      }
    }
  }

  return params.join('&');
}

/**
 * Verify ITN Callback Signature and Validate with PayFast Server
 */
export async function verifyPayFastItn(
  pfData: Record<string, string>,
  rawPfParamString?: string
): Promise<{ isValid: boolean; error?: string }> {
  // 1. Verify Signature using exact parameter sequence sent by PayFast
  const receivedSignature = pfData.signature;
  if (!receivedSignature) {
    return { isValid: false, error: 'Missing signature in PayFast ITN payload' };
  }

  let calculatedSignature = '';

  if (rawPfParamString && rawPfParamString.trim() !== '') {
    // Preserve exact raw POST body parameter order as sent by PayFast
    const paramPairs = rawPfParamString.split('&').filter(p => p.trim() !== '' && !p.startsWith('signature='));
    let pfParamStr = paramPairs.join('&');

    const merchantId = String(pfData.merchant_id || process.env.PAYFAST_MERCHANT_ID || '').trim();
    const isDefaultSandbox = merchantId === '10000100';
    const pfPassphrase = process.env.PAYFAST_PASSPHRASE || (isDefaultSandbox ? 'jt7NOE43FZPn' : undefined);

    if (pfPassphrase && pfPassphrase.trim() !== '') {
      pfParamStr += `&passphrase=${payFastEncode(pfPassphrase)}`;
    }

    calculatedSignature = crypto.createHash('md5').update(pfParamStr).digest('hex');
  } else {
    calculatedSignature = generatePayFastSignature(pfData);
  }

  if (receivedSignature.toLowerCase() !== calculatedSignature.toLowerCase()) {
    console.error(`PayFast ITN Signature mismatch. Received: ${receivedSignature}, Calculated: ${calculatedSignature}`);
    return { isValid: false, error: 'PayFast ITN signature mismatch' };
  }

  // 2. Server-to-Server Validation with PayFast
  try {
    const validateUrl = getPayFastValidateUrl();

    let paramString = rawPfParamString;
    if (!paramString) {
      const params: string[] = [];
      for (const key in pfData) {
        if (Object.prototype.hasOwnProperty.call(pfData, key) && key !== 'signature') {
          const val = pfData[key];
          params.push(`${key}=${payFastEncode(val)}`);
        }
      }
      paramString = params.join('&');
    }

    const response = await fetch(validateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paramString,
    });

    const responseText = await response.text();
    if (responseText.trim() !== 'VALID') {
      return { isValid: false, error: `PayFast server validation failed: ${responseText}` };
    }

    return { isValid: true };
  } catch (err: any) {
    return { isValid: false, error: `Error validating with PayFast server: ${err.message}` };
  }
}

/**
 * Automatically fetch direct session redirect URL from PayFast so clicking payment_url opens checkout directly
 */
export async function createPayFastSessionUrl(
  payFastFields: Record<string, string>
): Promise<string> {
  const payfastUrl = getPayFastUrl();
  const queryString = buildPayFastQueryString(payFastFields);
  const fallbackUrl = `${payfastUrl}?${queryString}`;

  try {
    const bodyParams = new URLSearchParams();
    for (const [key, value] of Object.entries(payFastFields)) {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        bodyParams.append(key, String(value).trim());
      }
    }

    const response = await fetch(payfastUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: bodyParams.toString(),
      redirect: 'manual',
    });

    const locationHeader = response.headers.get('location');
    if (locationHeader) {
      return locationHeader;
    }

    const text = await response.text();
    const match = text.match(/href=["'](https?:\/\/[^"']+)["']/i) || text.match(/url=['"](https?:\/\/[^"']+)['"]/i);
    if (match && match[1]) {
      return match[1];
    }

    return fallbackUrl;
  } catch (err) {
    console.error('Failed to create direct PayFast session URL:', err);
    return fallbackUrl;
  }
}
