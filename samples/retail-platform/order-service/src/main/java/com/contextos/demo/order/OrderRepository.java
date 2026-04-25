package com.contextos.demo.order;

import org.springframework.stereotype.Repository;

@Repository
public class OrderRepository {
  public Order findById(String orderId) {
    return new Order();
  }
}
