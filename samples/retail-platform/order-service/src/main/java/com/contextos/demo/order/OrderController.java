package com.contextos.demo.order;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/orders")
public class OrderController {
  private final RefundEligibilityService refundEligibilityService;

  public OrderController(RefundEligibilityService refundEligibilityService) {
    this.refundEligibilityService = refundEligibilityService;
  }

  @GetMapping("/{orderId}")
  public Order getOrder(String orderId) {
    return new Order();
  }

  @PostMapping("/{orderId}/refund-eligibility")
  public RefundDecision checkRefundEligibility(String orderId) {
    return refundEligibilityService.evaluate(orderId);
  }
}
