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
 * @param data Data object containing PayFast fields
 * @param passphrase Optional passphrase configured in PayFast account
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
        const encodedVal = encodeURIComponent(String(val).trim()).replace(/%20/g, '+');
        pfOutput += `${key}=${encodedVal}&`;
      }
    }
  }

  // Remove trailing '&'
  pfOutput = pfOutput.slice(0, -1);

  const merchantId = String(data.merchant_id || process.env.PAYFAST_MERCHANT_ID || '').trim();
  const isDefaultSandbox = merchantId === '10000100';
  const pfPassphrase = passphrase || process.env.PAYFAST_PASSPHRASE || (isDefaultSandbox ? 'jt7NOE43FZPn' : undefined);

  if (pfPassphrase && pfPassphrase.trim() !== '') {
    const encodedPassphrase = encodeURIComponent(pfPassphrase.trim()).replace(/%20/g, '+');
    pfOutput += `&passphrase=${encodedPassphrase}`;
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
        const encodedVal = encodeURIComponent(String(val).trim()).replace(/%20/g, '+');
        params.push(`${key}=${encodedVal}`);
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
  // 1. Verify Signature
  const receivedSignature = pfData.signature;
  if (!receivedSignature) {
    return { isValid: false, error: 'Missing signature in PayFast ITN payload' };
  }

  const calculatedSignature = generatePayFastSignature(pfData);
  if (receivedSignature.toLowerCase() !== calculatedSignature.toLowerCase()) {
    return { isValid: false, error: 'PayFast ITN signature mismatch' };
  }

  // 2. Server-to-Server Validation with PayFast
  try {
    const validateUrl = getPayFastValidateUrl();

    // Reconstruct param string if not directly provided
    let paramString = rawPfParamString;
    if (!paramString) {
      const params: string[] = [];
      for (const key in pfData) {
        if (Object.prototype.hasOwnProperty.call(pfData, key) && key !== 'signature') {
          const val = pfData[key];
          params.push(`${key}=${encodeURIComponent(val.trim()).replace(/%20/g, '+')}`);
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
