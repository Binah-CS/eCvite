import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Select,
  MenuItem,
  Box,
  IconButton,
  Collapse,
  Link,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';

const IGNORE_VALUE = '__IGNORE__';

// כמה ערכים לדוגמה (לא ריקים, ללא כפילויות) מהעמודה - מוצגים רק כשלוחצים על "הצג נתונים"
function getSampleValues(rows, header, limit = 5) {
  const seen = new Set();
  for (const row of rows) {
    const value = String(row[header] ?? '').trim();
    if (value) {
      seen.add(value);
    }
    if (seen.size >= limit) break;
  }
  return Array.from(seen);
}

// מסך שמופיע כשיש עמודות בקובץ ה-Excel שלא זוהו אוטומטית - המשתמשת בוחרת ידנית
// לאיזה שדה כל עמודה שייכת (או להתעלם ממנה), והבחירה נשמרת מיד כ"כינוי" חדש לפעם הבאה
export default function ColumnMatchDialog({ open, unmatchedHeaders, headerLabels = {}, columns, rows, onConfirm, onCancel, onOpenColumnSettings }) {
  const [choices, setChoices] = useState({});
  const [expandedHeader, setExpandedHeader] = useState(null);

  const handleChange = (header, value) => {
    setChoices((prev) => ({ ...prev, [header]: value }));
  };

  const handleConfirm = () => {
    onConfirm(choices);
    setChoices({});
  };

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5, pt: 1.5, fontSize: '1.05rem' }}>התאמת עמודות שלא זוהו אוטומטית</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={1}>
          בחרי לאיזה שדה שייכת כל עמודה - הבחירה תישמר אוטומטית גם לייבוא הבא.
        </Typography>
        {unmatchedHeaders.map((header) => {
          const isExpanded = expandedHeader === header;
          return (
            <Box key={header} mb={1}>
              <Box display="flex" alignItems="center" gap={1}>
                <Typography sx={{ minWidth: 130 }}>{headerLabels[header] ?? header}</Typography>
                <IconButton
                  size="small"
                  title="הצג נתונים מהעמודה"
                  onClick={() => setExpandedHeader(isExpanded ? null : header)}
                >
                  <VisibilityIcon fontSize="small" />
                </IconButton>
                <Select
                  size="small"
                  fullWidth
                  value={choices[header] ?? IGNORE_VALUE}
                  onChange={(e) => handleChange(header, e.target.value)}
                >
                  <MenuItem value={IGNORE_VALUE}>להתעלם מהעמודה הזו</MenuItem>
                  {columns.map((column) => (
                    <MenuItem key={column.technicalName} value={column.technicalName}>
                      {column.displayName}
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              <Collapse in={isExpanded}>
                <Typography variant="caption" color="text.secondary" sx={{ pr: 5 }}>
                  {(() => {
                    const samples = getSampleValues(rows, header);
                    return samples.length > 0 ? `נתונים בעמודה: ${samples.join(', ')}` : 'העמודה ריקה בקובץ';
                  })()}
                </Typography>
              </Collapse>
            </Box>
          );
        })}
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={onOpenColumnSettings}
          sx={{ display: 'block', mt: 1 }}
        >
          להגדרות נוספות על העמודות
        </Link>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>ביטול</Button>
        <Button variant="contained" onClick={handleConfirm}>
          אישור והמשך ייבוא
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { IGNORE_VALUE };
