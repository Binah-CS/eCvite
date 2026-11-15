package com.example.excelapp.service;

import com.example.excelapp.entity.User;
import com.example.excelapp.entity.UserSender;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.repository.UserSenderRepository;
import com.example.excelapp.util.AccountFields;
import com.example.excelapp.util.SenderFields;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.Optional;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final UserSenderRepository userSenderRepository;

    public UserService(UserRepository userRepository, UserSenderRepository userSenderRepository) {
        this.userRepository = userRepository;
        this.userSenderRepository = userSenderRepository;
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

    // השולח של המשתמשת עצמה (sender_index = 0). ריק = עוד לא שמרה פרטי שולח
    public Optional<UserSender> findOwnSender(User user) {
        return userSenderRepository.findByUserAndSenderIndex(user, UserSender.OWN_SENDER_INDEX);
    }

    // שומרת את פרטי החשבון ואת פרטי השולח באותה טרנזקציה - או שהכול נשמר, או כלום.
    // הערכים כבר עברו AccountValidation. account = רק שדות מ-AccountFields.EDITABLE;
    // sender = השולח המלא, או null אם לא השתנה. hashCode לא מחושב מחדש: הוא המפתח של
    // המשתמשת ו-user_recipients מצביעים עליו, כך ששינוי שם לא מנתק אותה מהנמענים שלה
    @Transactional
    public User updateAccount(User user, Map<String, String> account, Map<String, String> sender) {
        account.forEach((field, value) -> AccountFields.apply(user, field, value));
        User saved = userRepository.save(user);

        if (sender != null) {
            UserSender ownSender = findOwnSender(saved)
                    .orElseGet(() -> new UserSender(saved, UserSender.OWN_SENDER_INDEX, true));
            SenderFields.applyAll(ownSender, sender);
            userSenderRepository.save(ownSender);
        }
        return saved;
    }
}
