package com.example.excelapp.repository;

import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserSender;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserSenderRepository extends JpaRepository<UserSender, Long> {
    Optional<UserSender> findByUserAndSenderIndex(User user, int senderIndex);
}
