# tour-roadmap

## ADDED Requirements

### Requirement: Lộ trình tour dự kiến môi
Thẻ chưa huỷ có dòng DV nhóm `bibir` và/hoặc dòng xoá môi (Plasma) chưa hoàn SHALL có tour dự kiến cho phần còn lại của lộ trình môi: các tour Plasma còn buổi (nếu chưa Làm mới), rồi Làm mới, rồi Dặm tới hết buổi DV môi. Mọi bước cách bước trước **60 ngày**. Lộ trình môi và mày tính độc lập.

#### Scenario: Môi làm mới luôn
- **WHEN** thẻ có Nano Lip 2 buổi và tạo tour Làm mới ngày 01/12/2026
- **THEN** có 1 tour dự kiến Dặm 1 ngày 30/01/2027

#### Scenario: Môi xoá sửa
- **WHEN** thẻ có Lip Spray Removal (plasma) 1 buổi + Ombre Effect 2 buổi và tạo tour Plasma ngày 01/12/2026
- **THEN** có tour dự kiến Làm mới ngày 30/01/2027 và Dặm 1 ngày 31/03/2027

#### Scenario: Mày và môi cùng thẻ
- **WHEN** thẻ có Shading 2 buổi + Nano Lip 2 buổi, tour Làm mới mày và Làm mới môi cùng ngày 01/12/2026
- **THEN** Dặm mày dự kiến 15/01/2027, Dặm môi dự kiến 30/01/2027

#### Scenario: Đến hạn môi
- **WHEN** tour cuối của vùng môi là Plasma ngày 01/12/2026 (thật)
- **THEN** Đến hạn hiện "Kiểm tra Plasma" ngày 30/01/2027
