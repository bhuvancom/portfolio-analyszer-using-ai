import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { PrismaInstrumentation } from '@prisma/instrumentation';

// For debugging OpenTelemetry issues (enable via OTEL_DEBUG='true' in .env)
if (process.env.OTEL_DEBUG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
}

// Use environment variables for configuration
const TEMPO_URL = process.env.TEMPO_URL || 'http://localhost:4318/v1/traces';

// Disable default metrics export which causes 404s with Tempo (it only accepts traces)
process.env.OTEL_METRICS_EXPORTER = 'none';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    'service.name': 'vantage-ai-backend',
    'service.version': '1.0.0',
    'deployment.environment': process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: TEMPO_URL,
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // We can disable specific instrumentations if they're too noisy
      '@opentelemetry/instrumentation-fs': { enabled: false }, // Usually too much noise
    }),
    new PrismaInstrumentation(),
  ],
});

sdk.start();

export default sdk;

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});
