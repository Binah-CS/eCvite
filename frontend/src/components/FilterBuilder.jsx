// src/components/FilterBuilder.jsx
import { Autocomplete, Box, Button, Checkbox, IconButton, MenuItem, Popover, TextField, Typography, createFilterOptions } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { EMPTY_VALUE } from '../utils/columnFilters';

export const valueLabel = (value) => (value === EMPTY_VALUE ? '(ריק)' : value);

// בעמודה עם אלפי ערכים שונים (טלפון, שם) מציגים עד 200 התאמות - מצמצמים בהקלדה
const filterValueOptions = createFilterOptions({ limit: 200, stringify: (option) => valueLabel(option.value) });

const smallSx = { '& .MuiInputBase-root': { fontSize: '0.8rem' } };

let nextConditionId = 1;
export const newCondition = () => ({ id: nextConditionId++, field: '', mode: 'include', values: [] });

// חלון "סינון": תנאים בשורות - [עמודה] [כולל / לא כולל] [ערכים]. כמה ערכים בתנאי =
// "או", "לא כולל" = "חוץ מ", כמה תנאים = "וגם". כל שינוי חל על הטבלה מיד.
// fields - [{ field, label }]; getValues(field) - [{ value, count }] של העמודה (אחרי
// שאר התנאים); onChange מקבל את רשימת התנאים החדשה
export default function FilterBuilder({ anchorEl, onClose, fields, conditions, onChange, getValues }) {
  const rowsToShow = conditions.length > 0 ? conditions : [newCondition()];

  const updateCondition = (id, changes) => {
    const exists = conditions.some((c) => c.id === id);
    const base = exists ? conditions : rowsToShow;
    onChange(base.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  };

  const removeCondition = (id) => onChange(conditions.filter((c) => c.id !== id));

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { width: 640, maxWidth: 'calc(100vw - 32px)', p: 1.5, borderRadius: 2 } } }}
    >
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', mb: 1 }}>סינון</Typography>

      {rowsToShow.map((condition) => {
        // עמודה אחת - תנאי אחד. עמודה שכבר יש לה תנאי לא מוצעת שוב בשורה אחרת
        const usedElsewhere = new Set(conditions.filter((c) => c.id !== condition.id).map((c) => c.field));
        const options = condition.field ? getValues(condition.field) : [];
        const selected = condition.values.map(
          (value) => options.find((o) => o.value === value) || { value, count: 0 }
        );
        return (
          <Box key={condition.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
            <TextField
              select
              size="small"
              label="עמודה"
              value={condition.field}
              onChange={(e) => updateCondition(condition.id, { field: e.target.value, values: [] })}
              sx={{ width: 140, flexShrink: 0, ...smallSx }}
            >
              {fields.filter((f) => !usedElsewhere.has(f.field)).map((f) => (
                <MenuItem key={f.field} value={f.field} sx={{ fontSize: '0.8rem' }}>{f.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              value={condition.mode}
              onChange={(e) => updateCondition(condition.id, { mode: e.target.value })}
              sx={{ width: 105, flexShrink: 0, ...smallSx }}
            >
              <MenuItem value="include" sx={{ fontSize: '0.8rem' }}>כולל</MenuItem>
              <MenuItem value="exclude" sx={{ fontSize: '0.8rem' }}>לא כולל</MenuItem>
            </TextField>

            <Autocomplete
              multiple
              size="small"
              disableCloseOnSelect
              disabled={!condition.field}
              options={options}
              value={selected}
              filterOptions={filterValueOptions}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => valueLabel(option.value)}
              onChange={(e, newValue) => updateCondition(condition.id, { values: newValue.map((o) => o.value) })}
              limitTags={3}
              noOptionsText="אין ערכים"
              renderOption={(props, option, { selected: isSelected }) => (
                <li {...props} key={option.value} style={{ fontSize: '0.8rem', padding: '0 8px' }}>
                  <Checkbox size="small" checked={isSelected} sx={{ p: 0.5, mr: 0.5 }} />
                  <Box component="span" sx={{ flex: 1 }}>{valueLabel(option.value)}</Box>
                  <Box component="span" sx={{ color: '#94a3b8' }}>{option.count}</Box>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="ערכים" placeholder={condition.values.length ? '' : 'בחרי או הקלידי...'} sx={smallSx} />
              )}
              sx={{ flex: 1, minWidth: 0 }}
            />

            <IconButton size="small" onClick={() => removeCondition(condition.id)} sx={{ mt: 0.5 }} title="הסר תנאי">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        );
      })}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...rowsToShow, newCondition()])} sx={{ fontSize: '0.75rem' }}>
          הוסף תנאי
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" disabled={conditions.length === 0} onClick={() => onChange([])} sx={{ fontSize: '0.75rem' }}>
            נקה הכל
          </Button>
          <Button size="small" variant="contained" onClick={onClose} sx={{ fontSize: '0.75rem' }}>
            סגור
          </Button>
        </Box>
      </Box>
    </Popover>
  );
}
