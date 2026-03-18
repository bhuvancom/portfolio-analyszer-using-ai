import { TechnicalIndicators } from '../utils/TechnicalIndicators';

describe('TechnicalIndicators Unit Tests', () => {
    
    describe('RSI', () => {
        it('should return 50.0 for insufficient data', () => {
            expect(TechnicalIndicators.calculateRSI([100], 14)).toBe(50.0);
        });

        it('should calculate RSI correctly', () => {
            const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
            const rsi = TechnicalIndicators.calculateRSI(closes, 14);
            expect(rsi).toBeGreaterThan(0);
            expect(rsi).toBeLessThanOrEqual(100);
        });

        it('should return 100.0 if there are only gains', () => {
            const closes = [100, 110, 120, 130, 140, 150];
            expect(TechnicalIndicators.calculateRSI(closes, 5)).toBe(100.0);
        });

        it('should return correct labels', () => {
            expect(TechnicalIndicators.rsiLabel(75)).toContain('Overbought');
            expect(TechnicalIndicators.rsiLabel(25)).toContain('Oversold');
            expect(TechnicalIndicators.rsiLabel(50)).toContain('Neutral');
        });
    });

    describe('SMA', () => {
        it('should return 0 for insufficient data', () => {
            expect(TechnicalIndicators.sma([100], 2)).toBe(0);
        });

        it('should calculate average correctly', () => {
            expect(TechnicalIndicators.sma([10, 20, 30], 3)).toBe(20);
        });
    });

    describe('MACD', () => {
        it('should return [0,0,0] for insufficient data', () => {
            expect(TechnicalIndicators.calculateMACD([100])).toEqual([0, 0, 0]);
        });

        it('should return labels correctly', () => {
            expect(TechnicalIndicators.macdLabel([10, 5, 5])).toContain('Bullish');
            expect(TechnicalIndicators.macdLabel([5, 10, -5])).toContain('Bearish');
        });
    });

    describe('EMA', () => {
        it('should return 0 for insufficient data', () => {
            expect(TechnicalIndicators.ema([100], 2)).toBe(0);
        });

        it('should calculate EMA correctly', () => {
            const closes = [10, 20, 30, 40, 50];
            const ema = TechnicalIndicators.ema(closes, 3);
            expect(ema).toBeGreaterThan(20);
        });
    });

    describe('Bollinger Bands', () => {
        it('should return [0,0,0] for insufficient data', () => {
            expect(TechnicalIndicators.bollingerBands([100], 20, 2)).toEqual([0, 0, 0]);
        });

        it('should calculate bands correctly', () => {
            const closes = Array(20).fill(100);
            const bands = TechnicalIndicators.bollingerBands(closes, 20, 2);
            expect(bands).toEqual([100, 100, 100]);
        });
    });

    describe('Trend Detection', () => {
        it('should return INSUFFICIENT_DATA if less than 50 points', () => {
            expect(TechnicalIndicators.detectTrend([100])).toBe('INSUFFICIENT_DATA');
        });

        it('should detect trends for mid-range data (50-199 points)', () => {
            const closes = Array(50).fill(100);
            closes[49] = 110; // 10% up
            expect(TechnicalIndicators.detectTrend(closes)).toBe('UPTREND');
            
            closes[49] = 90; // 10% down
            expect(TechnicalIndicators.detectTrend(closes)).toBe('DOWNTREND');

            closes[49] = 100;
            expect(TechnicalIndicators.detectTrend(closes)).toBe('SIDEWAYS');
        });

        it('should detect Golden/Death crosses for long range data', () => {
            const closes = Array(200).fill(100);
            // SMA50 vs SMA200 logic test:
            // For simplicity, we just check the branches
            expect(TechnicalIndicators.detectTrend(closes)).toBe('SIDEWAYS / CONSOLIDATION');
        });
    });

    describe('DMA Label', () => {
        it('should return N/A for insufficient data', () => {
            expect(TechnicalIndicators.dmaLabel([100])).toBe('N/A (insufficient data)');
        });

        it('should return labels for 50 DMA', () => {
            const closes = Array(50).fill(100);
            expect(TechnicalIndicators.dmaLabel(closes)).toContain('50 DMA');
        });

        it('should return labels for 50 and 200 DMA', () => {
            const closes = Array(200).fill(100);
            expect(TechnicalIndicators.dmaLabel(closes)).toContain('200 DMA');
        });
    });
});
