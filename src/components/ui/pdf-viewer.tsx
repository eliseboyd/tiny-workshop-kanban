'use client';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import styles from './pdf-viewer.module.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type PDFViewerProps = {
  url: string;
  fileName: string;
};

export function PDFViewer({ url, fileName }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  const goToPrevPage = () => setPageNumber(prev => Math.max(1, prev - 1));
  const goToNextPage = () => setPageNumber(prev => Math.min(numPages, prev + 1));
  const zoomIn = () => setScale(prev => Math.min(2.0, prev + 0.25));
  const zoomOut = () => setScale(prev => Math.max(0.5, prev - 0.25));

  return (
    <div className={styles.Root}>
      {/* Toolbar */}
      <div className={styles.Toolbar}>
        <div className={styles.Group}>
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className={styles.IconButton}
          >
            <ChevronLeft className={styles.Icon} />
          </Button>
          <span className={styles.PageCount}>
            {pageNumber} / {numPages || '?'}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className={styles.IconButton}
          >
            <ChevronRight className={styles.Icon} />
          </Button>
        </div>

        <div className={styles.Group}>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className={styles.IconButton}
          >
            <ZoomOut className={styles.Icon} />
          </Button>
          <span className={styles.Zoom}>{Math.round(scale * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={zoomIn}
            disabled={scale >= 2.0}
            className={styles.IconButton}
          >
            <ZoomIn className={styles.Icon} />
          </Button>
        </div>

        <a href={url} download={fileName}>
          <Button variant="outline" size="sm" className={styles.DownloadButton}>
            <Download className={styles.Icon} />
            <span className={styles.DownloadLabel}>Download</span>
          </Button>
        </a>
      </div>

      {/* PDF Content */}
      <div className={styles.Content}>
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          loading={
            <div className={styles.Status}>
              Loading PDF...
            </div>
          }
          error={
            <div className={styles.Error}>
              <p>Failed to load PDF</p>
              <a href={url} download className={styles.ErrorLink}>
                Download instead
              </a>
            </div>
          }
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            renderTextLayer={true}
            renderAnnotationLayer={true}
            className={styles.Page}
          />
        </Document>
      </div>
    </div>
  );
}

