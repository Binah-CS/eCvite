import { useCallback, useEffect, useState } from 'react';

// אזהרה על שינויים שלא נשמרו. סגירה/רענון של הדף - דרך האזהרה המובנית של הדפדפן
// (beforeunload). יציאה מתוך האפליקציה (חץ החזרה וכו') - עוטפים את פעולת הניווט
// ב-confirmLeave, שמציג את UnsavedChangesDialog ומבצע אותה רק אם בחרו לצאת.
// (האפליקציה עובדת עם BrowserRouter, שבו אין useBlocker - לכן עוטפים ידנית)
export default function useUnsavedChangesGuard(isDirty) {
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      // נדרש בחלק מהדפדפנים כדי שההודעה תוצג
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const confirmLeave = useCallback((action) => {
    if (isDirty) {
      // פונקציה בתוך פונקציה - אחרת setState היה מריץ את action כ-updater
      setPendingAction(() => action);
    } else {
      action();
    }
  }, [isDirty]);

  const dialogProps = {
    open: Boolean(pendingAction),
    onStay: () => setPendingAction(null),
    onLeave: () => {
      const action = pendingAction;
      setPendingAction(null);
      action?.();
    },
  };

  return { confirmLeave, dialogProps };
}
