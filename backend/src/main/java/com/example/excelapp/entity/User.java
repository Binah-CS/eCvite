package com.example.excelapp.entity;

import com.example.excelapp.util.HashUtil;
import jakarta.persistence.*;
import lombok.*;

import jakarta.validation.constraints.Pattern;

import java.time.LocalDateTime;
import java.util.Objects;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @Column(name = "hash_code")
    private String hashCode;

    @Column(name = "first_name_man")
    private String firstNameMan;

    @Column(name = "first_name_woman")
    private String firstNameWoman;

    @Column(name = "last_name")
    private String lastName;

    @Pattern(regexp = "^\\d{10}$", message = "מספר הטלפון חייב להכיל 10 ספרות")
    @Column(unique = true)
    private String phone;

    private String email;

    @Column(name = "event_type")
    private String eventType;

    private String city;

    private String street;

    @Column(name = "house_number")
    private String houseNumber;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "column_preferences")
    private String columnPreferences;

    @PrePersist
    public void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public String generateHashCode() {
        String data =
                Objects.toString(firstNameMan, "") +
                        Objects.toString(firstNameWoman, "") +
                        Objects.toString(lastName, "") +
                        Objects.toString(phone, "");
        return HashUtil.sha256Hex(data);
    }
}