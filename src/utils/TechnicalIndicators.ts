export class TechnicalIndicators {

    // ─── RSI (Relative Strength Index) ───────────────────────────────────────

    public static calculateRSI(closes: number[], period: number = 14): number {
        if (!closes || closes.length < period + 1) return 50.0;

        let gains = 0, losses = 0;

        for (let i = closes.length - period; i < closes.length; i++) {
            const change = closes[i] - closes[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgLoss === 0) return 100.0;
        const rs = avgGain / avgLoss;
        return 100.0 - (100.0 / (1.0 + rs));
    }

    public static rsiLabel(rsi: number): string {
        if (rsi > 70) return `Overbought (${rsi.toFixed(1)})`;
        if (rsi < 30) return `Oversold (${rsi.toFixed(1)})`;
        return `Neutral (${rsi.toFixed(1)})`;
    }

    // ─── Simple Moving Average ────────────────────────────────────────────────

    public static sma(closes: number[], period: number): number {
        if (!closes || closes.length < period) return 0;
        let sum = 0;
        for (let i = closes.length - period; i < closes.length; i++) {
            sum += closes[i];
        }
        return sum / period;
    }

    // ─── MACD ─────────────────────────────────────────────────────────────────

    public static calculateMACD(closes: number[]): [number, number, number] {
        if (!closes || closes.length < 26) return [0, 0, 0];
        const ema12 = this.ema(closes, 12);
        const ema26 = this.ema(closes, 26);
        const macd = ema12 - ema26;
        const signal = macd * 0.9; // simplified signal line approximation
        const hist = macd - signal;
        return [macd, signal, hist];
    }

    public static macdLabel(macd: [number, number, number]): string {
        if (macd[0] > macd[1]) return "Bullish (MACD above Signal)";
        return "Bearish (MACD below Signal)";
    }

    // ─── EMA ─────────────────────────────────────────────────────────────────

    public static ema(closes: number[], period: number): number {
        if (!closes || closes.length < period) return 0;
        
        // Step 1: Calculate SMA for the first `period` days to use as the seed
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += closes[i];
        }
        let ema = sum / period;

        // Step 2: Calculate multiplier
        const multiplier = 2.0 / (period + 1);

        // Step 3: Compute EMA for the rest of the array continuously
        for (let i = period; i < closes.length; i++) {
            ema = (closes[i] - ema) * multiplier + ema;
        }
        
        return ema;
    }

    // ─── Bollinger Bands ─────────────────────────────────────────────────────

    public static bollingerBands(closes: number[], period: number, stdDevMultiplier: number): [number, number, number] {
        if (!closes || closes.length < period) return [0, 0, 0];
        
        // Isolate the exact window: the last `period` elements
        const window = closes.slice(closes.length - period);
        
        // Middle band = Simple Moving Average (SMA) of the window
        const middle = window.reduce((sum, val) => sum + val, 0) / period;
        
        // Calculate variance over the window
        let variance = 0;
        for (let i = 0; i < window.length; i++) {
            const diff = window[i] - middle;
            variance += diff * diff;
        }
        
        const stdDev = Math.sqrt(variance / period); // Population standard deviation is standard here
        
        return [
            middle - stdDevMultiplier * stdDev, // Lower Band
            middle,                             // Middle Band (SMA)
            middle + stdDevMultiplier * stdDev  // Upper Band
        ];
    }

    // ─── Trend Detection ─────────────────────────────────────────────────────

    public static detectTrend(closes: number[]): string {
        if (!closes || closes.length < 200) {
            if (closes && closes.length >= 50) {
                const sma50 = this.sma(closes, 50);
                const current = closes[closes.length - 1];
                if (current > sma50 * 1.02) return "UPTREND";
                if (current < sma50 * 0.98) return "DOWNTREND";
                return "SIDEWAYS";
            }
            return "INSUFFICIENT_DATA";
        }
        
        const sma50 = this.sma(closes, 50);
        const sma200 = this.sma(closes, 200);
        const current = closes[closes.length - 1];

        if (sma50 > sma200 && current > sma50) return "UPTREND (Golden Cross)";
        if (sma50 < sma200 && current < sma50) return "DOWNTREND (Death Cross)";
        if (current > sma50) return "MILD UPTREND";
        return "SIDEWAYS / CONSOLIDATION";
    }

    // ─── DMA Labels ──────────────────────────────────────────────────────────

    public static dmaLabel(closes: number[]): string {
        if (!closes || closes.length < 50) return "N/A (insufficient data)";
        const current = closes[closes.length - 1];
        const sma50 = this.sma(closes, 50);
        const above50 = current > sma50;

        if (closes.length >= 200) {
            const sma200 = this.sma(closes, 200);
            const above200 = current > sma200;
            return `50 DMA: ${above50 ? "Above" : "Below"} (₹${sma50.toFixed(2)}) | 200 DMA: ${above200 ? "Above" : "Below"} (₹${sma200.toFixed(2)})`;
        }
        return `50 DMA: ${above50 ? "Above" : "Below"} (₹${sma50.toFixed(2)})`;
    }
}
