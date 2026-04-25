package com.contextos.demo.billing;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/billing")
public class BillingController {
  private final RefundPaymentService refundPaymentService;

  public BillingController(RefundPaymentService refundPaymentService) {
    this.refundPaymentService = refundPaymentService;
  }

  @PostMapping("/refunds/preview")
  public RefundPreview previewRefund(String orderId) {
    return refundPaymentService.preview(orderId);
  }

  @PostMapping("/refunds")
  public RefundPreview createRefund(String orderId) {
    return refundPaymentService.create(orderId);
  }
}
