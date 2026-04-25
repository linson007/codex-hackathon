create table payments (
  id uuid primary key,
  order_id uuid not null,
  amount decimal not null
);

create table refunds (
  id uuid primary key,
  payment_id uuid not null,
  status varchar(32) not null
);
