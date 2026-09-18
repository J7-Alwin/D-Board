import React, { useState, useEffect } from 'react';
import JSZip from 'jszip';
import type { AttachmentDTO } from '../../../api/files.api';
import { filesApi } from '../../../api/files.api';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MaximizeIcon,
  LayersIcon,
  DownloadIcon,
} from '../../ui/Icons';
import { Button } from '../../ui/Button';

interface SlideData {
  index: number;
  title: string;
  texts: string[];
}

interface PresentationViewerProps {
  file: AttachmentDTO;
}

export const PresentationViewer: React.FC<PresentationViewerProps> = ({ file }) => {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setCurrentSlideIndex(0);

    filesApi
      .fetchFileArrayBuffer(file.projectId, file.id)
      .then(async (arrayBuffer) => {
        if (!active) return;
        try {
          const zip = await JSZip.loadAsync(arrayBuffer);
          const slideFiles = Object.keys(zip.files).filter((k) =>
            /^ppt\/slides\/slide\d+\.xml$/i.test(k)
          );

          if (slideFiles.length === 0) {
            // Fallback for presentation files with different structure
            setSlides([
              {
                index: 1,
                title: file.originalName.replace(/\.[^/.]+$/, ''),
                texts: ['Presentation slide structure ready for download.'],
              },
            ]);
            return;
          }

          // Sort slides by number
          slideFiles.sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            return numA - numB;
          });

          const extractedSlides: SlideData[] = [];

          for (let i = 0; i < slideFiles.length; i++) {
            const xmlContent = await zip.files[slideFiles[i]].async('text');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

            // Extract all text nodes (<a:t>)
            const textNodes = xmlDoc.getElementsByTagName('a:t');
            const textLines: string[] = [];

            for (let j = 0; j < textNodes.length; j++) {
              const text = textNodes[j].textContent?.trim();
              if (text) {
                textLines.push(text);
              }
            }

            const title = textLines.length > 0 ? textLines[0] : `Slide ${i + 1}`;
            const bodyTexts = textLines.length > 1 ? textLines.slice(1) : [];

            extractedSlides.push({
              index: i + 1,
              title,
              texts: bodyTexts,
            });
          }

          setSlides(extractedSlides);
        } catch (err: any) {
          throw new Error(err.message || 'Failed to parse presentation slides');
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Failed to load presentation');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [file.projectId, file.id]);

  const activeSlide = slides[currentSlideIndex] || slides[0];

  const handlePrev = () => setCurrentSlideIndex((i) => Math.max(i - 1, 0));
  const handleNext = () => setCurrentSlideIndex((i) => Math.min(i + 1, slides.length - 1));

  if (loading) {
    return (
      <div className="viewer-loading-state">
        <div className="btn-spinner" />
        <p>Extracting presentation slides...</p>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="viewer-error-state">
        <LayersIcon size={40} className="viewer-error-icon" />
        <h3>Unable to parse presentation</h3>
        <p className="text-secondary">{error || 'Could not parse slides from file.'}</p>
        <a href={filesApi.getFileDownloadUrl(file.projectId, file.id)} download={file.originalName}>
          <Button variant="primary" size="sm" leftIcon={<DownloadIcon size={14} />}>
            Download Presentation
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className={`presentation-viewer-container ${isFullscreen ? 'viewer-fullscreen' : ''}`}>
      {/* Sidebar Thumbnail Strip */}
      <div className="slide-thumbnails-sidebar">
        <div className="slide-thumbnails-header">
          <span>Slides ({slides.length})</span>
        </div>
        <div className="slide-thumbnails-list">
          {slides.map((slide, idx) => (
            <div
              key={slide.index}
              className={`slide-thumbnail-card ${idx === currentSlideIndex ? 'active' : ''}`}
              onClick={() => setCurrentSlideIndex(idx)}
            >
              <div className="thumbnail-number">{slide.index}</div>
              <div className="thumbnail-content">
                <span className="thumbnail-title">{slide.title}</span>
                <span className="thumbnail-lines">{slide.texts.length} item(s)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Slide Canvas */}
      <div className="slide-main-canvas-wrapper">
        <div className="slide-canvas-surface">
          <div className="slide-header-box">
            <h2 className="slide-main-title">{activeSlide?.title}</h2>
          </div>

          <div className="slide-body-box">
            {activeSlide?.texts && activeSlide.texts.length > 0 ? (
              <ul className="slide-bullet-list">
                {activeSlide.texts.map((text, tIdx) => (
                  <li key={tIdx} className="slide-bullet-item">
                    {text}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="slide-empty-prompt">
                <span>(Title Slide / Visual Slide)</span>
              </div>
            )}
          </div>

          <div className="slide-footer-box">
            <span className="slide-watermark">{file.originalName}</span>
            <span className="slide-counter-tag">
              Slide {activeSlide?.index} of {slides.length}
            </span>
          </div>
        </div>

        {/* Slide Controls Toolbar */}
        <div className="slide-controls-toolbar">
          <button
            type="button"
            className="slide-nav-btn"
            disabled={currentSlideIndex <= 0}
            onClick={handlePrev}
            title="Previous Slide (Left Arrow)"
          >
            <ChevronLeftIcon size={16} />
            <span>Prev</span>
          </button>

          <span className="slide-nav-indicator">
            {currentSlideIndex + 1} / {slides.length}
          </span>

          <button
            type="button"
            className="slide-nav-btn"
            disabled={currentSlideIndex >= slides.length - 1}
            onClick={handleNext}
            title="Next Slide (Right Arrow)"
          >
            <span>Next</span>
            <ChevronRightIcon size={16} />
          </button>

          <div className="viewer-toolbar-divider" />

          <button
            type="button"
            className={`slide-nav-btn ${isFullscreen ? 'active' : ''}`}
            onClick={() => setIsFullscreen(!isFullscreen)}
            title="Toggle Fullscreen"
          >
            <MaximizeIcon size={14} />
            <span>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
