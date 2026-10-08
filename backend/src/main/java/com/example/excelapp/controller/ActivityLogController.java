package com.example.excelapp.controller;

import com.example.excelapp.entity.ActivityLog;
import com.example.excelapp.repository.UserRepository;
import com.example.excelapp.service.ActivityLogService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/activity-logs")
public class ActivityLogController {
    private final ActivityLogService activityLogService;
    private final UserRepository userRepository;

    public ActivityLogController(ActivityLogService activityLogService, UserRepository userRepository) {
        this.activityLogService = activityLogService;
        this.userRepository = userRepository;
    }

    @GetMapping
    public ResponseEntity<List<ActivityLog>> getLogs(@RequestParam String phone) {
        if (userRepository.findByPhone(phone) == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        return ResponseEntity.ok(activityLogService.getForUser(phone));
    }

    @PostMapping
    public ResponseEntity<Void> createLog(@RequestBody Map<String, String> request) {
        String phone = request.get("phone");
        String action = request.get("action");
        String details = request.getOrDefault("details", "");
        if (phone == null || action == null || action.isBlank() || action.length() > 80 || details.length() > 500
                || userRepository.findByPhone(phone) == null) {
            return ResponseEntity.badRequest().build();
        }
        activityLogService.log(phone, action, details);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }
}
