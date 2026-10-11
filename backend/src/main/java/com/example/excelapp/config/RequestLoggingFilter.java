package com.example.excelapp.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

// עוטפת כל בקשת HTTP אמיתית שמגיעה מה-frontend (כל /api/**) - שורת לוג אחת "נכנס"
// ושורה אחת "יצא" (קוד סטטוס, משך זמן, וגוף התשובה אם זו שגיאה) - כדי לראות בקונסולת
// השרת כל קריאה בפועל, ולזהות מיד אם ולמה קריאה נכשלה. רק /api/** - לא נוגעת בבקשות
// סטטיות/אחרות שלא קשורות לתקשורת frontend-backend עצמה
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger("API");

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        if (!request.getRequestURI().startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }

        // עוטפים רק את ה-response (לא את ה-request) - ה-wrapper בולם את גוף התשובה
        // כדי שנוכל לקרוא אותו כאן לצורך הלוג, ואז מעתיקים אותו בחזרה בפועל ללקוח
        // ב-copyBodyToResponse (למטה) - בלי זה הלקוח פשוט לא היה מקבל תשובה בכלל
        ContentCachingResponseWrapper wrappedResponse = new ContentCachingResponseWrapper(response);
        long start = System.currentTimeMillis();
        log.info("→ {} {}", request.getMethod(), request.getRequestURI());

        try {
            filterChain.doFilter(request, wrappedResponse);
            long durationMs = System.currentTimeMillis() - start;
            int status = wrappedResponse.getStatus();
            if (status >= 400) {
                String body = new String(wrappedResponse.getContentAsByteArray(), StandardCharsets.UTF_8);
                log.warn("✗ {} {} -> {} ({} ms): {}", request.getMethod(), request.getRequestURI(), status, durationMs, body);
            } else {
                log.info("✓ {} {} -> {} ({} ms)", request.getMethod(), request.getRequestURI(), status, durationMs);
            }
        } catch (Exception ex) {
            long durationMs = System.currentTimeMillis() - start;
            // מעבירים את ex כפרמטר האחרון (לא ex.toString() בתוך הטקסט) - זה מה שגורם
            // ל-SLF4J להדפיס את כל ה-stack trace המלא, כולל הקובץ והשורה המדויקים
            // שבהם השגיאה נזרקה בפועל - לא רק את שם סוג השגיאה
            log.error("✗ {} {} -> unhandled exception after {} ms", request.getMethod(), request.getRequestURI(), durationMs, ex);
            throw ex;
        } finally {
            wrappedResponse.copyBodyToResponse();
        }
    }
}
