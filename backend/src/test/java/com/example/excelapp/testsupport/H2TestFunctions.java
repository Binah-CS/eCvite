package com.example.excelapp.testsupport;

// פונקציה ש-schema.sql רושם כ-ALIAS בשם set_config - מחליפה את פונקציית ה-session
// variable של Postgres (לא קיימת ב-H2 בכלל) כדי ש-RecipientController.
// stampCurrentUserForHistory לא ייכשל מול מסד הבדיקות. תשתית בדיקות בלבד
public final class H2TestFunctions {

    private H2TestFunctions() {
    }

    public static String setConfig(String settingName, String newValue, Boolean isLocal) {
        return newValue;
    }
}
