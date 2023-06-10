import { getCommonBounds, getElementAbsoluteCoords } from "./element";
import {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  NonDeleted,
  NonDeletedExcalidrawElement,
} from "./element/types";
import { isPointWithinBounds } from "./math";
import { getBoundTextElement } from "./element/textElement";
import { arrayToMap, findIndex } from "./utils";
import { mutateElement } from "./element/mutateElement";
import { AppState } from "./types";
import { getElementsWithinSelection, getSelectedElements } from "./scene";
import { isFrameElement } from "./element";
import { moveOneRight } from "./zindex";
import { getElementsInGroup, selectGroupsFromGivenElements } from "./groups";
import Scene from "./scene/Scene";
import { getElementLineSegments } from "./element/bounds";

// --------------------------- Frame State ------------------------------------
export const bindElementsToFramesAfterDuplication = (
  nextElements: ExcalidrawElement[],
  oldElements: readonly ExcalidrawElement[],
  oldIdToDuplicatedId: Map<ExcalidrawElement["id"], ExcalidrawElement["id"]>,
) => {
  const nextElementMap = arrayToMap(nextElements) as Map<
    ExcalidrawElement["id"],
    ExcalidrawElement
  >;

  for (const element of oldElements) {
    if (element.frameId) {
      // use its frameId to get the new frameId
      const nextElementId = oldIdToDuplicatedId.get(element.id);
      const nextFrameId = oldIdToDuplicatedId.get(element.frameId);
      if (nextElementId) {
        const nextElement = nextElementMap.get(nextElementId);
        if (nextElement) {
          mutateElement(
            nextElement,
            {
              frameId: nextFrameId ?? element.frameId,
            },
            false,
          );
        }
      }
    }
  }
};

// --------------------------- Frame Geometry ---------------------------------
class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
}

class LineSegment {
  first: Point;
  second: Point;

  constructor(pointA: Point, pointB: Point) {
    this.first = pointA;
    this.second = pointB;
  }

  public getBoundingBox(): [Point, Point] {
    return [
      new Point(
        Math.min(this.first.x, this.second.x),
        Math.min(this.first.y, this.second.y),
      ),
      new Point(
        Math.max(this.first.x, this.second.x),
        Math.max(this.first.y, this.second.y),
      ),
    ];
  }
}

// https://martin-thoma.com/how-to-check-if-two-line-segments-intersect/
class FrameGeometry {
  private static EPSILON = 0.000001;

  private static crossProduct(a: Point, b: Point) {
    return a.x * b.y - b.x * a.y;
  }

  private static doBoundingBoxesIntersect(
    a: [Point, Point],
    b: [Point, Point],
  ) {
    return (
      a[0].x <= b[1].x &&
      a[1].x >= b[0].x &&
      a[0].y <= b[1].y &&
      a[1].y >= b[0].y
    );
  }

  private static isPointOnLine(a: LineSegment, b: Point) {
    const aTmp = new LineSegment(
      new Point(0, 0),
      new Point(a.second.x - a.first.x, a.second.y - a.first.y),
    );
    const bTmp = new Point(b.x - a.first.x, b.y - a.first.y);
    const r = this.crossProduct(aTmp.second, bTmp);
    return Math.abs(r) < this.EPSILON;
  }

  private static isPointRightOfLine(a: LineSegment, b: Point) {
    const aTmp = new LineSegment(
      new Point(0, 0),
      new Point(a.second.x - a.first.x, a.second.y - a.first.y),
    );
    const bTmp = new Point(b.x - a.first.x, b.y - a.first.y);
    return this.crossProduct(aTmp.second, bTmp) < 0;
  }

  private static lineSegmentTouchesOrCrossesLine(
    a: LineSegment,
    b: LineSegment,
  ) {
    return (
      this.isPointOnLine(a, b.first) ||
      this.isPointOnLine(a, b.second) ||
      (this.isPointRightOfLine(a, b.first)
        ? !this.isPointRightOfLine(a, b.second)
        : this.isPointRightOfLine(a, b.second))
    );
  }

  private static doLineSegmentsIntersect(
    a: [readonly [number, number], readonly [number, number]],
    b: [readonly [number, number], readonly [number, number]],
  ) {
    const aSegment = new LineSegment(
      new Point(a[0][0], a[0][1]),
      new Point(a[1][0], a[1][1]),
    );
    const bSegment = new LineSegment(
      new Point(b[0][0], b[0][1]),
      new Point(b[1][0], b[1][1]),
    );

    const box1 = aSegment.getBoundingBox();
    const box2 = bSegment.getBoundingBox();
    return (
      this.doBoundingBoxesIntersect(box1, box2) &&
      this.lineSegmentTouchesOrCrossesLine(aSegment, bSegment) &&
      this.lineSegmentTouchesOrCrossesLine(bSegment, aSegment)
    );
  }

  public static isElementIntersectingFrame(
    element: ExcalidrawElement,
    frame: ExcalidrawFrameElement,
  ) {
    const frameLineSegments = getElementLineSegments(frame);

    const elementLineSegments = getElementLineSegments(element);

    const intersecting = frameLineSegments.some((frameLineSegment) =>
      elementLineSegments.some((elementLineSegment) =>
        this.doLineSegmentsIntersect(frameLineSegment, elementLineSegment),
      ),
    );

    return intersecting;
  }
}

export const getElementsCompletelyInFrame = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) =>
  getElementsWithinSelection(elements, frame, false).filter(
    (element) =>
      element.type !== "frame" &&
      (!element.frameId || element.frameId === frame.id),
  );

export const isElementContainingFrame = (
  elements: readonly ExcalidrawElement[],
  element: ExcalidrawElement,
  frame: ExcalidrawFrameElement,
) => {
  return getElementsWithinSelection(elements, element).some(
    (e) => e.id === frame.id,
  );
};

export const getElementsIntersectingFrame = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) =>
  elements.filter((element) =>
    FrameGeometry.isElementIntersectingFrame(element, frame),
  );

export const elementsAreInFrameBounds = (
  elements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) => {
  const [selectionX1, selectionY1, selectionX2, selectionY2] =
    getElementAbsoluteCoords(frame);

  const [elementX1, elementY1, elementX2, elementY2] =
    getCommonBounds(elements);

  return (
    selectionX1 <= elementX1 &&
    selectionY1 <= elementY1 &&
    selectionX2 >= elementX2 &&
    selectionY2 >= elementY2
  );
};

export const elementOverlapsWithFrame = (
  element: ExcalidrawElement,
  frame: ExcalidrawFrameElement,
) => {
  return (
    elementsAreInFrameBounds([element], frame) ||
    FrameGeometry.isElementIntersectingFrame(element, frame) ||
    isElementContainingFrame([frame], element, frame)
  );
};

export const isCursorInFrame = (
  cursorCoords: {
    x: number;
    y: number;
  },
  frame: NonDeleted<ExcalidrawFrameElement>,
) => {
  const [fx1, fy1, fx2, fy2] = getElementAbsoluteCoords(frame);

  return isPointWithinBounds(
    [fx1, fy1],
    [cursorCoords.x, cursorCoords.y],
    [fx2, fy2],
  );
};

export const groupsAreAtLeastIntersectingTheFrame = (
  elements: readonly NonDeletedExcalidrawElement[],
  groupIds: readonly string[],
  frame: ExcalidrawFrameElement,
) => {
  const elementsInGroup = groupIds.flatMap((groupId) =>
    getElementsInGroup(elements, groupId),
  );

  if (elementsInGroup.length === 0) {
    return true;
  }

  return !!elementsInGroup.find(
    (element) =>
      elementsAreInFrameBounds([element], frame) ||
      FrameGeometry.isElementIntersectingFrame(element, frame),
  );
};

export const groupsAreCompletelyOutOfFrame = (
  elements: readonly NonDeletedExcalidrawElement[],
  groupIds: readonly string[],
  frame: ExcalidrawFrameElement,
) => {
  const elementsInGroup = groupIds.flatMap((groupId) =>
    getElementsInGroup(elements, groupId),
  );

  if (elementsInGroup.length === 0) {
    return true;
  }

  return (
    elementsInGroup.find(
      (element) =>
        elementsAreInFrameBounds([element], frame) ||
        FrameGeometry.isElementIntersectingFrame(element, frame),
    ) === undefined
  );
};

// --------------------------- Frame Utils ------------------------------------
export const getFrameElementsMapFromElements = (
  elements: readonly ExcalidrawElement[],
) => {
  const frameElementsMap = new Map<
    ExcalidrawFrameElement["id"],
    ExcalidrawElement[]
  >();
  for (const element of elements) {
    if (element.frameId) {
      frameElementsMap.set(element.frameId, [
        ...(frameElementsMap.get(element.frameId) ?? []),
        element,
      ]);
    }
  }

  return frameElementsMap;
};

export const getAllFrameElementsMapFromAppState = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  const frameElementsMap = new Map<
    ExcalidrawElement["id"],
    {
      frameSelected: boolean;
      elements: ExcalidrawElement[];
    }
  >();

  const selectedElements = arrayToMap(getSelectedElements(elements, appState));

  for (const element of elements) {
    if (isFrameElement(element)) {
      frameElementsMap.set(element.id, {
        frameSelected: selectedElements.has(element.id),
        elements: frameElementsMap.has(element.id)
          ? frameElementsMap.get(element.id)?.elements ??
            getElementsInFrame(elements, element.id)
          : getElementsInFrame(elements, element.id),
      });
    } else if (element.frameId) {
      frameElementsMap.set(element.frameId, {
        frameSelected: false,
        elements: frameElementsMap.has(element.frameId)
          ? frameElementsMap.get(element.id)?.elements ??
            getElementsInFrame(elements, element.frameId)
          : getElementsInFrame(elements, element.frameId),
      });
    }
  }

  return frameElementsMap;
};

export const getElementsToUpdateForFrame = (
  selectedElements: NonDeletedExcalidrawElement[],
  predicate: (element: NonDeletedExcalidrawElement) => boolean,
): NonDeletedExcalidrawElement[] => {
  const elementsToUpdate: NonDeletedExcalidrawElement[] = [];

  for (const element of selectedElements) {
    if (predicate(element)) {
      elementsToUpdate.push(element);
      // since adding elements to a frame will alter the z-indexes
      // we have to add bound text element to the update array as well
      // to keep the text right next to its container
      const textElement = getBoundTextElement(element);
      if (textElement) {
        elementsToUpdate.push(textElement);
      }
    }
  }

  return elementsToUpdate;
};

export const getElementsInFrame = (
  elements: readonly ExcalidrawElement[],
  frameId: string,
) => elements.filter((element) => element.frameId === frameId);

export const getElementsInResizingFrame = (
  allElements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
  appState: AppState,
): ExcalidrawElement[] => {
  const prevElementsInFrame = getElementsInFrame(allElements, frame.id);
  const nextElementsInFrame = new Set<ExcalidrawElement>(prevElementsInFrame);

  const elementsCompletelyInFrame = new Set([
    ...getElementsCompletelyInFrame(allElements, frame),
    ...prevElementsInFrame.filter((element) =>
      isElementContainingFrame(allElements, element, frame),
    ),
  ]);

  const elementsNotCompletelyInFrame = prevElementsInFrame.filter(
    (element) => !elementsCompletelyInFrame.has(element),
  );

  // for elements that are completely in the frame
  // if they are part of some groups, then those groups are still
  // considered to belong to the frame
  const groupsToKeep = new Set<string>(
    Array.from(elementsCompletelyInFrame).flatMap(
      (element) => element.groupIds,
    ),
  );

  for (const element of elementsNotCompletelyInFrame) {
    if (!FrameGeometry.isElementIntersectingFrame(element, frame)) {
      if (element.groupIds.length === 0) {
        nextElementsInFrame.delete(element);
      }
    } else if (element.groupIds.length > 0) {
      // group element intersects with the frame, we should keep the groups
      // that this element is part of
      for (const id of element.groupIds) {
        groupsToKeep.add(id);
      }
    }
  }

  for (const element of elementsNotCompletelyInFrame) {
    if (element.groupIds.length > 0) {
      let shouldRemoveElement = true;

      for (const id of element.groupIds) {
        if (groupsToKeep.has(id)) {
          shouldRemoveElement = false;
        }
      }

      if (shouldRemoveElement) {
        nextElementsInFrame.delete(element);
      }
    }
  }

  const individualElementsCompletelyInFrame = Array.from(
    elementsCompletelyInFrame,
  ).filter((element) => element.groupIds.length === 0);

  for (const element of individualElementsCompletelyInFrame) {
    nextElementsInFrame.add(element);
  }

  const newGroupElementsCompletelyInFrame = Array.from(
    elementsCompletelyInFrame,
  ).filter((element) => element.groupIds.length > 0);

  const groupIds = selectGroupsFromGivenElements(
    newGroupElementsCompletelyInFrame,
    appState,
  );

  // new group elements
  for (const [id, isSelected] of Object.entries(groupIds)) {
    if (isSelected) {
      const elementsInGroup = getElementsInGroup(allElements, id);

      if (elementsAreInFrameBounds(elementsInGroup, frame)) {
        for (const element of elementsInGroup) {
          nextElementsInFrame.add(element);
        }
      }
    }
  }

  return [...nextElementsInFrame];
};

export const getElementsInNewFrame = (
  allElements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
  appState: AppState,
) => {
  return omitGroupsContainingFrames(
    allElements,
    getElementsCompletelyInFrame(allElements, frame),
  );
};

export const getContainingFrame = (
  element: ExcalidrawElement,
  /**
   * Optionally an elements map, in case the elements aren't in the Scene yet.
   * Takes precedence over Scene elements, even if the element exists
   * in Scene elements and not the supplied elements map.
   */
  elementsMap?: Map<string, ExcalidrawElement>,
) => {
  if (element.frameId) {
    if (elementsMap) {
      return (elementsMap.get(element.frameId) ||
        null) as null | ExcalidrawFrameElement;
    }
    return (
      (Scene.getScene(element)?.getElement(
        element.frameId,
      ) as ExcalidrawFrameElement) || null
    );
  }
  return null;
};

// --------------------------- Frame Operations -------------------------------
export const addElementsToFrame = (
  allElements: readonly ExcalidrawElement[],
  elementsToAdd: NonDeletedExcalidrawElement[],
  frame: ExcalidrawFrameElement,
) => {
  const _elementsToAdd: ExcalidrawElement[] = [];

  for (const element of elementsToAdd) {
    _elementsToAdd.push(element);

    const boundTextElement = getBoundTextElement(element);
    if (boundTextElement) {
      _elementsToAdd.push(boundTextElement);
    }
  }

  let nextElements = allElements.slice();

  for (const element of _elementsToAdd) {
    // only necessary if the element is not already in the frame
    if (element.frameId !== frame.id) {
      mutateElement(
        element,
        {
          frameId: frame.id,
        },
        false,
      );

      const frameIndex = findIndex(nextElements, (e) => e.id === frame.id);
      const elementIndex = findIndex(nextElements, (e) => e.id === element.id);

      if (elementIndex < frameIndex) {
        nextElements = [
          ...nextElements.slice(0, elementIndex),
          ...nextElements.slice(elementIndex + 1, frameIndex),
          element,
          ...nextElements.slice(frameIndex),
        ];
      } else {
        nextElements = [
          ...nextElements.slice(0, frameIndex),
          element,
          ...nextElements.slice(frameIndex, elementIndex),
          ...nextElements.slice(elementIndex + 1),
        ];
      }
    }
  }

  return nextElements;
};

export const removeElementsFromFrame = (
  allElements: readonly ExcalidrawElement[],
  elementsToRemove: NonDeletedExcalidrawElement[],
  appState: AppState,
) => {
  const _elementsToRemove: ExcalidrawElement[] = [];

  for (const element of elementsToRemove) {
    if (element.frameId) {
      _elementsToRemove.push(element);
      const boundTextElement = getBoundTextElement(element);
      if (boundTextElement) {
        _elementsToRemove.push(boundTextElement);
      }
    }
  }

  for (const element of _elementsToRemove) {
    mutateElement(
      element,
      {
        frameId: null,
      },
      false,
    );
  }

  const nextElements = moveOneRight(
    allElements,
    appState,
    Array.from(_elementsToRemove),
  );

  return nextElements;
};

export const removeAllElementsFromFrame = (
  allElements: readonly ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
  appState: AppState,
) => {
  const elementsInFrame = getElementsInFrame(allElements, frame.id);
  return removeElementsFromFrame(allElements, elementsInFrame, appState);
};

export const replaceAllElementsInFrame = (
  allElements: readonly ExcalidrawElement[],
  nextElementsInFrame: ExcalidrawElement[],
  frame: ExcalidrawFrameElement,
  appState: AppState,
) => {
  return addElementsToFrame(
    removeAllElementsFromFrame(allElements, frame, appState),
    nextElementsInFrame,
    frame,
  );
};

/** does not mutate elements, but return new ones */
export const updateFrameMembershipOfSelectedElements = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
) => {
  let nextElements = [...elements];
  const selectedElements = getSelectedElements(elements, appState);
  const groupsToRemove = new Set<string>();

  const elementsMap = arrayToMap(elements);

  for (const element of selectedElements) {
    const containgFrame = getContainingFrame(element, elementsMap);

    if (containgFrame) {
      if (
        element.groupIds.length > 0 &&
        !element.groupIds.some((gid) => groupsToRemove.has(gid))
      ) {
        const allElementsInGroup = Array.from(
          new Set(
            element.groupIds.flatMap((gid) =>
              getElementsInGroup(elements, gid),
            ),
          ),
        );
        if (
          !allElementsInGroup.some((element) =>
            elementOverlapsWithFrame(element, containgFrame),
          )
        ) {
          nextElements = removeElementsFromFrame(
            nextElements,
            allElementsInGroup,
            appState,
          );
          element.groupIds.forEach((gid) => groupsToRemove.add(gid));
        }
      } else if (element.groupIds.length === 0) {
        if (!elementOverlapsWithFrame(element, containgFrame)) {
          nextElements = removeElementsFromFrame(
            nextElements,
            [element],
            appState,
          );
        }
      }
    }
  }

  return nextElements;
};

/**
 * filters out elements that are inside groups that contain a frame element
 * anywhere in the group tree
 *
 * elementsToFilter doesn't need to contain all elements in a particular group
 */
export const omitGroupsContainingFrames = (
  allElements: readonly ExcalidrawElement[],
  elementsToFilter: readonly ExcalidrawElement[],
) => {
  const elementsToAdd = new Set<ExcalidrawElement>(elementsToFilter);
  const rejectedGroupIds = new Set<string>();

  for (const element of elementsToFilter) {
    if (
      element.groupIds.length > 0 &&
      !element.groupIds.some((gid) => rejectedGroupIds.has(gid))
    ) {
      const allElementsInGroup = Array.from(
        new Set(
          element.groupIds.flatMap((gid) =>
            getElementsInGroup(allElements, gid),
          ),
        ),
      );

      if (allElementsInGroup.some((element) => isFrameElement(element))) {
        allElementsInGroup.forEach((element) => elementsToAdd.delete(element));
      }
    }
  }

  return Array.from(elementsToAdd);
};
