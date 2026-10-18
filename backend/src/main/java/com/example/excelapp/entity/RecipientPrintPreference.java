package com.example.excelapp.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(
        name = "recipient_print_preferences",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_recipient_print_preference_user_recipient",
                columnNames = {"user_id", "recipient_id"}
        )
)
@Data
@NoArgsConstructor
public class RecipientPrintPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", referencedColumnName = "hash_code", nullable = false)
    private User user;

    @ManyToOne(optional = false)
    @JoinColumn(name = "recipient_id", referencedColumnName = "hash_code", nullable = false)
    private Recipients recipient;

    @Column(name = "print_enabled", nullable = false)
    private boolean printEnabled = true;
}
