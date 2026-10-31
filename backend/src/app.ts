import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { originGuard } from './middleware/originGuard.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import routes from './routes/index.js';
import { ApiError } from './utils/errors.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/server-to-server calls (no Origin header) and the
      // explicitly configured frontend origins.
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'CORS_ORIGIN_DENIED', `Origin ${origin} is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
    maxAge: 600,
  }),
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));
}

app.use(originGuard);
app.use('/api', apiRateLimiter, routes);

app.use(notFoundHandler);
app.use(errorHandler);
