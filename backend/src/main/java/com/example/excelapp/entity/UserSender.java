package com.example.excelapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

// פרטי שולח למעטפות - שורה אחת לכל שולח, עם פרטים בעברית ואופציונלית גם באנגלית.
// כרגע יש רק שולח אחד למשתמשת (sender_index = 0 - היא עצמה). שולח נוסף בעתיד (למשל
// המחותנים) יהיה עוד שורה עם sender_index = 1, בלי שינוי מבנה. שמות השדות כמו בכתובת
// של הנמענים (street, houseNo, city, country) + מיקוד, שקיים רק לשולח
@Entity
@Table(
        name = "user_senders",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "sender_index"})
)
@Data
@NoArgsConstructor
public class UserSender {

    public static final int OWN_SENDER_INDEX = 0;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", referencedColumnName = "hash_code", nullable = false)
    private User user;

    @Column(name = "sender_index", nullable = false)
    private int senderIndex;

    // השולח שנבחר כברירת מחדל בהדפסת מעטפות (כשיהיו כמה)
    @Column(name = "is_default", nullable = false)
    private boolean defaultSender;

    // עברית. display_name ריק = שם החשבון; כתובת ריקה = כתובת החשבון (ר' senderDetails.js)
    @Column(name = "display_name")
    private String displayName;
    private String street;
    @Column(name = "house_no")
    private String houseNo;
    private String city;
    private String zip;
    private String country;

    // אנגלית (אופציונלי) - בלי fallback לפרטי החשבון, שנשמרים בעברית
    @Column(name = "display_name_en")
    private String displayNameEn;
    @Column(name = "street_en")
    private String streetEn;
    @Column(name = "house_no_en")
    private String houseNoEn;
    @Column(name = "city_en")
    private String cityEn;
    @Column(name = "zip_en")
    private String zipEn;
    @Column(name = "country_en")
    private String countryEn;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public UserSender(User user, int senderIndex, boolean defaultSender) {
        this.user = user;
        this.senderIndex = senderIndex;
        this.defaultSender = defaultSender;
    }

    @PrePersist
    @PreUpdate
    public void onSave() {
        updatedAt = LocalDateTime.now();
    }
}
