import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { env } from '../env.js';

export function newVerificationCode(): string {
  // 12 caracteres sem ambiguidade (sem 0/O/1/I)
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export function formatWorkload(totalSeconds: number): string {
  const hours = Math.max(1, Math.round(totalSeconds / 3600));
  return `${hours} hora${hours > 1 ? 's' : ''}`;
}

/** Gera o PDF do certificado em UPLOADS_DIR e retorna a URL pública. */
export async function generateCertificatePdf(opts: {
  studentName: string;
  contentTitle: string;
  kind: 'course' | 'learning_path';
  verificationCode: string;
  workloadSeconds?: number;
  issuedAt?: Date;
}): Promise<string> {
  fs.mkdirSync(env.uploadsDir, { recursive: true });
  const fileName = `cert_${opts.verificationCode}.pdf`;
  const filePath = path.join(env.uploadsDir, fileName);
  const issuedAt = opts.issuedAt ?? new Date();

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
    const stream = fs.createWriteStream(filePath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.pipe(stream);

    const { width, height } = doc.page;
    doc.rect(0, 0, width, height).fill('#0B0E16');
    doc.lineWidth(1.5).rect(28, 28, width - 56, height - 56).stroke('#C6A15B');

    doc.fillColor('#C6A15B').font('Helvetica-Bold').fontSize(14).text('MULTIMILIONÁRIO', 0, 70, { align: 'center', characterSpacing: 4 });
    doc.fillColor('#F6F4EE').font('Helvetica-Bold').fontSize(38).text('Certificado de Conclusão', 0, 110, { align: 'center' });
    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(16).text('Certificamos que', 0, 190, { align: 'center' });
    doc.fillColor('#F6F4EE').font('Helvetica-Bold').fontSize(32).text(opts.studentName, 0, 222, { align: 'center' });
    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(16)
      .text(opts.kind === 'course' ? 'concluiu com êxito o curso' : 'concluiu com êxito a trilha de aprendizagem', 0, 276, { align: 'center' });
    doc.fillColor('#C6A15B').font('Helvetica-Bold').fontSize(26).text(opts.contentTitle, 60, 308, { align: 'center', width: width - 120 });

    if (opts.workloadSeconds) {
      doc.fillColor('#9CA3AF').font('Helvetica').fontSize(13)
        .text(`Carga horária: ${formatWorkload(opts.workloadSeconds)}`, 0, 380, { align: 'center' });
    }

    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(11);
    doc.text(`Emitido em ${issuedAt.toLocaleDateString('pt-BR')}`, 60, height - 90);
    doc.text(`Código de verificação: ${opts.verificationCode}`, 60, height - 74);
    doc.text(`Valide em ${env.publicWebUrl}/certificados/${opts.verificationCode}`, 0, height - 74, { align: 'right', width: width - 60 });
    doc.end();
  });

  return `${env.publicApiUrl}/uploads/${fileName}`;
}
