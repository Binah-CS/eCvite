// src/components/ColumnValueFilter.jsx
import { createContext, useContext, useMemo, useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, IconButton, Popover, TextField, Tooltip, Typography } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { buildColumnFilter, isValueChecked } from '../utils/columnFilters';
import { valueLabel } from './FilterBuilder';

// מה שכותרת עמודה צריכה כדי להציג את כפתור הסינון: אילו עמודות מסוננות עכשיו, ואיך
// פותחים את חלון הסינון. דרך context ולא דרך הגדרת העמודות - כך שינוי בסינון לא
// מחייב לבנות מחדש את כל העמודות של הטבלה
export const ColumnFilterContext = createContext(null);

// כמה ערכים מוצגים ברשימה לכל היותר - בעמודה עם אלפי ערכים שונים (טלפון, שם)
// מצמצמים בעזרת החיפוש. "בחר הכל" חל תמיד על כל מה שמתאים לחיפוש, גם מה שלא מוצג
const MAX_LISTED_VALUES = 200;

export function ColumnFilterButton({ field, headerName }) {
  const context = useContext(ColumnFilterContext);
  if (!context) return null;
  const active = context.activeFields.has(field);
  return (
    <Tooltip title={active ? 'מסונן - לחצי לשינוי' : 'סינון העמודה'}>
      <IconButton
        size="small"
        data-filter-icon="true"
        onClick={(event) => {
          event.stopPropagation();
          context.openFilterMenu(field, headerName, event.currentTarget);
        }}
        sx={{ p: 0.25, flexShrink: 0, color: active ? '#2563eb' : 'inherit', bgcolor: active ? '#dbeafe' : 'transparent' }}
      >
        <FilterListIcon sx={{ fontSize: 14, opacity: active ? 1 : 0.35 }} />
      </IconButton>
    </Tooltip>
  );
}

// רשימת תיבות הסימון של עמודה אחת. values - [{ value, count }] של העמודה (אחרי שאר
// הסינונים); filter - הסינון הנוכחי שלה או null; onChange מקבל את הסינון החדש (או
// null = בלי סינון) מיד בכל סימון - זה אותו תנאי שמופיע גם בחלון "סינון"
export function ColumnFilterMenu({ anchorEl, headerName, values, filter, onChange, onClose }) {
  const [search, setSearch] = useState('');
  const allValues = useMemo(() => values.map((v) => v.value), [values]);
  // הסימונים נשמרים כאן (נקראים מהסינון הקיים רק בפתיחה) - כדי ש"ניקוי הכל" ואז סימון
  // של ערך אחד יעבוד כמו באקסל: מצב ביניים שבו כלום לא מסומן לא מסנן את הטבלה (אחרת
  // היא הייתה מתרוקנת לגמרי), והטבלה מתעדכנת שוב ברגע שמסמנים ערך כלשהו
  const [checked, setChecked] = useState(
    () => new Set(values.map((v) => v.value).filter((value) => isValueChecked(filter, value)))
  );

  const term = search.trim().toLowerCase();
  const matching = term ? values.filter(({ value }) => valueLabel(value).toLowerCase().includes(term)) : values;
  const listed = matching.slice(0, MAX_LISTED_VALUES);
  const allMatchingChecked = matching.length > 0 && matching.every(({ value }) => checked.has(value));
  const someMatchingChecked = matching.some(({ value }) => checked.has(value));

  // "כולל" או "לא כולל" - לפי מה שהמשתמשת עשתה (ר' buildColumnFilter): מתחילים מהסינון
  // הקיים (בלי סינון = הכל מסומן, כלומר מורידים מ"הכל" = "לא כולל"), "ניקוי הכל" עובר
  // ל"כולל" ו"בחר הכל" חוזר ל"לא כולל"
  const [mode, setMode] = useState(filter?.mode || 'exclude');

  const apply = (nextChecked, nextMode = mode) => {
    setChecked(nextChecked);
    setMode(nextMode);
    if (nextChecked.size > 0) onChange(buildColumnFilter(allValues, nextChecked, nextMode));
  };

  const toggleValue = (value) => {
    const next = new Set(checked);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    apply(next);
  };

  // בלי חיפוש - מסמן/מנקה הכל. עם חיפוש - רק את מה שמתאים לו (כמו באקסל): "כהן" ואז
  // "בחר הכל" = כל מי שמתאים ל"כהן", בלי לגעת בסימונים של השאר
  const toggleAllMatching = () => {
    const next = new Set(checked);
    matching.forEach(({ value }) => (allMatchingChecked ? next.delete(value) : next.add(value)));
    apply(next, term ? mode : (allMatchingChecked ? 'include' : 'exclude'));
  };

  const labelSx = { m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8rem', flex: 1, minWidth: 0 } };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 260, p: 1.25, borderRadius: 2 } } }}
    >
      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', mb: 1 }}>
        סינון: {headerName}
      </Typography>
      <TextField
        size="small"
        fullWidth
        autoFocus
        placeholder="חיפוש..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        inputProps={{ style: { fontSize: '0.8rem' } }}
      />

      <FormControlLabel
        sx={{ ...labelSx, mt: 0.5, borderBottom: '1px solid #e2e8f0' }}
        control={
          <Checkbox
            size="small"
            checked={allMatchingChecked}
            indeterminate={!allMatchingChecked && someMatchingChecked}
            onChange={toggleAllMatching}
          />
        }
        label={term ? `(בחר את כל התוצאות - ${matching.length})` : '(בחר הכל)'}
      />

      <Box sx={{ maxHeight: 260, overflowY: 'auto' }}>
        {listed.map(({ value, count }) => (
          <FormControlLabel
            key={value}
            sx={{ ...labelSx, display: 'flex' }}
            control={<Checkbox size="small" checked={checked.has(value)} onChange={() => toggleValue(value)} />}
            label={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box component="span" sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {valueLabel(value)}
                </Box>
                <Box component="span" sx={{ color: '#94a3b8' }}>{count}</Box>
              </Box>
            }
          />
        ))}
        {matching.length === 0 && (
          <Typography sx={{ fontSize: '0.8rem', color: '#94a3b8', py: 1, textAlign: 'center' }}>אין תוצאות</Typography>
        )}
        {matching.length > listed.length && (
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', py: 0.5 }}>
            מוצגים {listed.length} מתוך {matching.length} - הקלידי בחיפוש כדי לצמצם
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
        <Button size="small" disabled={!filter} onClick={() => { setChecked(new Set(allValues)); setMode('exclude'); onChange(null); }} sx={{ fontSize: '0.75rem' }}>
          נקה סינון
        </Button>
        <Button size="small" variant="contained" onClick={onClose} sx={{ fontSize: '0.75rem' }}>
          סגור
        </Button>
      </Box>
    </Popover>
  );
}
