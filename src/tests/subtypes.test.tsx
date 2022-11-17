import fallbackLangData from "./helpers/locales/en.json";
import {
  SubtypeRecord,
  SubtypeMethods,
  SubtypePrepFn,
  isValidSubtype,
  prepareSubtype,
  subtypeCollides,
} from "../subtypes";

import { render } from "./test-utils";
import { API } from "./helpers/api";
import ExcalidrawApp from "../excalidraw-app";

import { FontString, Theme } from "../element/types";
import { createIcon, iconFillColor } from "../components/icons";
import { SubtypeButton } from "../components/SubtypeButton";
import { registerAuxLangData } from "../i18n";
import { getFontString } from "../utils";
import * as textElementUtils from "../element/textElement";
import { isTextElement } from "../element";

const MW = 200;
const TWIDTH = 200;
const THEIGHT = 20;
const TBASELINE = 15;
const DBFONTSIZE = 40;

const getLangData = async (langCode: string): Promise<Object | undefined> => {
  try {
    const condData = await import(
      /* webpackChunkName: "locales/[request]" */ `./helpers/locales/${langCode}.json`
    );
    if (condData) {
      return condData;
    }
  } catch (e) {}
  return undefined;
};

const testSubtypeIcon = ({ theme }: { theme: Theme }) =>
  createIcon(
    <path
      stroke={iconFillColor(theme)}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
    />,
    { width: 40, height: 20, mirror: true },
  );

const test1: SubtypeRecord = {
  subtype: "test",
  parents: ["line", "arrow", "rectangle", "diamond", "ellipse"],
  actionNames: [],
  disabledNames: ["changeSloppiness"],
  shortcutMap: {},
};

const test1NonParent = "text" as const;

const test2: SubtypeRecord = {
  subtype: "test2",
  parents: ["text"],
  actionNames: [],
  disabledNames: [],
  shortcutMap: {},
};

const test3: SubtypeRecord = {
  subtype: "test3",
  parents: ["text", "line"],
  actionNames: [],
  disabledNames: [],
  shortcutMap: {},
};

const cleanTestElementUpdate = function (updates) {
  const oldUpdates = {};
  for (const key in updates) {
    if (key !== "roughness") {
      (oldUpdates as any)[key] = (updates as any)[key];
    }
  }
  (updates as any).roughness = 0;
  return oldUpdates;
} as SubtypeMethods["clean"];

const prepareTest1Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as SubtypeMethods;
  methods.clean = cleanTestElementUpdate;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [SubtypeButton("test", "line", testSubtypeIcon)];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const prepareTest2Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const measureTest2: SubtypeMethods["measureText"] = function (
    element,
    next,
    maxWidth,
  ) {
    const text = next?.text ?? element.text;
    const fontSize = next?.fontSize ?? element.fontSize;
    const fontFamily = element.fontFamily;
    const fontString = getFontString({ fontSize, fontFamily });
    const metrics = textElementUtils.measureText(text, fontString, maxWidth);
    const width = Math.max(metrics.width - 10, 0);
    const height = Math.max(metrics.height - 5, 0);
    return { width, height, baseline: metrics.baseline + 1 };
  };
  const wrapTest2: SubtypeMethods["wrapText"] = function (
    element,
    maxWidth,
    next,
  ) {
    const text = next?.text ?? element.originalText;
    if (next?.fontSize === DBFONTSIZE) {
      return `${text.split(" ").join("\n")}\nHELLO WORLD.`;
    }
    return `${text.split(" ").join("\n")}\nHello world.`;
  };
  const methods = {
    measureText: measureTest2,
    wrapText: wrapTest2,
  } as SubtypeMethods;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [SubtypeButton("test2", "text", testSubtypeIcon)];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const prepareTest3Subtype = function (
  addSubtypeAction,
  addLangData,
  onSubtypeLoaded,
) {
  const methods = {} as SubtypeMethods;

  addLangData(fallbackLangData, getLangData);
  registerAuxLangData(fallbackLangData, getLangData);

  const actions = [SubtypeButton("test3", "text", testSubtypeIcon)];
  actions.forEach((action) => addSubtypeAction(action));

  return { actions, methods };
} as SubtypePrepFn;

const { h } = window;

prepareSubtype(test1, prepareTest1Subtype);
prepareSubtype(test2, prepareTest2Subtype);
prepareSubtype(test3, prepareTest3Subtype);

describe("subtypes", () => {
  it("should correctly validate", async () => {
    test1.parents.forEach((p) => {
      expect(isValidSubtype(test1.subtype, p)).toBe(true);
      expect(isValidSubtype(undefined, p)).toBe(false);
    });
    expect(isValidSubtype(test1.subtype, test1NonParent)).toBe(false);
    expect(isValidSubtype(test1.subtype, undefined)).toBe(false);
    expect(isValidSubtype(undefined, undefined)).toBe(false);
  });
  it("should collide with themselves", async () => {
    expect(subtypeCollides(test1.subtype, [test1.subtype])).toBe(true);
    expect(subtypeCollides(test1.subtype, [test1.subtype, test2.subtype])).toBe(
      true,
    );
  });
  it("should not collide without type overlap", async () => {
    expect(subtypeCollides(test1.subtype, [test2.subtype])).toBe(false);
  });
  it("should collide with type overlap", async () => {
    expect(subtypeCollides(test1.subtype, [test3.subtype])).toBe(true);
  });
  it("should apply to ExcalidrawElements", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({ type: "line", id: "A", subtype: test1.subtype }),
          API.createElement({ type: "arrow", id: "B", subtype: test1.subtype }),
          API.createElement({
            type: "rectangle",
            id: "C",
            subtype: test1.subtype,
          }),
          API.createElement({
            type: "diamond",
            id: "D",
            subtype: test1.subtype,
          }),
          API.createElement({
            type: "ellipse",
            id: "E",
            subtype: test1.subtype,
          }),
        ],
      },
    });
    h.elements.forEach((el) => expect(el.subtype).toBe(test1.subtype));
  });
  it("should enforce prop value restrictions", async () => {
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({
            type: "line",
            id: "A",
            subtype: test1.subtype,
            roughness: 1,
          }),
          API.createElement({ type: "line", id: "B", roughness: 1 }),
        ],
      },
    });
    h.elements.forEach((el) => {
      if (el.subtype === test1.subtype) {
        expect(el.roughness).toBe(0);
      } else {
        expect(el.roughness).toBe(1);
      }
    });
  });
  it("should call custom text methods", async () => {
    const testString = "A quick brown fox jumps over the lazy dog.";
    await render(<ExcalidrawApp />, {
      localStorageData: {
        elements: [
          API.createElement({
            type: "text",
            id: "A",
            subtype: test2.subtype,
            text: testString,
          }),
        ],
      },
    });
    const mockMeasureText = (
      text: string,
      font: FontString,
      maxWidth?: number | null,
    ) => {
      if (text === testString) {
        if (font.includes(`${DBFONTSIZE}`)) {
          return {
            width: 2 * TWIDTH,
            height: 2 * THEIGHT,
            baseline: 2 * TBASELINE,
          };
        }
        return { width: TWIDTH, height: THEIGHT, baseline: TBASELINE };
      }
      return { width: 1, height: 0, baseline: 0 };
    };

    jest
      .spyOn(textElementUtils, "measureText")
      .mockImplementation(mockMeasureText);

    h.elements.forEach((el) => {
      if (isTextElement(el)) {
        // First test with `ExcalidrawTextElement.text`
        const metrics = textElementUtils.measureTextElement(el);
        expect(metrics).toStrictEqual({
          width: TWIDTH - 10,
          height: THEIGHT - 5,
          baseline: TBASELINE + 1,
        });
        const wrappedText = textElementUtils.wrapTextElement(el, MW);
        expect(wrappedText).toEqual(
          `${testString.split(" ").join("\n")}\nHello world.`,
        );

        // Now test with modified text in `next`
        let next: { text?: string; fontSize?: number } = {
          text: "Hello world.",
        };
        const nextMetrics = textElementUtils.measureTextElement(el, next);
        expect(nextMetrics).toStrictEqual({ width: 0, height: 0, baseline: 1 });
        const nextWrappedText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextWrappedText).toEqual("Hello\nworld.\nHello world.");

        // Now test modified fontSizes in `next`
        next = { fontSize: DBFONTSIZE };
        const nextFM = textElementUtils.measureTextElement(el, next);
        expect(nextFM).toStrictEqual({
          width: 2 * TWIDTH - 10,
          height: 2 * THEIGHT - 5,
          baseline: 2 * TBASELINE + 1,
        });
        const nextFWrText = textElementUtils.wrapTextElement(el, MW, next);
        expect(nextFWrText).toEqual(
          `${testString.split(" ").join("\n")}\nHELLO WORLD.`,
        );
      }
    });
  });
});
