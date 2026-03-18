import prisma from '../utils/db';
import { YahooFinanceClient } from './YahooFinanceClient';
import { ChatGptService } from './ChatGptService';
import { AnalysisStatus } from '../constants/status';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('analysis-service');

export class AnalysisService {
    private yahooClient: YahooFinanceClient;
    private chatGptService: ChatGptService;

    constructor(yahooClient: YahooFinanceClient, chatGptService: ChatGptService) {
        this.yahooClient = yahooClient;
        this.chatGptService = chatGptService;
    }

    public async runAnalysisJob(userId: number, metadataId: number, interval: string = '1d', range: string = '1y') {
        return tracer.startActiveSpan('runAnalysisJob', async (span) => {
            try {
                span.setAttribute('user.id', userId);
                span.setAttribute('metadata.id', metadataId);
                console.log(`[Job] Starting analysis for userId: ${userId}, metadataId: ${metadataId}`);

                // 1. Fetch current holdings directly from the database to snapshot them
                const holdings = await prisma.holding.findMany({
                    where: { userId }
                });

                const portfolioData: any[] = [];
                // 1. Fetch Yahoo data concurrently for all holdings with individual error handling
                const yahooDataArray = await Promise.all(holdings.map(async (h) => {
                  try {
                    const data = await this.yahooClient.getHistoricalData(h.tradingSymbol, interval, range);
                    return { holdingId: h.id, data, error: null };
                  } catch (err: any) {
                    console.error(`[YahooFinance] Failed to fetch data for ${h.tradingSymbol}:`, err.message);
                    return { holdingId: h.id, data: null, error: err.message };
                  }
                }));

                const yahooDataMap = new Map(yahooDataArray.map(item => [item.holdingId, item]));

                for (const holding of holdings) {
                    await tracer.startActiveSpan(`process_holding_${holding.tradingSymbol}`, async (hSpan) => {
                        try {
                            hSpan.setAttribute('stock.symbol', holding.tradingSymbol);
                            
                            // 1. Get pre-fetched historical data for the holding
                            const yahooResult = yahooDataMap.get(holding.id);
                            const historicalData = yahooResult?.data;
                            let advice;

                            if (!historicalData) {
                                console.warn(`[Analysis] Skipping stock analysis for ${holding.tradingSymbol} due to missing Yahoo data: ${yahooResult?.error || 'Unknown error'}`);
                                advice = {
                                    recommendation: 'ERROR',
                                    reasoning: yahooResult?.error || `No historical data found for ${holding.tradingSymbol}`,
                                    rawResponse: {}
                                };
                            } else {
                                // 2. Pass to ChatGPT for analysis with retries
                                advice = await this.chatGptService.analyzeStock(holding, historicalData);
                            }

                            portfolioData.push({
                                holding,
                                advice,
                                currentPrice: historicalData?.currentPrice || holding.averagePrice
                            });

                            // 3. Save snapshot
                            await prisma.analysisHoldingSnapshot.create({
                                data: {
                                    metadataId: metadataId,
                                    holdingId: holding.id,
                                    tradingSymbol: holding.tradingSymbol,
                                    quantity: holding.quantity,
                                    averagePrice: holding.averagePrice,
                                    advice: advice.recommendation,
                                    reasoning: advice.reasoning,
                                    rawJson: advice.rawResponse || {}
                                }
                            });

                            console.log(`[Analysis] Finished processing ${holding.tradingSymbol}`);
                        } catch (err: any) {
                            console.error(`[Analysis] Failed to process holding ${holding.tradingSymbol}:`, err.message);
                            hSpan.recordException(err);
                            hSpan.setStatus({ code: 2 });
                            
                            // Save a "failed" snapshot so the user at least knows it was attempted
                            await prisma.analysisHoldingSnapshot.create({
                                data: {
                                    metadataId: metadataId,
                                    holdingId: holding.id,
                                    tradingSymbol: holding.tradingSymbol,
                                    quantity: holding.quantity,
                                    averagePrice: holding.averagePrice,
                                    advice: 'ERROR',
                                    reasoning: err.message || 'Failed to fetch external data or analyze.',
                                    rawJson: {}
                                }
                            });
                        } finally {
                            hSpan.end();
                        }
                    });
                }

                const portfolioAdvice = await this.chatGptService.analyzePortfolio(portfolioData);

                const isSuccess = portfolioAdvice.diversificationScore !== 'N/A' && portfolioAdvice.riskProfile !== 'UNKNOWN';

                await prisma.analysisMetadata.update({
                    where: { id: metadataId },
                    data: {
                        status: isSuccess ? AnalysisStatus.COMPLETED : AnalysisStatus.FAILED,
                        completedAt: new Date(),
                        diversificationScore: portfolioAdvice.diversificationScore,
                        riskProfile: portfolioAdvice.riskProfile,
                        topPerformer: portfolioAdvice.topPerformer,
                        worstPerformer: portfolioAdvice.worstPerformer,
                        rebalancingNeeded: portfolioAdvice.rebalancingNeeded,
                        portfolioSummary: isSuccess ? portfolioAdvice.portfolioSummary : "Analysis failed to generate portfolio summary. Check logs or retry.",
                        sectorConcentration: portfolioAdvice.sectorConcentration
                    }
                });

                // 4. Truncate old analysis metadata if it exceeds N
                const MAX_ANALYSIS_HISTORY = parseInt(process.env.MAX_ANALYSIS_HISTORY || '10', 10);

                const completedAnalyses = await prisma.analysisMetadata.findMany({
                    where: { userId, status: AnalysisStatus.COMPLETED },
                    orderBy: { createdAt: 'desc' }
                });

                if (completedAnalyses.length > MAX_ANALYSIS_HISTORY) {
                    const analysesToDelete = completedAnalyses.slice(MAX_ANALYSIS_HISTORY);
                    const deleteIds = analysesToDelete.map((a: any) => a.id);
                    
                    await prisma.analysisMetadata.deleteMany({
                        where: { id: { in: deleteIds } }
                    });
                    console.log(`[Job] Truncated ${deleteIds.length} old analyses for userId: ${userId}`);
                }

                console.log(`[Job] Finished analysis for metadataId: ${metadataId}`);
                span.end();
            } catch (error) {
                console.error(`[Job] Error processing analysis metadataId: ${metadataId}`, error);
                span.recordException(error as Error);
                span.setStatus({ code: 2 });
                span.end();
                
                // Mark as failed
                await prisma.analysisMetadata.update({
                    where: { id: metadataId },
                    data: {
                        status: AnalysisStatus.FAILED,
                        completedAt: new Date(),
                        portfolioSummary: (error as any)?.message || 'An unexpected error occurred during analysis.'
                    }
                }).catch((err: any) => console.error('Failed to update metadata to failed status', err));
            }
        });
    }
}
