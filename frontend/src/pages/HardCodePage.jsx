// src/pages/HardCodePage.jsx
import React from 'react';

// 🌟 הקבועים החדשים של ה-PrintModal שהוצאנו מה-Hard Code:
export const MODAL_TEXTS = {
  STEP_1_TITLE: "על מה תרצה להדפיס?",
  LABEL_OPTION: "מדבקות",
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

  BUTTON_CANCEL: "ביטול",
  BUTTON_NEXT: "המשך",
  BUTTON_BACK: "חזור",
  BUTTON_PREVIEW: "תצוגה מקדימה",
  BUTTON_PRINT: "הדפס",
  
  NOT_AVAILABLE_ALERT: (type) => `הדפסת ${type === 'envelopes' ? 'מעטפות' : 'רשימות'} אינה זמינה כרגע.`
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