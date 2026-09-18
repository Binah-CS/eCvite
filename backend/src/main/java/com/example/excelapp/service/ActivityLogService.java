package com.example.excelapp.service;

import com.example.excelapp.entity.ActivityLog;
import com.example.excelapp.entity.User;
import com.example.excelapp.repository.ActivityLogRepository;
import com.example.excelapp.repository.UserRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ActivityLogService {
    private final ActivityLogRepository activityLogRepository;
    private final UserRepository userRepository;

    public ActivityLogService(ActivityLogRepository activityLogRepository, UserRepository userRepository) {
        this.activityLogRepository = activityLogRepository;
        this.userRepository = userRepository;
    }

    public void log(String phone, String action, String details) {
        User user = userRepository.findByPhone(phone);
        if (user == null) {
            return;
        }

        ActivityLog entry = new ActivityLog();
        entry.setPhone(phone);
        entry.setUserName(buildUserName(user));
        entry.setAction(action);
        entry.setDetails(details);
        activityLogRepository.save(entry);
    }

    private String buildUserName(User user) {
        String firstName = user.getFirstNameMan();
        if (firstName == null || firstName.isBlank()) {
            firstName = user.getFirstNameWoman();
        }
        return String.join(" ",
                firstName == null ? "" : firstName.trim(),
                user.getLastName() == null ? "" : user.getLastName().trim()
        ).trim();
    }

    public List<ActivityLog> getForUser(String phone) {
        return activityLogRepository.findTop100ByPhoneOrderByCreatedAtDesc(phone);
    }
}
