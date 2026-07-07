import Image from "next/image";
import logo from "@/app/assets/logo.png";

// Logo LAVIAN — ảnh thương hiệu (app/assets/logo.png).
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt="LAVIAN CRM"
      className={className}
      priority
    />
  );
}
