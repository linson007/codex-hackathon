create table orders (
  id uuid primary key,
  customer_id uuid not null,
  status varchar(32) not null,
  refund_eligible boolean not null default false
);

create table refund_decisions (
  id uuid primary key,
  order_id uuid not null,
  reason varchar(255) not null
);
