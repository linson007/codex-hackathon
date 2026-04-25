package com.contextos.demo.order;

import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.PostMapping;

@FeignClient(name = "billing-service")
public interface BillingClient {
  @PostMapping("/billing/refunds/preview")
  RefundDecision previewRefund(String orderId);
}
