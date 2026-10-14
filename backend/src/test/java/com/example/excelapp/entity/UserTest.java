package com.example.excelapp.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class UserTest {

    private User buildUser(String man, String woman, String lastName, String phone) {
        return User.builder()
                .firstNameMan(man)
                .firstNameWoman(woman)
                .lastName(lastName)
                .phone(phone)
                .build();
    }

    @Test
    void sameDetailsProduceTheSameHashCode() {
        User a = buildUser("יוסי", "רותי", "כהן", "0501234567");
        User b = buildUser("יוסי", "רותי", "כהן", "0501234567");

        assertThat(a.generateHashCode()).isEqualTo(b.generateHashCode());
    }

    @Test
    void differentPhoneProducesDifferentHashCode() {
        User a = buildUser("יוסי", "רותי", "כהן", "0501234567");
        User b = buildUser("יוסי", "רותי", "כהן", "0501234568");

        assertThat(a.generateHashCode()).isNotEqualTo(b.generateHashCode());
    }

    @Test
    void missingFieldsDoNotThrow_treatedAsEmptyString() {
        // generateHashCode משתמש ב-Objects.toString(field, "") בדיוק כדי לתמוך
        // בשדות null (למשל לפני שמילאו את כל פרטי ההרשמה) - לא אמור לזרוק NPE
        User userWithNulls = User.builder().phone("0501234567").build();

        assertThat(userWithNulls.generateHashCode()).isNotNull().hasSize(64);
    }

    @Test
    void onCreateSetsCreatedAtTimestamp() {
        User user = buildUser("יוסי", "רותי", "כהן", "0501234567");
        assertThat(user.getCreatedAt()).isNull();

        user.onCreate();

        assertThat(user.getCreatedAt()).isNotNull();
    }
}
