import React from "react";
import { Popover } from "./Popover";
import { isTransparent } from "../utils";

import "./ColorPicker.scss";
import { isArrowKey, KEYS } from "../keys";
import { t, getLanguage } from "../i18n";
import { isWritableElement } from "../utils";
import colors from "../colors";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { COLOR_NAMES } from "../constants";

const MAX_CUSTOM_COLORS = 5;
const MAX_DEFAULT_COLORS = 15;

export const getCustomColors = (
  elements: readonly ExcalidrawElement[],
  type: "elementBackground" | "elementStroke",
  colors: string[], //zsviczian
) => {
  const customColors: string[] = [];
  const updatedElements = elements
    .filter((element) => !element.isDeleted)
    .sort((ele1, ele2) => ele2.updated - ele1.updated);

  let index = 0;
  const elementColorTypeMap = {
    elementBackground: "backgroundColor",
    elementStroke: "strokeColor",
  };
  const colorType = elementColorTypeMap[type] as
    | "backgroundColor"
    | "strokeColor";
  while (
    index < updatedElements.length &&
    customColors.length < MAX_CUSTOM_COLORS
  ) {
    const element = updatedElements[index];

    if (
      customColors.length < MAX_CUSTOM_COLORS &&
      isCustomColor(element[colorType], colors) && //zsviczian
      !customColors.includes(element[colorType])
    ) {
      customColors.push(element[colorType]);
    }
    index++;
  }
  return customColors;
};

const isCustomColor = (
  color: string,
  //type: "elementBackground" | "elementStroke", //zsviczian
  colors: string[], //zsviczian
) => {
  return !colors.includes(color); //zsviczian
};

const isValidColor = (color: string) => {
  const style = new Option().style;
  style.color = color;
  return !!style.color;
};

const getColor = (color: string): string | null => {
  if (isTransparent(color)) {
    return color;
  }

  // testing for `#` first fixes a bug on Electron (more specfically, an
  // Obsidian popout window), where a hex color without `#` is (incorrectly)
  // considered valid
  return isValidColor(`#${color}`)
    ? `#${color}`
    : isValidColor(color)
    ? color
    : null;
};

// This is a narrow reimplementation of the awesome react-color Twitter component
// https://github.com/casesandberg/react-color/blob/master/src/components/twitter/Twitter.js

// Unfortunately, we can't detect keyboard layout in the browser. So this will
// only work well for QWERTY but not AZERTY or others...
const keyBindings = [
  ["1", "2", "3", "4", "5"],
  ["q", "w", "e", "r", "t"],
  ["a", "s", "d", "f", "g"],
  ["z", "x", "c", "v", "b"],
].flat();

const Picker = ({
  colors,
  customPalette, //zsviczian
  color,
  onChange,
  onClose,
  label,
  showInput = true,
  type,
  elements,
}: {
  colors: string[];
  customPalette: boolean; //zsviczian
  color: string | null;
  onChange: (color: string) => void;
  onClose: () => void;
  label: string;
  showInput: boolean;
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  elements: readonly ExcalidrawElement[];
}) => {
  const firstItem = React.useRef<HTMLButtonElement>();
  const activeItem = React.useRef<HTMLButtonElement>();
  const gallery = React.useRef<HTMLDivElement>();
  const colorInput = React.useRef<HTMLInputElement>();

  const [customColors] = React.useState(() => {
    if (type === "canvasBackground") {
      return [];
    }
    return getCustomColors(elements, type, colors); //zsviczian
  });

  React.useEffect(() => {
    // After the component is first mounted focus on first input
    if (activeItem.current) {
      activeItem.current.focus();
    } else if (colorInput.current) {
      colorInput.current.focus();
    } else if (gallery.current) {
      gallery.current.focus();
    }
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    let handled = false;
    if (isArrowKey(event.key)) {
      handled = true;
      const { activeElement } = document;
      const isRTL = getLanguage().rtl;
      let isCustom = false;
      let index = Array.prototype.indexOf.call(
        gallery.current!.querySelector(".color-picker-content--default")
          ?.children,
        activeElement,
      );
      if (index === -1) {
        index = Array.prototype.indexOf.call(
          gallery.current!.querySelector(".color-picker-content--canvas-colors")
            ?.children,
          activeElement,
        );
        if (index !== -1) {
          isCustom = true;
        }
      }
      const parentElement = isCustom
        ? gallery.current?.querySelector(".color-picker-content--canvas-colors")
        : gallery.current?.querySelector(".color-picker-content--default");

      if (parentElement && index !== -1) {
        const length = parentElement.children.length - (showInput ? 1 : 0);
        const nextIndex =
          event.key === (isRTL ? KEYS.ARROW_LEFT : KEYS.ARROW_RIGHT)
            ? (index + 1) % length
            : event.key === (isRTL ? KEYS.ARROW_RIGHT : KEYS.ARROW_LEFT)
            ? (length + index - 1) % length
            : !isCustom && event.key === KEYS.ARROW_DOWN
            ? (index + 5) % length
            : !isCustom && event.key === KEYS.ARROW_UP
            ? (length + index - 5) % length
            : index;
        (parentElement.children[nextIndex] as HTMLElement | undefined)?.focus();
      }
      event.preventDefault();
    } else if (
      keyBindings.includes(event.key.toLowerCase()) &&
      !event[KEYS.CTRL_OR_CMD] &&
      !event.altKey &&
      !isWritableElement(event.target)
    ) {
      handled = true;
      const index = keyBindings.indexOf(event.key.toLowerCase());
      const isCustom = index >= MAX_DEFAULT_COLORS;
      const parentElement = isCustom
        ? gallery?.current?.querySelector(
            ".color-picker-content--canvas-colors",
          )
        : gallery?.current?.querySelector(".color-picker-content--default");
      const actualIndex = isCustom ? index - MAX_DEFAULT_COLORS : index;
      (
        parentElement?.children[actualIndex] as HTMLElement | undefined
      )?.focus();

      event.preventDefault();
    } else if (event.key === KEYS.ESCAPE || event.key === KEYS.ENTER) {
      handled = true;
      event.preventDefault();
      onClose();
    }
    if (handled) {
      event.nativeEvent.stopImmediatePropagation();
      event.stopPropagation();
    }
  };

  const renderColors = (colors: Array<string>, custom: boolean = false) => {
    return colors.map((_color, i) => {
      const _colorWithoutHash = _color.replace("#", "");
      const keyBinding = custom
        ? keyBindings[i + MAX_DEFAULT_COLORS]
        : MAX_DEFAULT_COLORS > i
        ? keyBindings[i]
        : ""; //zsviczian
      const label = custom
        ? _colorWithoutHash
        : customPalette
        ? _color
        : t(`colors.${_colorWithoutHash}`); //zsviczian
      return (
        <button
          className="color-picker-swatch"
          onClick={(event) => {
            (event.currentTarget as HTMLButtonElement).focus();
            onChange(_color);
          }}
          title={`${label}${
            !isTransparent(_color) ? ` (${_color})` : ""
          } — ${keyBinding.toUpperCase()}`}
          aria-label={label}
          aria-keyshortcuts={
            custom || MAX_DEFAULT_COLORS > i ? keyBindings[i] : ""
          } //zsviczian
          style={{ color: _color }}
          key={!custom && customPalette ? type + _color : _color} //zsviczian
          ref={(el) => {
            if (!custom && el && i === 0) {
              firstItem.current = el;
            }
            if (el && _color === color) {
              activeItem.current = el;
            }
          }}
          onFocus={() => {
            onChange(_color);
          }}
        >
          {isTransparent(_color) ? (
            <div className="color-picker-transparent"></div>
          ) : undefined}
          <span className="color-picker-keybinding">{keyBinding}</span>
        </button>
      );
    });
  };

  return (
    <div
      className={`color-picker color-picker-type-${type}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("labels.colorPicker")}
      onKeyDown={handleKeyDown}
    >
      <div className="color-picker-triangle color-picker-triangle-shadow"></div>
      <div className="color-picker-triangle"></div>
      <div
        className="color-picker-content"
        ref={(el) => {
          if (el) {
            gallery.current = el;
          }
        }}
        // to allow focusing by clicking but not by tabbing
        tabIndex={-1}
      >
        <div className="color-picker-content--default">
          {renderColors(colors)}
        </div>
        {!!customColors.length && (
          <div className="color-picker-content--canvas">
            <span className="color-picker-content--canvas-title">
              {t("labels.canvasColors")}
            </span>
            <div className="color-picker-content--canvas-colors">
              {renderColors(customColors, true)}
            </div>
          </div>
        )}

        {showInput && (
          <ColorInput
            color={color}
            label={label}
            onChange={(color) => {
              onChange(color);
            }}
            ref={colorInput}
          />
        )}
      </div>
    </div>
  );
};

const ColorInput = React.forwardRef(
  (
    {
      color,
      onChange,
      label,
    }: {
      color: string | null;
      onChange: (color: string) => void;
      label: string;
    },
    ref,
  ) => {
    const [innerValue, setInnerValue] = React.useState(color);
    const inputRef = React.useRef(null);

    React.useEffect(() => {
      setInnerValue(color);
    }, [color]);

    React.useImperativeHandle(ref, () => inputRef.current);

    const changeColor = React.useCallback(
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

    //zsviczian
    let opacity: string = "";
    const hexColor = (color:string):string => {
      if(Object.keys(COLOR_NAMES).includes(color)) {
        return COLOR_NAMES[color];
      }
      const style = new Option().style;
      style.color = color;
      if(!!style.color) {
        const digits = style.color.match(/^[^\d]*(\d*)[^\d]*(\d*)[^\d]*(\d*)[^\d]*([\d\.]*)?/);
        if(!digits) {
          return "#000000"
        }
        opacity = digits[4]
          ? (Math.round(parseFloat(digits[4])*255)<<0).toString(16).padStart(2,"0")
          : "";
        return `#${
          (parseInt(digits[1])<<0).toString(16).padStart(2,"0")}${
          (parseInt(digits[2])<<0).toString(16).padStart(2,"0")}${
          (parseInt(digits[3])<<0).toString(16).padStart(2,"0")}`
      }
      return "#000000"
    }

    return (
      <label className="color-input-container">
        <div className="color-picker-hash">#</div>
        <input
          spellCheck={false}
          className="color-picker-input"
          aria-label={label}
          onChange={(event) => changeColor(event.target.value)}
          value={(innerValue || "").replace(/^#/, "")}
          onBlur={() => setInnerValue(color)}
          ref={inputRef}
        />
      <input //zsviczian
        type="color"
        onChange={(event) => changeColor(event.target.value+opacity)}
        value={hexColor(innerValue || "")}
        onBlur={() => setInnerValue(color)}
        style={{
          marginTop: "auto",
          marginLeft: "5px",
          marginBottom: "auto",
          marginRight: "-0.625rem"
        }}
      />
      </label>
    );
  },
);

ColorInput.displayName = "ColorInput";

export const ColorPicker = ({
  type,
  color,
  onChange,
  label,
  isActive,
  setActive,
  colorPalette, //zsviczian
  elements,
  appState,
}: {
  type: "canvasBackground" | "elementBackground" | "elementStroke";
  color: string | null;
  onChange: (color: string) => void;
  label: string;
  isActive: boolean;
  setActive: (active: boolean) => void;
  colorPalette: {
    canvasBackground?: string[];
    elementBackground?: string[];
    elementStroke?: string[];
  }; //zsviczian
  elements: readonly ExcalidrawElement[];
  appState: AppState;
}) => {
  const pickerButton = React.useRef<HTMLButtonElement>(null);
  const customPalette = typeof colorPalette[type] !== "undefined"; //zsviczian
  const palette = customPalette
    ? colorPalette[type] ?? colors[type]
    : colors[type]; //zsviczian
  const coords = pickerButton.current?.getBoundingClientRect();
  //zsviczian
  let parent = pickerButton.current?.parentElement;
  //@ts-ignore
  while (parent && !parent.hasClass("workspace-leaf")) {
    parent = parent.parentElement;
  }
  const parentCoords = parent ? parent.getBoundingClientRect() : undefined;
  //zsviczian

  return (
    <div>
      <div className="color-picker-control-container">
        <div className="color-picker-label-swatch-container">
          <button
            className="color-picker-label-swatch"
            aria-label={label}
            style={color ? { "--swatch-color": color } : undefined}
            onClick={() => setActive(!isActive)}
            ref={pickerButton}
          />
        </div>
        <ColorInput
          color={color}
          label={label}
          onChange={(color) => {
            onChange(color);
          }}
        />
      </div>
      <React.Suspense fallback="">
        {isActive ? (
          <div
            className="color-picker-popover-container"
            style={{
              position: "fixed",
              top: coords //zsviczian
                ? coords.top - (parentCoords ? parentCoords.y : 0)
                : undefined,
              left: coords //zsviczian
                ? coords.right - (parentCoords ? parentCoords.x : 0)
                : undefined,
              zIndex: 1,
            }}
          >
            <Popover
              onCloseRequest={(event) =>
                event.target !== pickerButton.current && setActive(false)
              }
            >
              <Picker
                colors={palette} //zsviczian
                customPalette={customPalette} //zsviczian
                color={color || null}
                onChange={(changedColor) => {
                  onChange(changedColor);
                }}
                onClose={() => {
                  setActive(false);
                  pickerButton.current?.focus();
                }}
                label={label}
                showInput={false}
                type={type}
                elements={elements}
              />
            </Popover>
          </div>
        ) : null}
      </React.Suspense>
    </div>
  );
};
