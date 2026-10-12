import path from 'node:path';
import * as dotenv from 'dotenv';

// O .env fica na raiz do monorepo; também aceitamos um .env dentro de /api.
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const bool = (v: string | undefined) => v === 'true' || v === '1';

export const env = {
  port: parseInt(process.env.PORT || '3333', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/multimilionario',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-key-mudar-em-producao',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // URL pública da API (usada para montar links de PDF de certificado)
  publicApiUrl: (process.env.PUBLIC_API_URL || '').replace(/\/$/, ''),
  // URL pública do frontend (link de validação de certificado, retorno do checkout)
  publicWebUrl: (process.env.PUBLIC_WEB_URL || 'http://localhost:5173').replace(/\/$/, ''),
  uploadsDir: process.env.UPLOADS_DIR || path.resolve(process.cwd(), 'uploads'),
  redisUrl: process.env.REDIS_URL || '',
  bunny: {
    apiKey: process.env.BUNNY_API_KEY || '',
    libraryId: process.env.BUNNY_LIBRARY_ID || '',
    cdnHostname: process.env.BUNNY_CDN_HOSTNAME || '',
    embedTokenKey: process.env.BUNNY_EMBED_TOKEN_KEY || '',
    webhookSecret: process.env.BUNNY_WEBHOOK_SECRET || '',
  },
  cakto: {
    webhookSecret: process.env.CAKTO_WEBHOOK_SECRET || '',
  },
  // Permite "pagamento simulado" no checkout — somente para desenvolvimento.
  allowFakeCheckout: bool(process.env.ALLOW_FAKE_CHECKOUT),
};
