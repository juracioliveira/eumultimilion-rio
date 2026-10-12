# Fluxo de Upload e Processamento de Vídeo (Bunny Stream)

## 1. Criação da aula (rascunho)
- Admin cria a aula no painel preenchendo título, descrição, ordem, módulo.
- Backend cria registro em `lessons` com `status = draft` e `bunny_video_id = null`.

## 2. Solicitação de upload
- Frontend chama `POST /api/lessons/:id/upload-url`.
- Backend chama a API do Bunny Stream (`POST /library/{libraryId}/videos`) para criar o objeto de vídeo e obter a `guid` (video id) + URL de upload (TUS resumable upload).
- Backend salva `bunny_video_id = guid` e `status = uploading`.
- Backend retorna a URL de upload assinada para o frontend.

## 3. Upload direto (browser → Bunny)
- Frontend faz upload do arquivo diretamente para a URL do Bunny via protocolo TUS (suporta resumable upload — importante para vídeos grandes/conexões instáveis).
- Servidor da EasyPanel não recebe o binário do vídeo em nenhum momento.

## 4. Processamento (transcodificação)
- Bunny transcodifica automaticamente em múltiplas resoluções/bitrates (HLS adaptativo).
- Tempo de processamento varia com duração do vídeo (geralmente minutos).

## 5. Webhook de conclusão
- Bunny envia webhook `POST /api/webhooks/bunny` quando o status do vídeo muda (ex: `Finished`, `Failed`).
- Backend valida a assinatura/origem do webhook.
- Evento é gravado em `webhook_events` (idempotência — evita processar o mesmo evento duas vezes).
- Se `Finished`: atualiza `lessons.status = ready`, `duration_seconds`, `thumbnail_url`.
- Se `Failed`: atualiza `lessons.status = failed`, notifica admin.

## 6. Consumo pelo aluno
- Frontend busca URL de reprodução HLS: `https://vz-{libraryId}.b-cdn.net/{videoId}/playlist.m3u8`.
- Player (hls.js/Vidstack) consome a playlist diretamente da CDN do Bunny.
- Backend só libera a URL/token de reprodução se o aluno tiver `purchases.status = paid` para o curso (ou a aula for `is_free_preview`).

## Observações de segurança
- Usar **Token Authentication** do Bunny Stream para URLs de vídeo com expiração curta, evitando que o link HLS seja compartilhado livremente.
- Webhook do Bunny deve ser validado (header de assinatura, se disponível no plano) antes de alterar o banco.
- Fila BullMQ pode processar o webhook de forma assíncrona para não travar a resposta ao Bunny.
