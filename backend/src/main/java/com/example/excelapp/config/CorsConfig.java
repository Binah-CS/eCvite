package com.example.excelapp.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
                .allowedHeaders("*")
                .maxAge(3600)
                // בלי exposedHeaders, כותרת מותאמת-אישית (כמו X-Backend-Log) מגיעה בפועל
                // בתשובה מהשרת, אבל קוד ה-JS בדפדפן עיוור אליה לגמרי - הדפדפן חוסם גישה
                // לכל כותרת שלא הוגדרה כאן במפורש, מטעמי אבטחה (CORS) - ר' RequestLoggingFilter
                .exposedHeaders("X-Backend-Log");
    }

    @jakarta.annotation.PostConstruct
    void logOrigins() {
        org.slf4j.LoggerFactory.getLogger("API")
            .info("CORS allowed origins: {}", java.util.Arrays.toString(allowedOrigins));
    }
}
