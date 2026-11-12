-- Migration: Bỏ dịch vụ gắn trên khách hàng — LAVIAN-CRM
--
-- Mục đích: dịch vụ chỉ chọn trên lịch hẹn (clinic_appointments.service_ids);
-- khách hàng không còn danh sách dịch vụ riêng → drop bảng nối customer_services.
-- Lúc viết (2026-11-12) bảng có 0 dòng, không view/function nào phụ thuộc.
--
-- Thứ tự: deploy code mới (không còn đọc/ghi customer_services) TRƯỚC, rồi mới chạy file này.
-- Chạy lại an toàn (if exists).

drop table if exists public.customer_services;
