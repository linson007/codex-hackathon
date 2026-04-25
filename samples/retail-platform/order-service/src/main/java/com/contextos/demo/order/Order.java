package com.contextos.demo.order;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "orders")
public class Order {
  private OrderStatus status;
  private boolean refundEligible;

  public boolean isRefundEligible() {
    return refundEligible && status == OrderStatus.DELIVERED;
  }
}
