package com.example.excelapp.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;


    @Entity
    @Table(name = "user_recipients")
    @Data
    @NoArgsConstructor
    public class UserRecipients {
        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;


        @ManyToOne
        @JoinColumn(name = "user_id", referencedColumnName = "hash_code")
        private User user;


        @ManyToOne
        @JoinColumn(name = "recipient_id", referencedColumnName = "hash_code")
        private Recipients recipient;

        // הווי "הדפסה" של הנמען - בחירה של המשתמשת הזו בלבד, כי הנמען עצמו משותף
        // לכל המשתמשות שמקושרות אליו. null = קישור ישן שעוד לא נשמר בו ערך - אז
        // מוצג הערך הישן מהנמען (Recipients.print), כדי שלא יאבד כלום במעבר
        @Column(name = "print")
        private Boolean print;
    }

