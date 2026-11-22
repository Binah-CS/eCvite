// src/components/FontSelect.jsx
// בחירת כתב מתוך fonts.js, בקבוצות. כל אפשרות מוצגת בכתב שלה. הדוגמה והתגית נגזרות רק
// מ-scripts של הכתב: עברית ואנגלית - השם הלטיני ודוגמה "אבג"; שפה אחת - השם בשפה הזו
// ותגית "עברית בלבד"/"אנגלית בלבד" (רק בתפריט, לא בשדה הסגור)
import { Box, Chip, FormControl, InputLabel, ListSubheader, MenuItem, Select } from '@mui/material';
import { FONTS, FONT_CATEGORIES, getFont, supportsScript } from '../fonts/fonts';

const SINGLE_SCRIPT_TAGS = { he: 'עברית בלבד', en: 'אנגלית בלבד' };
const BOTH_SCRIPTS_SAMPLE = 'אבג';

function FontOptionLabel({ font, showTag }) {
  const bothScripts = supportsScript(font, 'he') && supportsScript(font, 'en');
  const tag = font.scripts.length === 1 ? SINGLE_SCRIPT_TAGS[font.scripts[0]] : null;
  return (
    <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, width: '100%' }}>
      <Box component="span" sx={{ fontFamily: font.cssFamily, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {font.displayName}
        {bothScripts && (
          <Box component="span" sx={{ marginInlineStart: 1, color: 'text.secondary' }}>{BOTH_SCRIPTS_SAMPLE}</Box>
        )}
      </Box>
      {showTag && tag && (
        <Chip
          label={tag}
          size="small"
          variant="outlined"
          sx={{ marginInlineStart: 'auto', height: 18, fontSize: '0.68rem', color: 'text.secondary', borderColor: 'divider', '& .MuiChip-label': { px: 0.75 } }}
        />
      )}
    </Box>
  );
}

// requireScript - רק כתבים שתומכים בשפה הזו. emptyOptionLabel - אפשרות ריקה ('') בראש התפריט
export default function FontSelect({ id, label, value, onChange, requireScript = null, emptyOptionLabel }) {
  const allowEmpty = emptyOptionLabel !== undefined;

  // מערך שטוח ולא Fragment: ה-Select של MUI מדלג על כותרת (ListSubheader) רק כשהיא ילד ישיר
  // שלו - לחיצה עליה לא בוחרת כלום, והחצים לא נעצרים עליה
  const items = [];
  if (allowEmpty) items.push(<MenuItem key="__empty" value="">{emptyOptionLabel}</MenuItem>);
  FONT_CATEGORIES.forEach((category) => {
    const fonts = FONTS.filter((font) => font.category === category.id
      && (!font.hidden || font.id === value)
      && (!requireScript || supportsScript(font, requireScript)));
    if (fonts.length === 0) return;
    items.push(
      <ListSubheader key={`category-${category.id}`} sx={{ lineHeight: '30px', fontSize: '0.8rem', fontWeight: 600 }}>
        {category.label}
      </ListSubheader>,
    );
    fonts.forEach((font) => items.push(
      <MenuItem key={font.id} value={font.id} sx={{ py: 0.5 }}>
        <FontOptionLabel font={font} showTag />
      </MenuItem>,
    ));
  });

  const handleChange = (event) => {
    const next = event.target.value;
    // הגנה נוספת: ערך שאינו כתב מהרשימה (או ריק בשדה שאין בו אפשרות ריקה) לא נקלט
    if (next === '' ? !allowEmpty : !getFont(next)) return;
    onChange(next);
  };

  const labelId = `${id}-label`;
  return (
    <FormControl fullWidth>
      <InputLabel id={labelId} shrink={allowEmpty || undefined}>{label}</InputLabel>
      <Select
        labelId={labelId}
        value={value}
        label={label}
        onChange={handleChange}
        displayEmpty={allowEmpty}
        notched={allowEmpty || undefined}
        renderValue={(selected) => {
          const font = getFont(selected);
          return font ? <FontOptionLabel font={font} showTag={false} /> : emptyOptionLabel;
        }}
      >
        {items}
      </Select>
    </FormControl>
  );
}
