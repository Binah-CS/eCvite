// src/pages/HardCodePage.jsx
import React from 'react';
import {
  MAX_ENVELOPE_HEIGHT_MM,
  MAX_ENVELOPE_WIDTH_MM,
  MIN_ENVELOPE_HEIGHT_MM,
  MIN_ENVELOPE_WIDTH_MM,
} from '../utils/envelopeFormats';

// 🌟 הקבועים החדשים של ה-PrintModal שהוצאנו מה-Hard Code:
export const MODAL_TEXTS = {
  STEP_1_TITLE: "על מה תרצה להדפיס?",
  LABEL_OPTION: "מדבקות",
  DISTRIBUTION_LABELS_OPTION: "מדבקות לחלוקה",
  ENVELOPES_OPTION: "מעטפות",
  LISTS_OPTION: "רשימות",
  
  STEP_2_TITLE: "הגדרות הדפסה (מדבקות)",
  FONT_INPUT_LABEL: "בחירת כתב",
  FONT_SIZE_INPUT_LABEL: "גודל כתב",
  FONT_WEIGHT_INPUT_LABEL: "עובי כתב",
  FONT_WEIGHT_REGULAR: "רגיל",
  FONT_WEIGHT_BOLD: "מודגש",
  SIZE_INPUT_LABEL: "בחירת גודל מדבקה",
  PRINTER_INPUT_LABEL: "בחירת מדפסת",
  
  SIZE_STANDARD: "סטנדרטי",
  SIZE_LARGE: "גדול",
  SIZE_LARGE_UNAVAILABLE: "אפשרות גודל מדבקה גדול אינה זמינה כרגע",
  
  PRINTER_HOME: "מדפסת ביתית",
  PRINTER_OFFICE: "מדפסת המשרד",

  DELIVERY_INPUT_LABEL: "אופן קבלת ההדפסה",
  DELIVERY_COURIER: "שליח",
  DELIVERY_PICKUP: "איסוף עצמאי",

  EMPTY_LINE_NO_ADDRESS: "השאר שורה ריקה כשאין כתובת",

  GREETING_SHOW: 'הדפס פנייה ("לכבוד")',
  GREETING_SEPARATE_LINE: "פנייה בשורה נפרדת מעל השם",
  GREETING_ALIGN_LABEL: "מיקום הפנייה",
  GREETING_ALIGN_RIGHT: "ימין",
  GREETING_ALIGN_CENTER: "מרכז",
  GREETING_ALIGN_LEFT: "שמאל",

  ENVELOPE_STEP_2_TITLE: "הגדרות הדפסה (מעטפות)",
  ENVELOPE_SIZE_INPUT_LABEL: "בחירת גודל מעטפה",
  ENVELOPE_SIZE_CUSTOM: "מידות מותאמות אישית",
  ENVELOPE_WIDTH: "רוחב מעטפה",
  ENVELOPE_HEIGHT: "גובה מעטפה",
  ENVELOPE_MM_NOTE: "מידות במילימטרים",
  // לפי הסיבה מ-getCustomSizeError. הלשונית על הצלע הארוכה, ולכן הרוחב לפחות כמו הגובה
  ENVELOPE_SIZE_ERRORS: {
    invalid: "בדקו שהמידות חיוביות.",
    swapped: "נראה שהרוחב והגובה הפוכים. הרוחב הוא הצלע הארוכה, שעליה הלשונית.",
    portrait: "הרוחב צריך להיות גדול מהגובה או שווה לו (הלשונית בצלע הארוכה).",
    tooSmall: `המעטפה קטנה מדי. רוחב לפחות ${MIN_ENVELOPE_WIDTH_MM} מ"מ וגובה לפחות ${MIN_ENVELOPE_HEIGHT_MM} מ"מ.`,
    tooLarge: `המעטפה גדולה מדי. רוחב עד ${MAX_ENVELOPE_WIDTH_MM} מ"מ וגובה עד ${MAX_ENVELOPE_HEIGHT_MM} מ"מ.`,
  },
  ENVELOPE_SWAP_SIZE: "החלפה",
  ENVELOPE_PRINT_SENDER: "הדפס גם את פרטי השולח",
  ENVELOPE_SENDER_PLACEMENT: "מיקום השולח",
  ENVELOPE_PLACEMENT_FLAP: "על הלשונית (גב המעטפה)",
  ENVELOPE_PLACEMENT_CORNER: "בפינה העליונה בחזית",
  ENVELOPE_CORNER_SIDE: "צד",
  ENVELOPE_SIDE_AUTO: "אוטומטי",
  ENVELOPE_SIDE_RIGHT: "ימין",
  ENVELOPE_SIDE_LEFT: "שמאל",
  ENVELOPE_SIDE_AUTO_NOTE: "באוטומטי: נמען בעברית - השולח בימין, נמען באנגלית - השולח בשמאל.",
  ENVELOPE_FLAP_DEPTH: "עומק לשונית (מ\"מ)",
  ENVELOPE_FLAP_DEPTH_INVALID: "עומק הלשונית צריך להיות חיובי ולא גדול מגובה המעטפה.",
  ENVELOPE_FLAP_SHAPE: "צורת לשונית",
  ENVELOPE_FLAP_STRAIGHT: "ישרה",
  ENVELOPE_FLAP_TRIANGULAR: "משולשת",
  ENVELOPE_SENDER_TITLE: (index) => `שולח ${index + 1}`,
  ENVELOPE_SENDER_NAME: "שם",
  ENVELOPE_SENDER_STREET: "רחוב",
  ENVELOPE_SENDER_HOUSE_NO: "מספר בית",
  ENVELOPE_SENDER_CITY: "עיר",
  ENVELOPE_SENDER_ZIP: "מיקוד",
  ENVELOPE_SENDER_COUNTRY: "ארץ",
  ENVELOPE_SENDER_INCOMPLETE: "יש למלא שם, רחוב ועיר.",
  ENVELOPE_ADD_SENDER: "הוספת שולח שני",
  ENVELOPE_REMOVE_SENDER: "הסרה",
  ENVELOPE_SENDER_OVERFLOW: "טקסט השולח לא נכנס בשטח הלשונית. כדאי להקטין את הכתב, להגדיל את עומק הלשונית או לקצר את הכתובת.",
  ENVELOPE_SENDER_CORNER_OVERFLOW: "טקסט השולח לא נכנס בפינה. כדאי להקטין את הכתב או לקצר את הכתובת.",
  // count: בעמוד ההדפסה - בכמה מעטפות. null בחלון ההגדרות, שבו מוצג נמען אחד
  ENVELOPE_RECIPIENT_OVERFLOW: (count) => {
    let where = 'כתובת הנמען';
    if (count === 1) where = 'במעטפה אחת כתובת הנמען';
    else if (count > 1) where = `ב-${count} מעטפות כתובת הנמען`;
    return `${where} לא נכנסת במלואה, בדרך כלל בגלל שורה ארוכה שנשברה. כדאי להקטין את הכתב או לקצר את השורה. ההדפסה אפשרית גם כך.`;
  },
  ENVELOPE_ONE_SENDER_NOTE: "בפינה העליונה מודפס השולח הראשון בלבד. להדפסת שני השולחים, בחרו \"על הלשונית\".",
  ENVELOPE_PREVIEW_OPEN: "מעטפה פתוחה",
  ENVELOPE_PREVIEW_SINGLE: "מעטפה",
  ENVELOPE_PREVIEW_FRONT: "חזית",
  ENVELOPE_PREVIEW_BACK: "גב",
  ENVELOPE_PREVIEW_INVALID: "אין תצוגה: בדקו את המידות.",
  ENVELOPE_PRINT_BUTTON: "הדפס מעטפות",
  ENVELOPE_PRINT_HINT: (widthMm, heightMm, senderMode) => `גודל הדף: ⁦${widthMm}×${heightMm}⁩ מ"מ. בחלון ההדפסה יש לבחור נייר בגודל הזה, קנה מידה 100% וללא שוליים.${{
    openFlap: ' מזינים את המעטפה כשהחזית בצד שעליו המדפסת מדפיסה, הלשונית פתוחה ונכנסת ראשונה.',
    frontCorner: ' מזינים את המעטפה סגורה, כשהחזית בצד שעליו המדפסת מדפיסה והצד העליון שלה נכנס ראשון.',
  }[senderMode] ?? ''}`,
  ENVELOPE_NOTHING_TO_PRINT: "אין מה להדפיס. חזרי לטבלה ובדקי את הנמענים ואת המידות.",

  BUTTON_CANCEL: "ביטול",
  BUTTON_NEXT: "המשך",
  BUTTON_BACK: "חזור",
  BUTTON_PREVIEW: "תצוגה מקדימה",
  BUTTON_PRINT: "הדפס",
  
  NOT_AVAILABLE_ALERT: (type) => `הדפסת ${{ distributionLabels: 'מדבקות לחלוקה', envelopes: 'מעטפות' }[type] || 'רשימות'} אינה זמינה כרגע.`
};

// הקבועים הקודמים ששמרנו (נשארים פה כרגיל)
export const PRINT_CONSTANTS = {
  PREVIEW_TITLE: "תצוגה מקדימה של המדבקות",
  HONORIFIC: "לכבוד הרב",
};

// 4 כתבים זמניים לבחירה - להחליף בהמשך בכתבים הסופיים
export const FONT_OPTIONS = [
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: 'David, serif', label: 'David' },
  { value: '"Courier New", monospace', label: 'Courier New' },
  { value: 'Tahoma, sans-serif', label: 'Tahoma' },
];

export default function HardCodePage() {
  return (
    <div style={{ padding: '20px', direction: 'rtl' }}>
      <h3>עמוד מרכז קבועים וטקסטים</h3>
    </div>
  );
}