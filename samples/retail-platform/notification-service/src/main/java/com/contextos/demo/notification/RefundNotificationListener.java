package com.contextos.demo.notification;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class RefundNotificationListener {
  private final CustomerNotificationService customerNotificationService;

  public RefundNotificationListener(CustomerNotificationService customerNotificationService) {
    this.customerNotificationService = customerNotificationService;
  }

  @KafkaListener(topics = "refund-events")
  public void onRefundEvent(String orderId) {
    customerNotificationService.sendRefundNotification(orderId);
  }
}
