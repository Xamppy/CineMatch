import { Loader2 } from "lucide-react";

export default function RoomLoading() {
  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
    </div>
  );
}
