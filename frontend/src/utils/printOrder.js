// סידור שורות להדפסה באותו סדר שהטבלה מציגה אותן (אחרי המיון שלה) - גם כשמדפיסים רק
// שורות שסומנו, שאחרת היו יוצאות בסדר שבו סימנו אותן או בסדר המקורי של הרשימה.
// tableRows - השורות כמו שהטבלה מציגה אותן עכשיו. שורה שלא מופיעה בהן נשארת בסוף,
// בסדר שבו הגיעה. השורות מזוהות כמו ב-DataGrid: hashCode, ואם אין - id
const rowKey = (row) => row.hashCode ?? row.id;

export function orderLikeTable(list, tableRows) {
  if (!tableRows || tableRows.length === 0) return list;
  const position = new Map(tableRows.map((row, index) => [rowKey(row), index]));
  const last = tableRows.length;
  return list
    .map((row, index) => ({ row, index, at: position.has(rowKey(row)) ? position.get(rowKey(row)) : last }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
    .map(({ row }) => row);
}
