// מדבקה שהטקסט שלה לא נכנס בגבולות שלה (שם ארוך, כתובת ארוכה, או שניהם) - הכתב שלה
// קטן בצעדים קטנים עד שהכל נכנס (#140). גודל הכתב של השורות מוכפל במשתנה CSS הזה,
// ולכן משנים רק אותו - על המדבקה עצמה, בלי לרנדר מחדש. כך זה חל גם בהדפסה עצמה
export const LABEL_FIT_VAR = '--label-fit';

// מתחת לזה הכתב כבר לא קריא - עדיף שייחתך מאשר להדפיס משהו שאי אפשר לקרוא
export const MIN_LABEL_FIT = 0.4;
const FIT_STEP = 0.05;

function overflows(label) {
  // פיקסל אחד של סובלנות - עיגולים של הדפדפן לא נחשבים חריגה
  return label.scrollHeight > label.clientHeight + 1 || label.scrollWidth > label.clientWidth + 1;
}

export function fitLabelText(label) {
  let fit = 1;
  label.style.setProperty(LABEL_FIT_VAR, String(fit));
  while (overflows(label) && fit - FIT_STEP >= MIN_LABEL_FIT - 1e-9) {
    fit = Math.round((fit - FIT_STEP) * 100) / 100;
    label.style.setProperty(LABEL_FIT_VAR, String(fit));
  }
  return fit;
}

// גודל כתב שמוקטן יחד עם המדבקה (1 כשהכל נכנס)
export function fittedFontSize(px) {
  return `calc(${px}px * var(${LABEL_FIT_VAR}, 1))`;
}
