package com.contextos.demo.order;

public record RefundDecision(String orderId, String result) {
  public static RefundDecision approved(String orderId) {
    return new RefundDecision(orderId, "APPROVED");
  }

  public static RefundDecision rejected(String orderId) {
    return new RefundDecision(orderId, "REJECTED");
  }
}
