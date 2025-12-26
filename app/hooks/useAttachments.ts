import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LocalAttachment,
  ProviderType,
  UploadedFileReference,
} from '../../types';

export const useAttachments = () => {
  const [attachments, setAttachments] = useState<LocalAttachment[]>([]);
  const attachmentsRef = useRef<LocalAttachment[]>(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const buildAttachmentId = useCallback((file: File) => {
    return `${file.name}-${file.size}-${file.lastModified}`;
  }, []);

  const buildAttachmentRefs = useCallback(
    (
      provider: ProviderType,
      items: LocalAttachment[]
    ): UploadedFileReference[] =>
      items.map(item => ({
        provider,
        fileId: item.id,
        name: item.file.name,
        size: item.file.size,
        mimeType: item.file.type || undefined,
      })),
    []
  );

  const handleAddAttachments = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      setAttachments(prev => {
        const existing = new Set(prev.map(item => item.id));
        const next = [...prev];
        files.forEach(file => {
          const id = buildAttachmentId(file);
          if (!existing.has(id)) {
            next.push({ id, file, status: 'ready' });
          }
        });
        return next;
      });
    },
    [buildAttachmentId]
  );

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(item => item.id !== id));
  }, []);

  const updateAttachment = useCallback(
    (id: string, updates: Partial<LocalAttachment>) => {
      setAttachments(prev =>
        prev.map(item => (item.id === id ? { ...item, ...updates } : item))
      );
    },
    []
  );

  return {
    attachments,
    setAttachments,
    attachmentsRef,
    buildAttachmentRefs,
    handleAddAttachments,
    handleRemoveAttachment,
    updateAttachment,
  };
};
