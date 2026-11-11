package com.example.excelapp.controller;

import com.example.excelapp.dto.DistributionRouteRequest;
import com.example.excelapp.service.GeoRoutingService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/distribution-routes")
public class DistributionRouteController {
    private final GeoRoutingService geoRoutingService;
    public DistributionRouteController(GeoRoutingService geoRoutingService) { this.geoRoutingService = geoRoutingService; }
    // החיפוש נעזר במאגרי רחובות חיצוניים ולכן בקובץ גדול עשוי להימשך מספר דקות.
    @PostMapping("/optimize")
    public ResponseEntity<?> optimize(@RequestBody DistributionRouteRequest request) { return ResponseEntity.ok(geoRoutingService.optimize(request)); }
}
