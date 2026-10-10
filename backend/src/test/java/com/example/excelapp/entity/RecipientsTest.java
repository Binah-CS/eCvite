package com.example.excelapp.entity;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

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

    private Recipients fullRecipient() {
        Recipients r = buildRecipient("יוסי", "רותי", "כהן", "0501234567", "ירושלים", "הרצל", "12");
        r.setPrefix("מר");
        r.setSuffix("ומשפחתו");
        r.setFatherName("דוד");
        r.setMotherName("שרה");
        r.setMail("a@b.com");
        r.setCountry("ישראל");
        r.setBelongsTo("חברים");
        r.setPrint(true);
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

    // רשימת השדות כאן חייבת להישאר זהה לרשימה ב-buildIdentityKey (frontend/src/utils/
    // recipientIdentity.js) ולבדיקות המקבילות ב-recipientIdentity.test.js - שתי הבדיקות
    // "נעולות" יחד על אותה רשימת שדות בדיוק: אם מישהי תוסיף שדה לזהות כאן ותשכח שם
    // (או הפוך), אחת מהבדיקות תיכשל ותתריע, במקום שהפער יתגלה רק אצל משתמשת אמיתית
    @ParameterizedTest
    @ValueSource(strings = {"man", "woman", "lastName", "phone", "city", "street", "houseNo"})
    void changingAnIdentityField_changesTheHash(String fieldName) {
        Recipients original = fullRecipient();
        Recipients changed = mutate(fieldName, original);

        assertThat(changed.generateRowHashCode()).isNotEqualTo(original.generateRowHashCode());
    }

    @ParameterizedTest
    @ValueSource(strings = {"prefix", "suffix", "fatherName", "motherName", "mail", "country", "belongsTo"})
    void changingANonIdentityField_doesNotChangeTheHash(String fieldName) {
        Recipients original = fullRecipient();
        Recipients changed = mutate(fieldName, original);

        assertThat(changed.generateRowHashCode()).isEqualTo(original.generateRowHashCode());
    }

    private Recipients mutate(String fieldName, Recipients original) {
        Recipients copy = fullRecipient();
        switch (fieldName) {
            case "man" -> copy.setMan(copy.getMan() + "_שונה");
            case "woman" -> copy.setWoman(copy.getWoman() + "_שונה");
            case "lastName" -> copy.setLastName(copy.getLastName() + "_שונה");
            case "phone" -> copy.setPhone(copy.getPhone() + "9");
            case "city" -> copy.setCity(copy.getCity() + "_שונה");
            case "street" -> copy.setStreet(copy.getStreet() + "_שונה");
            case "houseNo" -> copy.setHouseNo(copy.getHouseNo() + "9");
            case "prefix" -> copy.setPrefix(copy.getPrefix() + "_שונה");
            case "suffix" -> copy.setSuffix(copy.getSuffix() + "_שונה");
            case "fatherName" -> copy.setFatherName(copy.getFatherName() + "_שונה");
            case "motherName" -> copy.setMotherName(copy.getMotherName() + "_שונה");
            case "mail" -> copy.setMail(copy.getMail() + "x");
            case "country" -> copy.setCountry(copy.getCountry() + "_שונה");
            case "belongsTo" -> copy.setBelongsTo(copy.getBelongsTo() + "_שונה");
            default -> throw new IllegalArgumentException("Unknown field: " + fieldName);
        }
        return copy;
    }
}
