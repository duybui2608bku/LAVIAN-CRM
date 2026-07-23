-- Chuẩn hóa toàn bộ tiền cọc khách hàng về một tiền tệ duy nhất: Rupiah (IDR).
-- Các bảng sổ/thanh toán không lưu currency riêng; ứng dụng luôn hiểu là IDR.

update public.customers
set deposit_currency = 'IDR'
where deposit_amount is not null
  and deposit_currency is distinct from 'IDR';

alter table public.customers
  drop constraint if exists customers_deposit_currency_check,
  drop constraint if exists customers_deposit_pair_check;

alter table public.customers
  add constraint customers_deposit_currency_check
    check (deposit_currency is null or deposit_currency = 'IDR'),
  add constraint customers_deposit_pair_check
    check (
      (deposit_amount is null and deposit_currency is null)
      or (deposit_amount is not null and deposit_currency = 'IDR')
    );
