import { useState, useEffect, useCallback } from 'react';
import { Download, File, ExternalLink, Loader2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { api } from '../../api/client';

interface Attachment {
  id: string;
  originalName: string;
  fileName: string;
  fileSize: number;
  contentType?: string;
  mimeType?: string;
  url: string;
  uploadedBy?: {
    firstName?: string;
    lastName?: string;
  };
}

interface AttachmentPreviewModalProps {
  attachment: Attachment | null;
  onClose: () => void;
}

// Office document MIME types
const OFFICE_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
];

export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Download file using API client (with auth)
  const handleDownload = useCallback(async () => {
    if (!attachment || downloading) return;

    setDownloading(true);
    try {
      const response = await api.get(`/storage/${attachment.id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: attachment.contentType || attachment.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }, [attachment, downloading]);

  // Open file in new tab using API client (with auth)
  const handleOpenInNewTab = useCallback(async () => {
    if (!attachment) return;

    try {
      const response = await api.get(`/storage/${attachment.id}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: attachment.contentType || attachment.mimeType });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch {
      // Error opening file
    }
  }, [attachment]);

  useEffect(() => {
    if (!attachment) return;

    const fetchFile = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/storage/${attachment.id}`, {
          responseType: 'blob',
        });
        const blob = new Blob([response.data], { type: attachment.contentType || attachment.mimeType });
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch {
        // Error loading file
      } finally {
        setLoading(false);
      }
    };

    fetchFile();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [attachment]);

  if (!attachment) return null;

  const contentType = attachment.contentType || attachment.mimeType || '';
  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';
  const isOffice = OFFICE_MIME_TYPES.includes(contentType);
  const isText = contentType.startsWith('text/');

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Modal isOpen={!!attachment} onClose={onClose} title={attachment.originalName} size="xl">
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
            {contentType && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-sm text-muted-foreground">{contentType}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenInNewTab}>
              <ExternalLink className="w-4 h-4 mr-1" />
              Open in New Tab
            </Button>
            <Button size="sm" onClick={handleDownload} disabled={downloading}>
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="max-h-[70vh] overflow-hidden bg-gray-100 dark:bg-gray-800 rounded-lg">
          {loading ? (
            <div className="flex items-center justify-center h-[65vh]">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-500">Loading preview...</span>
            </div>
          ) : (
            <>
              {/* Images */}
              {isImage && objectUrl && (
                <div className="flex items-center justify-center p-4 bg-gray-900">
                  <img
                    src={objectUrl}
                    alt={attachment.originalName}
                    className="max-w-full max-h-[65vh] object-contain"
                  />
                </div>
              )}

              {/* PDFs */}
              {isPdf && objectUrl && (
                <iframe
                  src={`${objectUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-[65vh] border-0"
                  title={attachment.originalName}
                />
              )}

              {/* Office Documents */}
              {isOffice && (
                <div className="flex flex-col h-[65vh]">
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                      window.location.origin + `/v1/storage/${attachment.id}`
                    )}&wdStartOn=1`}
                    className="w-full flex-1 border-0"
                    title={attachment.originalName}
                    frameBorder="0"
                  />
                </div>
              )}

              {/* Text files */}
              {isText && objectUrl && <TextPreview fileUrl={objectUrl} />}

              {/* Unsupported types */}
              {!isImage && !isPdf && !isOffice && !isText && (
                <div className="flex flex-col items-center justify-center h-[65vh] text-center p-4">
                  <div className="w-24 h-24 bg-white dark:bg-gray-700 rounded-lg shadow-sm flex items-center justify-center mb-4">
                    <File className="w-12 h-12 text-gray-400" />
                  </div>
                  <p className="text-gray-700 dark:text-gray-200 font-medium mb-2">
                    {attachment.originalName}
                  </p>
                  <p className="text-gray-500 text-sm mb-4">Preview not available for this file type.</p>
                  <Button onClick={handleDownload}>
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-muted-foreground">
            Uploaded by{' '}
            {attachment.uploadedBy?.firstName || attachment.uploadedBy?.lastName
              ? `${attachment.uploadedBy?.firstName || ''} ${attachment.uploadedBy?.lastName || ''}`.trim()
              : 'Unknown'}
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// Text Preview component
function TextPreview({ fileUrl }: { fileUrl: string }) {
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    fetch(fileUrl)
      .then((res) => res.text())
      .then((text) => setContent(text))
      .catch(console.error);
  }, [fileUrl]);

  if (!content) {
    return (
      <div className="flex items-center justify-center h-[65vh]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500">Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-4 overflow-auto h-[65vh]">
      <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
        {content}
      </pre>
    </div>
  );
}
