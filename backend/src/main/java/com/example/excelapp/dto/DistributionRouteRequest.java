package com.example.excelapp.dto;

import java.util.List;

public record DistributionRouteRequest(List<Assignment> assignments) {
    public record Assignment(String id, String responsible, List<String> streets) {}
}
