// נרמול שמות עמודות + מנגנון מילון התאמות (התאמה מדויקת בלבד בשלב הזה)

function normalize(text) {
  return String(text ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s*\*+\s*$/, '')
      .replace(/['"׳״.,-]/g, '')
      .replace(/\s+/g, ' ');
}

function getAliasList(column) {
  return String(column.aliases ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
}

// מתאימה כותרות עמודות מקובץ Excel לעמודות הידועות (columns מגיעות מ-excel_columns ב-DB, נטענות פעם אחת)
export function matchExcelHeaders(headers, columns) {
  const matched = {}; // כותרת מקורית בקובץ -> technical_name של העמודה שלנו
  const unmatched = [];

  headers.forEach((header) => {
    const normalized = normalize(header);

    let column = columns.find(
      (c) => normalize(c.technicalName) === normalized || normalize(c.displayName) === normalized
    );

    if (!column) {
      column = columns.find((c) => getAliasList(c).some((alias) => normalize(alias) === normalized));
    }

    if (column) {
      matched[header] = column.technicalName;
    } else {
      unmatched.push(header);
    }
  });

  return { matched, unmatched };
}

function getPossibleValuesList(column) {
  return (column.possibleValues ?? []).map((v) => normalize(v)).filter(Boolean);
}

// לעמודות שלא הצליחו להתאים לפי הכותרת - בודקים אם הערכים שבתוך העמודה עצמה
// מתאימים ל"ערכים אפשריים" של שדה כלשהו (כמו קידומת/סיומת), בלי קשר לכותרת
export function matchByValues(unmatchedHeaders, rows, columns) {
  const matched = {};
  const stillUnmatched = [];
  const candidateColumns = columns.filter((c) => (c.possibleValues ?? []).length > 0);

  unmatchedHeaders.forEach((header) => {
    const distinctValues = [...new Set(rows.map((row) => normalize(row[header])).filter(Boolean))];

    if (distinctValues.length === 0) {
      stillUnmatched.push(header);
      return;
    }

    let bestColumn = null;
    let bestRatio = 0;
    candidateColumns.forEach((column) => {
      const possible = getPossibleValuesList(column);
      const matchCount = distinctValues.filter((v) => possible.includes(v)).length;
      const ratio = matchCount / distinctValues.length;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        bestColumn = column;
      }
    });

    if (bestColumn && bestRatio > 0.5) {
      matched[header] = bestColumn.technicalName;
    } else {
      stillUnmatched.push(header);
    }
  });

  return { matched, unmatched: stillUnmatched };
}

// ממפה מחדש את השורות מהקובץ לפי מפת "כותרת מקורית -> שם טכני שלנו".
// אם שתי עמודות שונות בקובץ שויכו לאותו שדה (למשל "שליט"א" ו"פניה" ששתיהן שייכות ל"סיום") -
// הערכים שלהן משורשרים יחד (עם רווח), במקום שהאחרונה תדרוס את הראשונה
export function remapRows(rows, headerToKeyMap) {
  return rows.map((row) => {
    const newRow = {};
    Object.entries(row).forEach(([header, value]) => {
      const key = headerToKeyMap[header];
      if (!key) return;
      const stringValue = String(value ?? '').trim();
      if (!stringValue) return;
      newRow[key] = newRow[key] ? `${newRow[key]} ${stringValue}` : stringValue;
    });
    return newRow;
  });
}
