package com.example.excelapp.util;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HashUtilTest {

    @Test
    void sameInputProducesSameHash() {
        assertThat(HashUtil.sha256Hex("hello")).isEqualTo(HashUtil.sha256Hex("hello"));
    }

    @Test
    void differentInputProducesDifferentHash() {
        assertThat(HashUtil.sha256Hex("hello")).isNotEqualTo(HashUtil.sha256Hex("Hello"));
    }

    @Test
    void outputIsLowercaseHex64Chars() {
        String hash = HashUtil.sha256Hex("eCvite");
        assertThat(hash).hasSize(64);
        assertThat(hash).matches("^[0-9a-f]{64}$");
    }

    @Test
    void emptyStringStillProducesAValidHash() {
        assertThat(HashUtil.sha256Hex("")).hasSize(64);
    }

    @Test
    void knownVectorMatchesStandardSha256() {
        // "abc" -> הערך הרשמי הידוע של SHA-256 (ממסמך ה-FIPS 180-4) - מוודא שהמימוש
        // באמת מחשב SHA-256 ולא אלגוריתם hash אחר בטעות
        assertThat(HashUtil.sha256Hex("abc"))
                .isEqualTo("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    }
}
