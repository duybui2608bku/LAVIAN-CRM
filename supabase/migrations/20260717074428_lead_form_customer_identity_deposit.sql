alter table public.customers
  add column if not exists smax_customer_id text,
  add column if not exists deposit_amount numeric(14,2),
  add column if not exists deposit_currency text;

create unique index if not exists customers_smax_customer_id_uidx
  on public.customers (smax_customer_id)
  where smax_customer_id is not null;

alter table public.customers
  drop constraint if exists customers_deposit_amount_check,
  drop constraint if exists customers_deposit_currency_check,
  drop constraint if exists customers_deposit_pair_check;

alter table public.customers
  add constraint customers_deposit_amount_check
    check (deposit_amount is null or deposit_amount >= 0),
  add constraint customers_deposit_currency_check
    check (deposit_currency is null or deposit_currency ~ '^[A-Z]{3}$'),
  add constraint customers_deposit_pair_check
    check ((deposit_amount is null) = (deposit_currency is null));
