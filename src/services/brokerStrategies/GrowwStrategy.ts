import axios from 'axios';
import * as crypto from 'crypto';
import { BrokerStrategy, ImportedHolding } from './BrokerStrategy';

export class GrowwStrategy implements BrokerStrategy {
    private readonly baseUrl = process.env.GROWW_API_BASE_URL || 'https://api.groww.in';
    private readonly apiVersion = process.env.GROWW_API_VERSION || 'v1';

    /**
     * Translates to Java method 'generateAccessToken' using Checksum computation.
     */
    private async generateAccessToken(apiKey: string, apiSecret: string): Promise<string> {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const inpput = apiSecret + timestamp;
        const hmac = crypto.createHash('sha256');
        hmac.update(inpput);
        const checksum = hmac.digest('hex');

        const payload = {
            key_type: "approval",
            checksum: checksum,
            timestamp: timestamp
        };

        const response = await axios.post(`${this.baseUrl}/v1/token/api/access`, payload, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const token = response.data?.token;
        if (!token) {
            throw new Error(`Groww access token generation failed: ${JSON.stringify(response.data)}`);
        }

        return token;
    }

    public async fetchHoldings(apiKey: string, apiSecret?: string): Promise<ImportedHolding[]> {
        if (!apiSecret) {
            throw new Error("Groww integration requires an API Secret to generate the access token.");
        }

        // 1. Generate short-lived access token
        const accessToken = await this.generateAccessToken(apiKey, apiSecret);

        // 2. Fetch holdings
        const response = await axios.get(`${this.baseUrl}/v1/holdings/user`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'X-API-VERSION': this.apiVersion
            }
        });

        const data = response.data;
        if (data?.status !== 'SUCCESS') {
            const code = data?.error?.code || 'UNKNOWN';
            const message = data?.error?.message || 'Unknown error fetching holdings';
            throw new Error(`[Holdings] Groww API error ${code}: ${message}`);
        }

        const rawHoldings = data?.payload?.holdings || [];
        if (!Array.isArray(rawHoldings)) {
            return [];
        }

        // 3. Normalize to our ImportedHolding format
        return rawHoldings.map((h: any) => ({
            tradingSymbol: h.trading_symbol || h.tradingSymbol,
            isin: h.isin,
            quantity: h.quantity || 0,
            averagePrice: h.average_price || h.averagePrice || 0
        }));
    }
}
