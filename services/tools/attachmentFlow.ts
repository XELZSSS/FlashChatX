import type {
  LocalAttachment,
  ProviderConfig,
  ProviderType,
  UploadedFileReference,
} from '../../types';
import {
  supportsFileUpload,
  supportsToolFileHandling,
  uploadFilesForProvider,
} from './fileUpload';
import { isToolEnabled, READ_FILE_TOOL_NAME } from './toolRegistry';

type AttachmentFlowOptions = {
  providerConfig: ProviderConfig;
  attachments: LocalAttachment[];
  updateAttachment: (id: string, updates: Partial<LocalAttachment>) => void;
  buildAttachmentRefs: (
    provider: ProviderType,
    items: LocalAttachment[]
  ) => UploadedFileReference[];
  t: (key: string) => string;
};

export type AttachmentFlowResult = {
  uploadedFiles: UploadedFileReference[];
  localAttachmentsForRequest?: LocalAttachment[];
  shouldAbort: boolean;
};

export const resolveAttachmentsForRequest = async (
  options: AttachmentFlowOptions
): Promise<AttachmentFlowResult> => {
  const {
    providerConfig,
    attachments,
    updateAttachment,
    buildAttachmentRefs,
    t,
  } = options;

  if (!attachments.length) {
    return { uploadedFiles: [], shouldAbort: false };
  }

  const provider = providerConfig.provider;

  if (!supportsFileUpload(provider)) {
    if (
      supportsToolFileHandling(provider) &&
      isToolEnabled(providerConfig.toolConfig, READ_FILE_TOOL_NAME)
    ) {
      return {
        uploadedFiles: buildAttachmentRefs(provider, attachments),
        localAttachmentsForRequest: [...attachments],
        shouldAbort: false,
      };
    }

    attachments.forEach(item =>
      updateAttachment(item.id, {
        status: 'error',
        error: t('fileUploadUnsupported'),
      })
    );
    return { uploadedFiles: [], shouldAbort: true };
  }

  try {
    const uploadedFiles = await uploadFilesForProvider(
      providerConfig,
      attachments,
      updateAttachment,
      t
    );
    return { uploadedFiles, shouldAbort: false };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : t('fileUploadFailed');
    attachments.forEach(item =>
      updateAttachment(item.id, { status: 'error', error: message })
    );
    return { uploadedFiles: [], shouldAbort: true };
  }
};
