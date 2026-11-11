import { mergeBelongsToValues } from './recipientIdentity';

// מחילה עריכה מרוכזת בלי לשנות את השורות המקוריות. מזהה השורה זהה לזה של DataGrid:
// hashCode לרשומה שמורה, ו-id לשורה חדשה שעדיין לא נשמרה.
export function applyBulkRecipientEdit(rows, selectedIds, field, rawValue, mode = 'replace') {
  const selected = new Set(Array.from(selectedIds, String));
  const value = String(rawValue ?? '').trim();

  return rows.map((row) => {
    if (!selected.has(String(row.hashCode ?? row.id))) return row;
    const nextValue = field === 'belongsTo' && mode === 'append'
      ? mergeBelongsToValues(row.belongsTo, value)
      : value;
    return row[field] === nextValue ? row : { ...row, [field]: nextValue };
  });
}
