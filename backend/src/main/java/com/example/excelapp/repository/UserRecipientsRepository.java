package com.example.excelapp.repository;

import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserRecipients;
import com.example.excelapp.entity.Recipients;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface UserRecipientsRepository
        extends JpaRepository<UserRecipients, Long> {

    boolean existsByUserAndRecipient(User user, Recipients recipient);

    // JOIN FETCH טוען את ה-recipient המקושר באותה שאילתה - בלי זה, כל recipient
    // נטען ב-SELECT נפרד משלו (N+1), מה שהפך טעינת נמענים למשתמש עם הרבה רשומות לאיטית מאוד.
    // בסדר של הטבלה אצל המשתמשת (sortOrder), ומה שעוד אין לו מקום - בסוף, לפי סדר ההוספה
    @Query("SELECT ur FROM UserRecipients ur JOIN FETCH ur.recipient WHERE ur.user = :user "
            + "ORDER BY ur.sortOrder ASC NULLS LAST, ur.id ASC")
    List<UserRecipients> findByUser(@Param("user") User user);

    // מחזירה רק את מחרוזות ה-hash (לא את הישויות המלאות) - נמנעת מ-N+1 שאילתות
    // שהיו קורות אם היינו טוענים כל recipient בנפרד (ManyToOne ברירת מחדל הוא eager)
    @Query("SELECT ur.recipient.hashCode FROM UserRecipients ur WHERE ur.user = :user")
    List<String> findRecipientHashCodesByUser(@Param("user") User user);

    // רק שורות הקישור שבאמת רלוונטיות למחיקה (לפי hash) - במקום לטעון את כל
    // הקישורים של המשתמש (כולל recipient מלא לכל אחד, eager) ולסנן בזיכרון
    List<UserRecipients> findByUserAndRecipient_HashCodeIn(User user, List<String> hashCodes);
}