import { Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  wrapperClassName,
}: SearchInputProps) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
        style={{ color: "#7a7469" }}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("pl-9 pr-4", className)}
        style={{
          backgroundColor: "#fafaf8",
          border: "1px solid #d9d4ce",
          color: "#181410",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#1b5e78")}
        onBlur={(e) => (e.target.style.borderColor = "#d9d4ce")}
      />
    </div>
  );
}
