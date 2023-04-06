import { useCallback, useEffect, useRef, useState } from "react";
import { getColor } from "./ColorPicker";
import clsx from "clsx";
import { useAtom } from "jotai";
import { activeColorPickerSectionAtom } from "./colorPickerUtils";

interface ColorInputProps {
  color: string | null;
  onChange: (color: string) => void;
  label: string;
}

export const ColorInput = ({ color, onChange, label }: ColorInputProps) => {
  const [innerValue, setInnerValue] = useState(color);
  const [activeSection, setActiveColorPickerSection] = useAtom(
    activeColorPickerSectionAtom,
  );

  useEffect(() => {
    setInnerValue(color);
  }, [color]);

  const changeColor = useCallback(
    (inputValue: string) => {
      const value = inputValue.toLowerCase();
      const color = getColor(value);

      if (color) {
        onChange(color);
      }
      setInnerValue(value);
    },
    [onChange],
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [activeSection]);

  return (
    <label className="color-picker__input-label">
      <div className="color-picker__input-hash">#</div>
      <input
        ref={activeSection === "hex" ? inputRef : undefined}
        style={{ border: 0, padding: 0 }}
        spellCheck={false}
        className="color-picker-input"
        aria-label={label}
        onChange={(event) => {
          changeColor(event.target.value);
        }}
        value={(innerValue || "").replace(/^#/, "")}
        onBlur={() => {
          setInnerValue(color);
        }}
        tabIndex={-1}
        onFocus={() => setActiveColorPickerSection("hex")}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            return;
          }
          if (e.key === "Escape") {
            divRef.current?.focus();
          }
          e.stopPropagation();
        }}
      />
      {/* COMMENTING OUT IN CASE WE WILL NEED TO REINTRODUCE LATER */}
      {/* <div
        style={{
          width: "1px",
          height: "1.25rem",
          backgroundColor: "var(--default-border-color)",
        }}
      />
      <div
        tabIndex={-1}
        ref={divRef}
        style={color ? { "--swatch-color": color } : undefined}
        className={clsx("color-picker__button", {
          "is-transparent": color === "transparent" || !color,
        })}
      >
        <div className="color-picker__button-border" />
      </div> */}
    </label>
  );
};
