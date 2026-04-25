package com.contextos.demo.billing;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class RefundPaymentService {
  private final PaymentRepository paymentRepository;
  private final KafkaTemplate<String, String> kafkaTemplate;

  public RefundPaymentService(PaymentRepository paymentRepository, KafkaTemplate<String, String> kafkaTemplate) {
    this.paymentRepository = paymentRepository;
    this.kafkaTemplate = kafkaTemplate;
  }

  public RefundPreview preview(String orderId) {
    paymentRepository.findPaymentForOrder(orderId);
    return new RefundPreview(orderId, "PREVIEWED");
  }

  public RefundPreview create(String orderId) {
    paymentRepository.findPaymentForOrder(orderId);
    kafkaTemplate.send("refund-events", orderId);
    return new RefundPreview(orderId, "CREATED");
  }
}
