import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

@Injectable()
export class KorapayService {
  private readonly baseUrl = process.env.KORAPAY_BASE_URL;
  private readonly secretKey = process.env.KORAPAY_SECRET_KEY;

  // Encrypt payload using Korapay's encryption method
  private encryptPayload(payload: any): string {
    const publicKey = process.env.KORAPAY_PUBLIC_KEY; // Add your public key to environment variables
    const buffer = Buffer.from(JSON.stringify(payload));
    const encrypted = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      buffer,
    );
    return encrypted.toString('base64');
  }

  // Create a payment
  async createPayment(data: any) {
    try {
      const encryptedData = this.encryptPayload(data);
      const response = await axios.post(
        `${this.baseUrl}/charges/card/pre-authorize`,
        { charge: encryptedData },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      throw new HttpException(
        error.response?.data || 'Payment creation failed',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
