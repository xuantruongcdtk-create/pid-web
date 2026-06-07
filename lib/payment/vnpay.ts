import crypto from "crypto";

export interface VNPAYConfig {
  tmnCode: string;
  hashSecret: string;
  url: string;
}

export class VNPAYPayment {
  private config: VNPAYConfig;

  constructor(config: VNPAYConfig) {
    this.config = config;
  }

  // Create hash checksum for VNPAY
  public hmacSHA512(secretKey: string, data: string): string {
    return crypto
      .createHmac("sha512", secretKey)
      .update(Buffer.from(data, "utf-8"))
      .digest("hex");
  }

  // Generate VNPAY checkout URL
  public createPaymentUrl(params: {
    orderId: string;
    amount: number;
    orderInfo: string;
    ipAddress: string;
    returnUrl: string;
  }): string {
    const date = new Date();
    const createDate = date.toISOString().replace(/T/, "").replace(/\..+/, "").replace(/-|:/g, "");

    const vnpParams: Record<string, string> = {
      vnp_Version: "2.1.0",
      vnp_Command: "pay",
      vnp_TmnCode: this.config.tmnCode,
      vnp_Locale: "vn",
      vnp_CurrCode: "VND",
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: "other",
      vnp_Amount: (params.amount * 100).toString(),
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddress,
      vnp_CreateDate: createDate
    };

    // Sort params alphabetically (required by VNPAY)
    const sortedKeys = Object.keys(vnpParams).sort();
    const signData = sortedKeys
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(vnpParams[key])}`)
      .join("&");

    const secureHash = this.hmacSHA512(this.config.hashSecret, signData);
    
    return `${this.config.url}?${signData}&vnp_SecureHash=${secureHash}`;
  }
}
