package com.contextos.demo.order;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class RefundEligibilityService {
  private final OrderRepository orderRepository;
  private final BillingClient billingClient;
  private final KafkaTemplate<String, String> kafkaTemplate;

  public RefundEligibilityService(OrderRepository orderRepository, BillingClient billingClient, KafkaTemplate<String, String> kafkaTemplate) {
    this.orderRepository = orderRepository;
    this.billingClient = billingClient;
    this.kafkaTemplate = kafkaTemplate;
  }

  public RefundDecision evaluate(String orderId) {
    Order order = orderRepository.findById(orderId);
    RefundDecision decision = order.isRefundEligible() ? RefundDecision.approved(orderId) : RefundDecision.rejected(orderId);
    billingClient.previewRefund(orderId);
    kafkaTemplate.send("refund-events", orderId);
    return decision;
  }
}
