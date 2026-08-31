package com.example.excelapp.service;

import com.example.excelapp.entity.ActivityLog;
import com.example.excelapp.repository.ActivityLogRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ActivityLogService {
    private final ActivityLogRepository activityLogRepository;

    public ActivityLogService(ActivityLogRepository activityLogRepository) {
        this.activityLogRepository = activityLogRepository;
    }

    public void log(String phone, String action, String details) {
        ActivityLog entry = new ActivityLog();
        entry.setPhone(phone);
        entry.setAction(action);
        entry.setDetails(details);
        activityLogRepository.save(entry);
    }

    public List<ActivityLog> getForUser(String phone) {
        return activityLogRepository.findTop100ByPhoneOrderByCreatedAtDesc(phone);
    }
}
