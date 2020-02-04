import React from "react";
import {
  Action,
  ActionsManagerInterface,
  UpdaterFn,
  ActionFilterFn,
  ActionResult,
} from "./types";
import { ExcalidrawElement } from "../element/types";
import { AppState } from "../types";
import { t } from "../i18n";

export class ActionManager implements ActionsManagerInterface {
  actions: { [keyProp: string]: Action } = {};

  updater: UpdaterFn;

  resumeHistoryRecording: () => void;

  constructor(updater: UpdaterFn, resumeHistoryRecording: () => void) {
    this.updater = updater;
    this.resumeHistoryRecording = resumeHistoryRecording;
  }

  registerAction(action: Action) {
    this.actions[action.name] = action;
  }

  handleKeyDown(
    event: KeyboardEvent,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) {
    const data = Object.values(this.actions)
      .sort((a, b) => (b.keyPriority || 0) - (a.keyPriority || 0))
      .filter(
        action => action.keyTest && action.keyTest(event, appState, elements),
      );

    if (data.length === 0) {
      return null;
    }

    event.preventDefault();
    if (data[0].commitToHistory === true) {
      this.resumeHistoryRecording();
    }
    return data[0].perform(elements, appState, null);
  }

  getContextMenuItems(
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    actionFilter: ActionFilterFn = action => action,
  ) {
    return Object.values(this.actions)
      .filter(actionFilter)
      .filter(action => "contextItemLabel" in action)
      .sort(
        (a, b) =>
          (a.contextMenuOrder !== undefined ? a.contextMenuOrder : 999) -
          (b.contextMenuOrder !== undefined ? b.contextMenuOrder : 999),
      )
      .map(action => ({
        label: action.contextItemLabel ? t(action.contextItemLabel) : "",
        action: () => {
          if (action.commitToHistory === true) {
            this.resumeHistoryRecording();
          }
          this.updater(action.perform(elements, appState, null));
        },
      }));
  }

  renderAction(
    name: string,
    elements: readonly ExcalidrawElement[],
    appState: AppState,
  ) {
    if (this.actions[name] && "PanelComponent" in this.actions[name]) {
      const action = this.actions[name];
      const PanelComponent = action.PanelComponent!;
      const updateData = (formState: any) => {
        if (action.commitToHistory === true) {
          this.resumeHistoryRecording();
        }
        this.updater(action.perform(elements, appState, formState));
      };

      return (
        <PanelComponent
          elements={elements}
          appState={appState}
          updateData={updateData}
        />
      );
    }

    return null;
  }
}
