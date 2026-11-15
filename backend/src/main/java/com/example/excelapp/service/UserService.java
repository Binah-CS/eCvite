package com.example.excelapp.service;

import com.example.excelapp.entity.User;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.util.AccountFields;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // המשתמשת מזוהה לפי טלפון ו-hashCode יחד (שניהם נמצאים אצלה ב-sessionStorage אחרי
    // התחברות) - טלפון לבד לא מספיק כדי לקרוא או לשנות את פרטי החשבון
    public Optional<User> findAccount(String phone, String hashCode) {
        if (phone == null || hashCode == null) {
            return Optional.empty();
        }
        User user = userRepository.findByPhone(phone);
        return user != null && hashCode.equals(user.getHashCode()) ? Optional.of(user) : Optional.empty();
    }

    // מעדכנת רק שדות מ-AccountFields.EDITABLE (הערכים כבר עברו AccountValidation).
    // hashCode לא מחושב מחדש: הוא המפתח של המשתמשת ו-user_recipients מצביעים עליו,
    // כך ששינוי שם לא מנתק אותה מהנמענים שלה
    @Transactional
    public User updateAccount(User user, Map<String, String> values) {
        values.forEach((field, value) -> AccountFields.apply(user, field, value));
        return userRepository.save(user);
    }
}
