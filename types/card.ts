import type { CardPaymentMethod } from "@/lib/cards";

/** Dòng dịch vụ trong thẻ — bảng `treatment_card_items`. Giá bán là snapshot lúc bán (IDR). */
export interface CardItem {
  id: string;
  card_id: string;
  service_id: string;
  price: number;
  sessions: number; // số buổi của liệu trình
  refunded_at: string | null;
  refund_amount: number | null;
  refund_note: string;
  created_at: string;
  /** Nhóm DV + có tạo tour không (mực / phí Master = false) — join `services`. */
  service: { group_id: string; tourable: boolean } | null;
}

/** 1 lần thu tiền — bảng `treatment_card_payments`. amount âm = hoàn tiền khách. */
export interface CardPayment {
  id: string;
  card_id: string;
  amount: number;
  method: CardPaymentMethod;
  paid_at: string;
  note: string;
  images: string[]; // ảnh bill / chuyển khoản
  created_by: string | null;
}

/** Thẻ liệu trình — bảng `treatment_cards` (mã = DV chính + số: ALIS0013, BIBIR0014). */
export interface TreatmentCard {
  id: string;
  code: string;
  customer_id: string;
  appointment_id: string | null; // lịch hẹn bán thẻ (Sales Management)
  deposit_used: number; // cọc của khách trừ vào thẻ
  note: string;
  cancelled_at: string | null;
  /** Hoàn cả thẻ: thẻ khoá, Giá trị = Đã thu sau hoàn (cardMoney). */
  refunded_at: string | null;
  refund_amount: number | null;
  refund_method: CardPaymentMethod | null;
  refund_note: string;
  refunded_by: string | null;
  created_by: string | null;
  created_at: string;
  items: CardItem[];
  payments: CardPayment[];
  customer: { full_name: string; phone: string; address_detail: string | null } | null;
}

export const CARD_FIELDS = "id,code,customer_id,appointment_id,deposit_used,note,cancelled_at,refunded_at,refund_amount,refund_method,refund_note,refunded_by,created_by,created_at,"
  + "items:treatment_card_items(id,card_id,service_id,price,sessions,refunded_at,refund_amount,refund_note,created_at,service:services(group_id,tourable)),"
  + "payments:treatment_card_payments(id,card_id,amount,method,paid_at,note,images,created_by),"
  + "customer:customers(full_name,phone,address_detail)";
