import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { certificates, users } from '../db/schema.js';

/** Validação pública de certificado (/certificados/:code no frontend). */
export const certificateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/:code', async (request, reply) => {
    const { code } = request.params as { code: string };
    const [cert] = await db
      .select({
        type: certificates.type,
        contentTitle: certificates.contentTitleSnapshot,
        issuedAt: certificates.issuedAt,
        pdfUrl: certificates.pdfUrl,
        verificationCode: certificates.verificationCode,
        studentName: users.name,
      })
      .from(certificates)
      .innerJoin(users, eq(certificates.userId, users.id))
      .where(eq(certificates.verificationCode, code.toUpperCase()))
      .limit(1);
    if (!cert) return reply.status(404).send({ error: 'Certificado não encontrado ou código inválido' });
    return { certificate: cert };
  });
};
