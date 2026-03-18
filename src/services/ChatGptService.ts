import axios from 'axios';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('chatgpt-service');
import { HistoricalData } from './YahooFinanceClient';
import { TechnicalIndicators } from '../utils/TechnicalIndicators';
import { Holding } from '@prisma/client';

export interface StockAdvice {
    recommendation: string;
    targetPrice3M: number;
    targetPrice1Y: number;
    stopLoss: number;
    riskLevel: string;
    reasoning: string;
    technicalSummary: string;
    fundamentalSummary: string;
    newsSentiment: string;
    forecastedReturnPct: number;
    suggestedAction: string;
    rawResponse?: any;
}

export interface PortfolioAdvice {
    diversificationScore: string;
    riskProfile: string;
    topPerformer: string;
    worstPerformer: string;
    rebalancingNeeded: boolean;
    portfolioSummary: string;
    sectorConcentration: string;
    rawResponse?: any;
}

export class ChatGptService {
    private readonly chatGptUrl = process.env.CHATGPT_API_URL || 'https://api.openai.com/v1/chat/completions';
    private readonly chatGptApiKey = process.env.CHATGPT_API_KEY || '';
    private readonly chatGptModel = process.env.CHATGPT_API_MODEL || 'gpt-4o-mini';
    private readonly temperature = parseFloat(process.env.CHATGPT_API_TEMPERATURE || '0.2');

    // Utility function to pause for a bit
    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    public async analyzeStock(holding: Holding, historicalData: HistoricalData, maxRetries: number = 3): Promise<StockAdvice> {
        return tracer.startActiveSpan('analyzeStock', async (span) => {
            try {
                span.setAttribute('stock.symbol', holding.tradingSymbol);
                const closes = historicalData.closePrices;
                const rsi = TechnicalIndicators.calculateRSI(closes, 14);
                const macd = TechnicalIndicators.calculateMACD(closes);
                const trend = TechnicalIndicators.detectTrend(closes);
                const dma = TechnicalIndicators.dmaLabel(closes);
                const bb = TechnicalIndicators.bollingerBands(closes, 20, 2.0);

                const currentPrice = historicalData.currentPrice || holding.averagePrice;
                const pnl = (currentPrice - holding.averagePrice) * holding.quantity;
                const pnlPct = holding.averagePrice > 0 ? (pnl / (holding.averagePrice * holding.quantity)) * 100 : 0;

                const userPrompt = this.buildStockPrompt(
                    holding, historicalData, currentPrice, pnl, pnlPct,
                    rsi, macd, trend, dma, bb
                );
                const systemPrompt = this.getSystemPrompt();
                
                const rawResponse = await this.callChatGptWithRetry(systemPrompt, userPrompt, maxRetries);
                const result = this.parseStockAdvice(holding, rawResponse, historicalData, currentPrice, pnl, pnlPct, rsi, trend, dma, macd);
                
                span.setAttribute('stock.recommendation', result.recommendation);
                span.end();
                return result;
            } catch (error: any) {
                span.recordException(error);
                span.setStatus({ code: 2 });
                span.end();
                throw error;
            }
        });
    }

    public async analyzePortfolio(
        data: { holding: Holding, advice: StockAdvice, currentPrice: number }[],
        maxRetries: number = 3
    ): Promise<PortfolioAdvice> {
        return tracer.startActiveSpan('analyzePortfolio', async (span) => {
            try {
                span.setAttribute('portfolio.size', data.length);
                if (!data || data.length === 0) {
                     const defaultAdvice = this.getDefaultPortfolioAdvice("No holdings to analyze.");
                     span.end();
                     return defaultAdvice;
                }

                const userPrompt = this.buildPortfolioPrompt(data);
                const systemPrompt = this.getSystemPrompt();

                const rawResponse = await this.callChatGptWithRetry(systemPrompt, userPrompt, maxRetries);
                const result = this.parsePortfolioAdvice(rawResponse);
                
                span.setAttribute('portfolio.score', result.diversificationScore);
                span.end();
                return result;
            } catch (error: any) {
                span.recordException(error);
                span.setStatus({ code: 2 });
                span.end();
                throw error;
            }
        });
    }

    private buildStockPrompt(
        h: Holding, hist: HistoricalData, currentPrice: number, pnl: number, pnlPct: number,
        rsi: number, macd: [number, number, number], trend: string, dma: string, bb: [number, number, number]
    ): string {
        return `Analyze the following Indian stock and provide a structured financial recommendation.

=== STOCK DATA ===
Symbol          : ${h.tradingSymbol}
Qty Held        : ${h.quantity} shares
Avg Buy Price   : ₹${h.averagePrice.toFixed(2)}
Current Price   : ₹${currentPrice.toFixed(2)}
P&L             : ₹${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)
52W High        : ₹${hist.fiftyTwoWeekHigh.toFixed(2)}
52W Low         : ₹${hist.fiftyTwoWeekLow.toFixed(2)}

=== TECHNICAL INDICATORS ===
Trend           : ${trend}
RSI (14)        : ${rsi.toFixed(1)} — ${TechnicalIndicators.rsiLabel(rsi)}
MACD            : ${macd[0].toFixed(2)} | Signal: ${macd[1].toFixed(2)} | Histogram: ${macd[2].toFixed(2)} — ${TechnicalIndicators.macdLabel(macd)}
Moving Averages : ${dma}
Bollinger Bands : Lower ₹${bb[0].toFixed(2)} | Mid ₹${bb[1].toFixed(2)} | Upper ₹${bb[2].toFixed(2)}

=== INSTRUCTIONS ===
Deliver an institutional-grade equity research summary based on the provided data matrix. Speak with the authoritative, precise tone of a hedge fund manager advising a high-net-worth client. Do not use generic filler. Project realistic price targets derived from the technical momentum and implied volatility boundaries.

Provide your analysis in EXACTLY this JSON format (no extra text):
{
  "recommendation": "BUY" | "SELL" | "HOLD",
  "targetPrice3M": <number>,
  "targetPrice1Y": <number>,
  "stopLoss": <number>,
  "riskLevel": "LOW" | "MEDIUM" | "HIGH",
  "reasoning": "<A sophisticated 3-sentence investment thesis combining price action and structural market view>",
  "technicalSummary": "<2-sentence precise technical breakdown mentioning support/resistance and momentum>",
  "fundamentalSummary": "<1-2 sentence probable fundamental catalyst or valuation context for this sector>",
  "newsSentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE",
  "forecastedReturnPct": <number>,
  "suggestedAction": "<One decisive, professional directive on capital allocation>"
}`;
    }

    private buildPortfolioPrompt(data: { holding: Holding, advice: StockAdvice, currentPrice: number }[]): string {
        const totalInvested = data.reduce((sum, item) => sum + (item.holding.averagePrice * item.holding.quantity), 0);
        const currentValue = data.reduce((sum, item) => sum + (item.currentPrice * item.holding.quantity), 0);
        const pnl = currentValue - totalInvested;
        const pnlPct = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

        let prompt = `Analyze this Indian stock portfolio and provide an overall health assessment.\n\n`;
        prompt += `Total Invested: ₹${totalInvested.toFixed(2)} | Current Value: ₹${currentValue.toFixed(2)} | P&L: ₹${pnl.toFixed(2)} (${pnlPct.toFixed(2)}%)\n\n`;
        prompt += `Holdings with earlier LLM recommendations:\n`;

        for (const item of data) {
            if (item.advice.recommendation === 'ERROR') {
                prompt += `- ${item.holding.tradingSymbol}: ERROR (Analysis skipped due to missing data)\n`;
            } else {
                const targetPrice = item.advice.targetPrice1Y ? item.advice.targetPrice1Y.toFixed(2) : "N/A";
                prompt += `- ${item.holding.tradingSymbol}: ${item.advice.recommendation} | Target 1Y: ₹${targetPrice} | Risk: ${item.advice.riskLevel}\n`;
            }
        }

        prompt += `\nProvide portfolio assessment in EXACTLY this JSON format (no extra text):
{
  "diversificationScore": "<X/10>",
  "riskProfile": "AGGRESSIVE" | "MODERATE" | "CONSERVATIVE",
  "topPerformer": "<symbol>",
  "worstPerformer": "<symbol>",
  "rebalancingNeeded": true | false,
  "portfolioSummary": "<3-4 sentence overall advice>",
  "sectorConcentration": "<observation about sector concentration>"
}`;
        return prompt;
    }

    private getSystemPrompt(): string {
        return `You are a Senior Equity Research Analyst and Lead Portfolio Manager at a top-tier global investment bank, specializing in the Indian Equity Markets (NSE/BSE).
Your analysis is sought after by institutional investors and high-net-worth individuals for its rigorous fundamental insights and advanced technical precision.
When evaluating equities, you seamlessly synthesize market structure, sector rotation dynamics, and algorithmic technical indicators (RSI, MACD, Bollinger Bands, Moving Averages).
You do not give generic advice. Your recommendations must be razor-sharp, highly objective, and institutional-grade.
Always prioritize capital preservation by establishing strict risk management boundaries (stop-loss) while identifying asymmetric risk-reward opportunities.
You MUST respond ONLY with valid JSON — no markdown blocks (\`\`\`json), no preamble, and no extra text whatsoever.`;
    }

    /**
     * Call ChatGPT API with delay and retry logic
     */
    private async callChatGptWithRetry(systemPrompt: string, userMessage: string, maxRetries: number = 3): Promise<string> {
        return tracer.startActiveSpan('callChatGptWithRetry', async (span) => {
            if (!this.chatGptApiKey) {
                console.warn('[ChatGPT] Missing API Key. Returning mock data instead.');
                span.setAttribute('chatgpt.mock', true);
                span.end();
                return this.getMockResponse();
            }

            let retries = 0;
            let lastError: any = null;

            while (retries < maxRetries) {
                const attemptSpan = tracer.startSpan(`attempt_${retries + 1}`);
                try {
                    const response = await axios.post(
                        this.chatGptUrl,
                        {
                            model: this.chatGptModel,
                            stream:false,
                            temperature: this.temperature,
                            messages: [
                                { role: "system", content: systemPrompt },
                                { role: "user", content: userMessage }
                            ]
                        },
                        {
                            headers: {
                                'Authorization': `Bearer ${this.chatGptApiKey}`,
                                'Content-Type': 'application/json'
                            },
                            timeout: 30000 // 30s timeout
                        }
                    );

                    const content = response.data?.choices?.[0]?.message?.content || response.data?.message?.content;
                    if (!content) {
                        throw new Error("Unexpected empty content from ChatGPT.");
                    }
                    attemptSpan.end();
                    span.end();
                    return content;
                } catch (error: any) {
                    lastError = error;
                    attemptSpan.recordException(error);
                    attemptSpan.setStatus({ code: 2 });
                    attemptSpan.end();

                    // Specifically look for rate limits (429) or Server errors (5xx)
                    if (error.response && (error.response.status === 429 || error.response.status >= 500)) {
                        retries++;
                        const backoff = Math.pow(2, retries) * 1000; // 2s, 4s, 8s...
                        console.warn(`[ChatGPT] Rate limit or server error (${error.response.status}). Retrying in ${backoff}ms... (${retries}/${maxRetries})`);
                        await this.sleep(backoff);
                    } else {
                        retries++;
                        const backoff = 2000;
                        console.warn(`[ChatGPT] Request failed. Retrying in ${backoff}ms... (${retries}/${maxRetries})`);
                        await this.sleep(backoff);
                    }
                }
            }

            console.error('[ChatGPT] Exhausted all retries.', lastError?.message);
            span.recordException(new Error(`ChatGPT API failed after ${maxRetries} retries.`));
            span.setStatus({ code: 2 });
            span.end();
            throw new Error(`ChatGPT API failed after ${maxRetries} retries.`);
        });
    }

    private getMockResponse(): string {
        return JSON.stringify({
            "recommendation": "HOLD",
            "targetPrice3M": 105,
            "targetPrice1Y": 115,
            "stopLoss": 95,
            "riskLevel": "MEDIUM",
            "reasoning": "Mock reasoning provided because ChatGPT API Key is missing.",
            "technicalSummary": "Mock technical summary.",
            "fundamentalSummary": "Mock fundamentals.",
            "newsSentiment": "NEUTRAL",
            "forecastedReturnPct": 5.0,
            "suggestedAction": "Hold tightly."
        });
    }

    private parseStockAdvice(
        holding: Holding, json: string, hist: HistoricalData, 
        currentPrice: number, pnl: number, pnlPct: number, 
        rsi: number, trend: string, dma: string, macd: [number, number, number]
    ): StockAdvice {
        const advice: StockAdvice = {
            recommendation: "HOLD",
            targetPrice3M: currentPrice * 1.05,
            targetPrice1Y: currentPrice * 1.15,
            stopLoss: currentPrice * 0.93,
            riskLevel: "MEDIUM",
            reasoning: "Analysis unavailable. Please retry.",
            technicalSummary: `RSI: ${TechnicalIndicators.rsiLabel(rsi)} | MACD: ${TechnicalIndicators.macdLabel(macd)} | ${dma}`,
            fundamentalSummary: "",
            newsSentiment: "NEUTRAL",
            forecastedReturnPct: 5.0,
            suggestedAction: ""
        };

        try {
            const cleaned = json.replace(/```json/g, "").replace(/```/g, "").trim();
            const node = JSON.parse(cleaned);

            advice.recommendation = node.recommendation || advice.recommendation;
            advice.targetPrice3M = node.targetPrice3M || advice.targetPrice3M;
            advice.targetPrice1Y = node.targetPrice1Y || advice.targetPrice1Y;
            advice.stopLoss = node.stopLoss || advice.stopLoss;
            advice.riskLevel = node.riskLevel || advice.riskLevel;
            advice.reasoning = node.reasoning || advice.reasoning;
            advice.technicalSummary = node.technicalSummary || advice.technicalSummary;
            advice.fundamentalSummary = node.fundamentalSummary || advice.fundamentalSummary;
            advice.newsSentiment = node.newsSentiment || advice.newsSentiment;
            advice.forecastedReturnPct = node.forecastedReturnPct || advice.forecastedReturnPct;
            advice.suggestedAction = node.suggestedAction || advice.suggestedAction;
            advice.rawResponse = node;

        } catch (e: any) {
            console.warn(`[ChatGPT Parse Error] Could not parse ChatGPT response for ${holding.tradingSymbol}. Using defaults. Raw: ${json}`);
        }

        return advice;
    }

    private getDefaultPortfolioAdvice(reasoning: string): PortfolioAdvice {
        return {
            diversificationScore: "N/A",
            riskProfile: "UNKNOWN",
            topPerformer: "N/A",
            worstPerformer: "N/A",
            rebalancingNeeded: false,
            portfolioSummary: reasoning,
            sectorConcentration: "N/A"
        };
    }

    private parsePortfolioAdvice(json: string): PortfolioAdvice {
        const advice = this.getDefaultPortfolioAdvice("Analysis unavailable. Please retry.");

        try {
            const cleaned = json.replace(/```json/g, "").replace(/```/g, "").trim();
            const node = JSON.parse(cleaned);

            advice.diversificationScore = node.diversificationScore || advice.diversificationScore;
            advice.riskProfile = node.riskProfile || advice.riskProfile;
            advice.topPerformer = node.topPerformer || advice.topPerformer;
            advice.worstPerformer = node.worstPerformer || advice.worstPerformer;
            advice.rebalancingNeeded = typeof node.rebalancingNeeded === 'boolean' ? node.rebalancingNeeded : advice.rebalancingNeeded;
            advice.portfolioSummary = node.portfolioSummary || advice.portfolioSummary;
            advice.sectorConcentration = node.sectorConcentration || advice.sectorConcentration;
            advice.rawResponse = node;

        } catch (e: any) {
            console.warn(`[ChatGPT] Could not parse Portfolio response. Raw: ${json}`);
        }

        return advice;
    }
}
