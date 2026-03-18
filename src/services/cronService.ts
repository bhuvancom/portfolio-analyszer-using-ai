import cron from 'node-cron';
import prisma from '../utils/db';
import { AnalysisStatus } from '../constants/status';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('cron-service');

export class CronService {
    public static init() {
        // Run every 15 minutes
        cron.schedule('*/15 * * * *', async () => {
            return tracer.startActiveSpan('cron_cleanup_stagnant', async (span) => {
                console.log('[Cron] Checking for stagnant analyses...');
                try {
                    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

                    // Any analysis in RUNNING status created more than 2 minutes ago
                    const stagnantAnalyses = await prisma.analysisMetadata.findMany({
                        where: {
                            status: AnalysisStatus.REFRESHING,
                            createdAt: { lt: fifteenMinutesAgo }
                        }
                    });

                    span.setAttribute('cron.stagnant_count', stagnantAnalyses.length);

                    if (stagnantAnalyses.length > 0) {
                        console.log(`[Cron] Found ${stagnantAnalyses.length} stagnant analyses. Marking as FAILED.`);

                        await prisma.analysisMetadata.updateMany({
                            where: {
                                id: { in: stagnantAnalyses.map(a => a.id) }
                            },
                            data: {
                                status: AnalysisStatus.FAILED,
                                completedAt: new Date(),
                                portfolioSummary: 'Analysis took too long (>2 mins) and was terminated by system.'
                            }
                        });
                    }
                    span.end();
                } catch (error: any) {
                    console.error('[Cron] Error during stagnant analysis cleanup:', error);
                    span.recordException(error);
                    span.setStatus({ code: SpanStatusCode.ERROR });
                    span.end();
                }
            });
        });

        console.log('[Cron] Analysis monitor initialized (every 15 min).');
    }
}
