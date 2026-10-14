package com.example.excelapp.entity;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RecipientsTest {

    private Recipients buildRecipient(String man, String woman, String lastName, String phone,
                                       String city, String street, String houseNo) {
        Recipients r = new Recipients();
        r.setMan(man);
        r.setWoman(woman);
        r.setLastName(lastName);
        r.setPhone(phone);
        r.setCity(city);
        r.setStreet(street);
        r.setHouseNo(houseNo);
        return r;
    }

    @Test
    void identicalRecipientsProduceTheSameHash() {
        Recipients a = buildRecipient("יוסי", "רותי", "כהן", "0501234567", "ירושלים", "הרצל", "12");
        Recipients b = buildRecipient("יוסי", "רותי", "כהן", "0501234567", "ירושלים", "הרצל", "12");

        assertThat(a.generateRowHashCode()).isEqualTo(b.generateRowHashCode());
    }

    @Test
    void differentAddressProducesDifferentHash_sameNameAndPhone() {
        // זו בדיוק הסיבה שהנוסחה כוללת כתובת ולא רק שם+טלפון (ר' ההערה בקוד) - שני
        // אנשים בשם זהה בלי טלפון שמור לא יתמזגו בטעות לאותה רשומה
        Recipients a = buildRecipient("משה", "", "כהן", "", "ירושלים", "הרצל", "12");
        Recipients b = buildRecipient("משה", "", "כהן", "", "תל אביב", "דיזנגוף", "5");

        assertThat(a.generateRowHashCode()).isNotEqualTo(b.generateRowHashCode());
    }

    @Test
    void duplicateSaltChangesTheHash_evenWhenEverythingElseIsIdentical() {
        // המנגנון שמאפשר "השאר את שתיהן" בדיאלוג הכפילויות (ר' handleConfirmDuplicates
        // ב-DataTable.jsx) - שתי שורות עם זהות זהה לחלוטין, אבל salt שונה, חייבות
        // לקבל hash שונה כדי שלא יתמזגו באותה רשומה ב-DB
        Recipients a = buildRecipient("יוסי", "רותי", "כהן", "0501234567", "ירושלים", "הרצל", "12");
        Recipients b = buildRecipient("יוסי", "רותי", "כהן", "0501234567", "ירושלים", "הרצל", "12");
        b.setDuplicateSalt("dup-12345-abc");

        assertThat(a.generateRowHashCode()).isNotEqualTo(b.generateRowHashCode());
    }

    @Test
    void duplicateSaltIsNotPersistedAsADatabaseColumn() {
        // @Transient - ר' ההערה בקוד: זה לא אמור להישמר כעמודה אמיתית ב-DB, רק
        // משפיע על חישוב ה-hash בזיכרון. בדיקה "תיעודית" - אם מישהו יסיר בטעות את
        // ה-@Transient בעתיד, הבדיקה הזו לא תתפוס את זה ישירות (זה נבדק דרך השרת
        // ב-RecipientControllerTest), אבל לפחות מוודאת שהשדה עדיין קיים ונגיש
        Recipients r = new Recipients();
        r.setDuplicateSalt("abc");
        assertThat(r.getDuplicateSalt()).isEqualTo("abc");
    }

    @Test
    void missingFieldsDoNotThrow_treatedAsEmptyString() {
        Recipients r = new Recipients();
        assertThat(r.generateRowHashCode()).isNotNull().hasSize(64);
    }
}
