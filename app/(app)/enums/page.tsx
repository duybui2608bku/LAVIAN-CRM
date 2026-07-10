import { redirect } from "next/navigation";

// Danh mục đã tách trang con theo kind — giữ URL cũ sống bằng redirect.
export default function EnumsPage() {
  redirect("/enums/stage");
}
