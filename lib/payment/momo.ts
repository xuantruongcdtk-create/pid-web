import axios from "axios";
import crypto from "crypto";

export interface MoMoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
}

export class MoMoPayment {
  private config: MoMoConfig;

  constructor(config: MoMoConfig) {
    this.config = config;
  }

  // Create signature for MoMo transaction security
  public createSignature(rawSignature: string): string {
    return crypto
      .createHmac("sha256", this.config.secretKey)
      .update(rawSignature)
      .digest("hex");
  }

  // Generate checkout payment session
  public async createPaymentRequest(params: {
    orderId: string;
    amount: number;
    orderInfo: string;
    redirectUrl: string;
    ipnUrl: string;
  }) {
    const { orderId, amount, orderInfo, redirectUrl, ipnUrl } = params;
    const requestId = orderId;
    const requestType = "captureWallet";
    const extraData = "";

    const rawSignature = `accessKey=${this.config.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.config.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;
    const signature = this.createSignature(rawSignature);

    const payload = {
      partnerCode: this.config.partnerCode,
      partnerName: "EduGemini Partner",
      storeId: "EduGeminiStore",
      requestId,
      amount,
      orderId,
      orderInfo,
      redirectUrl,
      ipnUrl,
      lang: "vi",
      requestType,
      extraData,
      signature
    };

    // Return the response details (mocked or actual post request)
    return payload;
  }
}
