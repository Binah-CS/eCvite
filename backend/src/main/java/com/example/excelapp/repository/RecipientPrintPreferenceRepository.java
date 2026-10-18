package com.example.excelapp.repository;

import com.example.excelapp.entity.RecipientPrintPreference;
import com.example.excelapp.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecipientPrintPreferenceRepository extends JpaRepository<RecipientPrintPreference, Long> {

    List<RecipientPrintPreference> findByUser(User user);

    List<RecipientPrintPreference> findByUserAndRecipient_HashCodeIn(User user, List<String> recipientHashCodes);
}
