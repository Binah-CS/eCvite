// src/components/EnvelopePreview.jsx
// תצוגת המעטפה: ראשית (פתוחה, או מעטפה אחת כשאין לשונית), ולצדה חזית וגב אחרי קיפול.
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

const NO_OVERFLOW = { sender: false, recipients: 0 };

// גלישה נמדדת על הרכיב האמיתי: offset ו-client לא מושפעים מ-transform. שורה שנשברה
// מגדילה את הגובה, ומילה שלא נשברת את הרוחב
function overflows(box, contentSelector) {
  const content = box.querySelector(contentSelector);
  return Boolean(content)
    && (content.offsetHeight > box.clientHeight || content.scrollWidth > box.clientWidth + 1);
}

// השולח זהה בכל המעטפות, ולכן מספיק לדעת אם הוא גולש. אצל הנמען סופרים את התיבות שגולשות:
// בעמוד ההדפסה יש תיבת נמען אחת לכל מעטפה, ולכן זה מספר המעטפות
function measureEnvelopeOverflow(container) {
  const boxes = (role) => Array.from(container.querySelectorAll(`[data-envelope-${role}-box]`));
  return {
    sender: boxes('sender').some((box) => overflows(box, '[data-envelope-sender-content]')),
    recipients: boxes('recipient').filter((box) => overflows(box, '[data-envelope-recipient-content]')).length,
  };
}

// מה גולש בתוך הרכיב שמקבל את ה-ref. נמדד מחדש כשמשתנה משהו שמשפיע על הטקסט: הפריסה (כולל
// הכתב), השולחים, אפשרויות הטקסט, או מה שמוצג (נמען אחד בתצוגה, כל הנמענים בעמוד ההדפסה).
// משמש גם את התצוגה כאן וגם את עמוד ההדפסה
export function useEnvelopeOverflow({ layout, senders, textOptions, content }) {
  const ref = useRef(null);
  const [overflow, setOverflow] = useState(NO_OVERFLOW);
  useLayoutEffect(() => {
    const next = ref.current ? measureEnvelopeOverflow(ref.current) : NO_OVERFLOW;
    // אובייקט חדש בכל מדידה היה מרנדר שוב בלי סוף
    setOverflow((current) => (current.sender === next.sender && current.recipients === next.recipients ? current : next));
  }, [layout, senders, textOptions, content]);
  return [ref, overflow];
}

// ההערות שמתחת למעטפה: גלישת השולח (לפי המצב), גלישת נמען, ושולח שני שמצב הפינה לא מדפיס.
// countRecipients: בעמוד ההדפסה ההודעה על הנמען אומרת בכמה מעטפות. בחלון יש נמען אחד
export function EnvelopeNotices({ layout, overflow = NO_OVERFLOW, countRecipients = false }) {
  return (
    <>
      {overflow.sender && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {layout?.senderMode === 'frontCorner' ? MODAL_TEXTS.ENVELOPE_SENDER_CORNER_OVERFLOW : MODAL_TEXTS.ENVELOPE_SENDER_OVERFLOW}
        </Alert>
      )}
      {overflow.recipients > 0 && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {MODAL_TEXTS.ENVELOPE_RECIPIENT_OVERFLOW(countRecipients ? overflow.recipients : null)}
        </Alert>
      )}
      {layout?.omittedSenderCount > 0 && <Alert severity="info" sx={{ mt: 1 }}>{MODAL_TEXTS.ENVELOPE_ONE_SENDER_NOTE}</Alert>}
    </>
  );
}

// showNotices={false} כשמי שמציג את התצוגה מציג את ההערות בעצמו (עמוד ההדפסה), כדי
// שלא יופיעו פעמיים
export default function EnvelopePreview({ layout, row, senders, textOptions, getPrintFlag, width, showNotices = true }) {
  const [containerRef, overflow] = useEnvelopeOverflow({ layout, senders, textOptions, content: row });

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
      {showNotices && <EnvelopeNotices layout={layout} overflow={overflow} />}
    </Box>
  );
}
