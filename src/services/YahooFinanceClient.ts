import axios from 'axios';

export interface HistoricalData {
    symbol: string;
    currentPrice: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    currency: string;
    closePrices: number[];
    volumes: number[];
    highPrices: number[];
    lowPrices: number[];
}

export class YahooFinanceClient {
    private readonly baseUrl = process.env.YAHOO_FINANCE_BASE_URL || 'https://query1.finance.yahoo.com/v8/finance/chart';

    public async getHistoricalData(symbol: string, userInterval: string = '1 Day', userRange: string = '1 Year'): Promise<HistoricalData> {
        const yahooSymbol = this.convertToYahooSymbol(symbol);
        const interval = this.mapInterval(userInterval);
        const range = this.mapRange(userRange);

        const url = `${this.baseUrl}/${yahooSymbol}?interval=${interval}&range=${range}`;

        console.log(`[YahooFinance] Fetching historical data: ${url}`);

        const response = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const root = response.data;
        const result = root?.chart?.result?.[0];

        if (!result) {
            throw new Error(`No historical data found for: ${yahooSymbol}`);
        }

        const meta = result.meta;
        const timestamps = result.timestamp;
        const indicators = result.indicators?.quote?.[0];

        const data: HistoricalData = {
            symbol: yahooSymbol,
            currentPrice: meta.regularMarketPrice || 0,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
            currency: meta.currency || 'INR',
            closePrices: [],
            volumes: [],
            highPrices: [],
            lowPrices: []
        };

        if (indicators && Array.isArray(timestamps)) {
            data.closePrices = indicators.close || [];
            data.volumes = indicators.volume || [];
            data.highPrices = indicators.high || [];
            data.lowPrices = indicators.low || [];
            
            // Filter out nulls from Yahoo Finance data
            data.closePrices = data.closePrices.map(c => c || 0);
            data.volumes = data.volumes.map(v => v || 0);
            data.highPrices = data.highPrices.map(h => h || 0);
            data.lowPrices = data.lowPrices.map(l => l || 0);
        }

        return data;
    }

    private convertToYahooSymbol(growwSymbol: string): string {
        if (!growwSymbol) return "";
        let base = growwSymbol.replace("-EQ", "").replace("-BE", "").trim();
        return `${base}.NS`;
    }

    private mapInterval(friendlyInterval: string): string {
        const map: Record<string, string> = {
            '1 Min': '1m', '2 Mins': '2m', '5 Mins': '5m', '15 Mins': '15m', '30 Mins': '30m',
            '60 Mins': '60m', '90 Mins': '90m',
            '1 Hour': '1h',
            '1 Day': '1d',
            '5 Days': '5d',
            '1 Week': '1wk',
            '1 Month': '1mo',
            '3 Months': '3mo'
        };
        // Fallback to exactly what the user passed or '1d' if completely unfamiliar
        return map[friendlyInterval] || friendlyInterval || '1d';
    }

    private mapRange(friendlyRange: string): string {
        const map: Record<string, string> = {
            '1 Day': '1d',
            '5 Days': '5d',
            '1 Month': '1mo',
            '3 Months': '3mo',
            '6 Months': '6mo',
            '1 Year': '1y',
            '2 Years': '2y',
            '5 Years': '5y',
            '10 Years': '10y',
            'Max': 'max'
        };
        // Fallback to exactly what the user passed or '1y' if completely unfamiliar
        return map[friendlyRange] || friendlyRange || '1y';
    }
}
