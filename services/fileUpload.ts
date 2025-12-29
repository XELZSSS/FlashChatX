import { GoogleGenAI } from '@google/genai';
import { ProviderConfig } from './providerConfig';
import { LocalAttachment, ProviderType, UploadedFileReference } from '../types';

const PROXY_BASE_URL = 'http://localhost:8787/api';

const SUPPORTED_UPLOAD_PROVIDERS: ProviderType[] = [
  'openai',
  'gemini',
  'anthropic',
];
const TOOL_FILE_PROVIDERS: ProviderType[] = [
  'openrouter',
  'deepseek',
  'z',
  'z-intl',
  'minimax',
  'moonshot',
  'mimo',
  'bailing',
  'longcat',
  'modelscope',
  'openai-compatible',
  'xai',
];

const getFileExtension = (name: string) => {
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index + 1).toLowerCase();
};

const guessMimeType = (file: File) => {
  if (file.type) return file.type;
  const ext = getFileExtension(file.name);
  switch (ext) {
    case 'txt':
      return 'text/plain';
    case 'md':
      return 'text/markdown';
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'bmp':
      return 'image/bmp';
    case 'gif':
      return 'image/gif';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    default:
      return 'application/octet-stream';
  }
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

export const supportsFileUpload = (provider: ProviderType) =>
  SUPPORTED_UPLOAD_PROVIDERS.includes(provider);

export const supportsToolFileHandling = (provider: ProviderType) =>
  TOOL_FILE_PROVIDERS.includes(provider);

type AttachmentUpdater = (
  id: string,
  updates: Partial<LocalAttachment>
) => void;

export const uploadFilesForProvider = async (
  providerConfig: ProviderConfig,
  attachments: LocalAttachment[],
  updateAttachment: AttachmentUpdater,
  t: (key: string) => string
): Promise<UploadedFileReference[]> => {
  const uploaded: UploadedFileReference[] = [];
  const provider = providerConfig.provider;

  for (const attachment of attachments) {
    updateAttachment(attachment.id, { status: 'uploading', error: undefined });

    const mimeType = guessMimeType(attachment.file);
    if (provider === 'gemini') {
      if (!providerConfig.apiKey) {
        throw new Error(t('errorMissingApiKey'));
      }

      const client = new GoogleGenAI({ apiKey: providerConfig.apiKey });
      const result = await client.files.upload({
        file: attachment.file,
        config: { mimeType, displayName: attachment.file.name },
      });

      uploaded.push({
        provider,
        fileId: result.name,
        fileUri: result.uri || result.name,
        name: result.displayName || attachment.file.name,
        size: attachment.file.size,
        mimeType: result.mimeType || mimeType,
      });

      updateAttachment(attachment.id, { status: 'uploaded' });
      continue;
    }

    const buffer = await attachment.file.arrayBuffer();
    const dataBase64 = arrayBufferToBase64(buffer);

    const response = await fetch(`${PROXY_BASE_URL}/${provider}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: attachment.file.name,
        mimeType,
        dataBase64,
        purpose: 'user_data',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `${t('fileUploadFailed')}: ${errorText || response.statusText}`
      );
    }

    const result = await response.json();

    if (provider === 'openai') {
      uploaded.push({
        provider,
        fileId: result.id,
        name: result.filename || attachment.file.name,
        size: attachment.file.size,
        mimeType,
      });
    } else if (provider === 'anthropic') {
      uploaded.push({
        provider,
        fileId: result.id,
        name: result.filename || attachment.file.name,
        size: attachment.file.size,
        mimeType,
      });
    }

    updateAttachment(attachment.id, { status: 'uploaded' });
  }

  return uploaded;
};
