package com.example.excelapp.repository;

import com.example.excelapp.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findTop100ByPhoneOrderByCreatedAtDesc(String phone);
}
