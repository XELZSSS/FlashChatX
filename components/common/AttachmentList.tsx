import React, { memo } from 'react';
import { Paperclip, X } from 'lucide-react';
import { LocalAttachment } from '../../types';
import { useTranslation } from '../../contexts/useTranslation';

interface AttachmentListProps {
  readonly attachments: LocalAttachment[];
  readonly onRemoveAttachment: (id: string) => void;
  readonly isUploading: boolean;
}

interface AttachmentItemProps {
  readonly item: LocalAttachment;
  readonly onRemove: (id: string) => void;
  readonly isUploading: boolean;
}

const AttachmentItem: React.FC<AttachmentItemProps> = memo(
  ({ item, onRemove, isUploading }) => {
    const { t } = useTranslation();

    return (
      <div className="flex flex-col gap-1 flex-shrink-0">
        <div className="inline-flex max-w-full items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 surface">
          <Paperclip className="w-4 h-4 text-subtle" />
          <span className="text-sm whitespace-nowrap">{item.file.name}</span>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="flex items-center justify-center w-6 h-6 rounded-full border border-transparent text-subtle hover:text-[var(--text)] hover:bg-[var(--panel-strong)] transition-colors"
            aria-label={t('removeFile')}
            disabled={isUploading}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {item.status === 'uploading' && (
          <span className="text-xs text-subtle pl-6">
            {item.error || t('fileUploading')}
          </span>
        )}
        {item.status === 'error' && (
          <span className="text-xs text-red-500 pl-6">
            {item.error || t('fileUploadFailed')}
          </span>
        )}
        {item.status === 'uploaded' && (
          <span className="text-xs text-subtle pl-6">{t('fileUploaded')}</span>
        )}
      </div>
    );
  }
);

AttachmentItem.displayName = 'AttachmentItem';

const AttachmentList: React.FC<AttachmentListProps> = memo(
  ({ attachments, onRemoveAttachment, isUploading }) => {
    if (attachments.length === 0) {
      return null;
    }

    return (
      <div className="mt-3 flex flex-nowrap items-start gap-2 overflow-x-auto">
        {attachments.map(item => (
          <AttachmentItem
            key={item.id}
            item={item}
            onRemove={onRemoveAttachment}
            isUploading={isUploading}
          />
        ))}
      </div>
    );
  }
);

AttachmentList.displayName = 'AttachmentList';

export default AttachmentList;
