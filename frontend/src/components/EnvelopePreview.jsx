// src/components/EnvelopePreview.jsx
// תצוגת המעטפה: ראשית (פתוחה, או מעטפה אחת כשאין שולח), ולצדה חזית וגב אחרי קיפול.
// הכול מצויר על ידי EnvelopeSheet ומוקטן בקנה מידה, כך שזה אותו דבר בדיוק שמודפס.
import { useLayoutEffect, useRef, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import EnvelopeSheet from './EnvelopeSheet';
import { MM_TO_PX } from '../utils/envelopeFormats';
import { MODAL_TEXTS } from '../pages/HardCodePage';

const THUMBNAIL_RATIO = 0.3;
const COLUMN_GAP_PX = 8;

// מקטין משטח שלם לרוחב נתון. המשטח ממוקם ב-absolute עם left: 0 כי בעמוד RTL אלמנט רחב
// מההורה שלו גולש שמאלה, ואז נקודת העוגן של ה-scale הייתה במקום הלא נכון
function ScaledSurface({ surface, widthPx, sheetProps }) {
  const scale = widthPx / (surface.pageWidthMm * MM_TO_PX);
  return (
    <div
      style={{
        position: 'relative',
        width: widthPx,
        height: surface.pageHeightMm * MM_TO_PX * scale,
        overflow: 'hidden',
        boxShadow: '0 0 3px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${scale})`, transformOrigin: 'left top' }}>
        <EnvelopeSheet surface={surface} {...sheetProps} />
      </div>
    </div>
  );
}

function Caption({ children }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 0.5 }}>
      {children}
    </Typography>
  );
}

// גלישה נמדדת על הרכיב האמיתי: offset ו-client לא מושפעים מ-transform
function hasSenderOverflow(container) {
  return Array.from(container.querySelectorAll('[data-envelope-sender-box]')).some((box) => {
    const content = box.querySelector('[data-envelope-sender-content]');
    return content
      && (content.offsetHeight > box.clientHeight || content.scrollWidth > box.clientWidth + 1);
  });
}

export default function EnvelopePreview({ layout, row, senders, textOptions, getPrintFlag, width }) {
  const containerRef = useRef(null);
  const [overflow, setOverflow] = useState(false);

  useLayoutEffect(() => {
    setOverflow(Boolean(containerRef.current) && hasSenderOverflow(containerRef.current));
  }, [layout, row, senders, textOptions]);

  if (!layout) {
    return (
      <Box sx={{ width, flexShrink: 0 }}>
        <Typography variant="body2" color="error">{MODAL_TEXTS.ENVELOPE_PREVIEW_INVALID}</Typography>
      </Box>
    );
  }

  const sheetProps = { row, senders, textOptions, getPrintFlag, typography: layout.typography };
  const { finishedViews } = layout;
  const thumbnailWidth = Math.floor(width * THUMBNAIL_RATIO);
  const mainWidth = finishedViews ? width - thumbnailWidth - COLUMN_GAP_PX : width;

  return (
    <Box ref={containerRef} sx={{ width, flexShrink: 0, flexGrow: 0 }}>
      <Box sx={{ display: 'flex', gap: `${COLUMN_GAP_PX}px`, alignItems: 'flex-start' }}>
        <Box>
          <Caption>{finishedViews ? MODAL_TEXTS.ENVELOPE_PREVIEW_OPEN : MODAL_TEXTS.ENVELOPE_PREVIEW_SINGLE}</Caption>
          <ScaledSurface surface={layout.passes[0]} widthPx={mainWidth} sheetProps={sheetProps} />
        </Box>
        {finishedViews && (
          <Box>
            <Caption>{MODAL_TEXTS.ENVELOPE_PREVIEW_FRONT}</Caption>
            <ScaledSurface surface={finishedViews.front} widthPx={thumbnailWidth} sheetProps={sheetProps} />
            <Box sx={{ mt: 1 }}>
              <Caption>{MODAL_TEXTS.ENVELOPE_PREVIEW_BACK}</Caption>
              <ScaledSurface surface={finishedViews.back} widthPx={thumbnailWidth} sheetProps={sheetProps} />
            </Box>
          </Box>
        )}
      </Box>
      {overflow && <Alert severity="warning" sx={{ mt: 1 }}>{MODAL_TEXTS.ENVELOPE_SENDER_OVERFLOW}</Alert>}
    </Box>
  );
}
