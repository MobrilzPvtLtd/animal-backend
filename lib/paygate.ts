import crypto from 'crypto';

export interface PayGateInitiateRequest {
  paygateId: string;
  encryptionKey: string;
  reference: string;
  amount: number; // in ZAR e.g. 99.00 -> 9900 cents
  currency?: string; // default ZAR
  returnUrl: string;
  notifyUrl: string;
  email: string;
}

export interface PayGateInitiateResult {
  success: boolean;
  payRequestId?: string;
  paymentUrl?: string;
  htmlForm?: string;
  error?: string;
}

function formatDateForPayGate(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const DD = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}`;
}

export async function initiatePayGateTransaction(
  req: PayGateInitiateRequest
): Promise<PayGateInitiateResult> {
  try {
    const paygateId = req.paygateId.trim();
    const encryptionKey = req.encryptionKey.trim();
    const reference = req.reference.trim();
    const amountInCents = Math.round(req.amount * 100).toString();
    const currency = (req.currency || 'ZAR').toUpperCase();
    const returnUrl = req.returnUrl;
    const notifyUrl = req.notifyUrl;
    const transactionDate = formatDateForPayGate();
    const locale = 'en-za';
    const country = 'ZAF';
    const email = req.email || 'customer@example.com';

    // PayGate PayWeb v3 Checksum calculation for initiate:
    // Concatenate values in order + Encryption Key, then MD5
    const checksumString = `${paygateId}${reference}${amountInCents}${currency}${returnUrl}${transactionDate}${locale}${country}${email}${notifyUrl}${encryptionKey}`;
    const checksum = crypto.createHash('md5').update(checksumString).digest('hex');

    const params = new URLSearchParams({
      PAYGATE_ID: paygateId,
      REFERENCE: reference,
      AMOUNT: amountInCents,
      CURRENCY: currency,
      RETURN_URL: returnUrl,
      NOTIFY_URL: notifyUrl,
      TRANSACTION_DATE: transactionDate,
      LOCALE: locale,
      COUNTRY: country,
      EMAIL: email,
      CHECKSUM: checksum,
    });

    const initResponse = await fetch('https://secure.paygate.co.za/payweb3/initiate.trans', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const responseText = await initResponse.text();
    const responseParams = new URLSearchParams(responseText);

    const payRequestId = responseParams.get('PAYREQUEST_ID');
    const returnedChecksum = responseParams.get('CHECKSUM');
    const errorCode = responseParams.get('ERROR');

    if (errorCode || !payRequestId) {
      console.error('PayGate Initiate Error Response:', responseText);
      return {
        success: false,
        error: `PayGate initiate error code ${errorCode || 'UNKNOWN'}: ${responseText}`,
      };
    }

    // Process Checksum for PayGate Process step:
    // MD5 of (PAYGATE_ID + PAYREQUEST_ID + REFERENCE + ENCRYPTION_KEY)
    const processChecksumString = `${paygateId}${payRequestId}${reference}${encryptionKey}`;
    const processChecksum = crypto.createHash('md5').update(processChecksumString).digest('hex');

    const processUrl = 'https://secure.paygate.co.za/payweb3/process.trans';
    const processQuery = `PAYREQUEST_ID=${encodeURIComponent(payRequestId)}&CHECKSUM=${encodeURIComponent(processChecksum)}`;
    const paymentUrl = `${processUrl}?${processQuery}`;

    const htmlForm = `<!DOCTYPE html>
<html>
<head><title>Redirecting to PayGate...</title></head>
<body onload="document.forms[0].submit()">
  <form action="${processUrl}" method="POST">
    <input type="hidden" name="PAYREQUEST_ID" value="${payRequestId}" />
    <input type="hidden" name="CHECKSUM" value="${processChecksum}" />
    <noscript><button type="submit">Click here to proceed to PayGate</button></noscript>
  </form>
</body>
</html>`;

    return {
      success: true,
      payRequestId,
      paymentUrl,
      htmlForm,
    };
  } catch (err: any) {
    console.error('PayGate Initiate Exception:', err);
    return {
      success: false,
      error: `Failed to initiate PayGate transaction: ${err.message}`,
    };
  }
}
