import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import ToastMessage from "./ToastMessage";

export type ShowToastMessageOptions = {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  duration?: number;
};

export function showToastMessage({
  title,
  description,
  icon,
  duration = 5000,
}: ShowToastMessageOptions = {}) {
  toast.custom((id: string | number) => (
    <ToastMessage
      title={title}
      description={description}
      icon={icon}
      onDismiss={() => toast.dismiss(id)}
    />
  ), {
    duration,
  });
}
