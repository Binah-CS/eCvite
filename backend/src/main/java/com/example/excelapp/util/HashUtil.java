package com.example.excelapp.util;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

// חישוב SHA-256 משותף - נמענים (Recipients) ומשתמשות (User) שניהם בונים hash_code
// מתוכן שונה (שדות אחרים), אבל בדיוק אותו אלגוריתם חישוב בפועל
public final class HashUtil {

    private HashUtil() {
    }

    public static String sha256Hex(String data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data.getBytes(StandardCharsets.UTF_8));

            StringBuilder sb = new StringBuilder();
            for (byte b : hash) {
                sb.append(String.format("%02x", b));
            }

            return sb.toString();

        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("Error generating hash", e);
        }
    }
}