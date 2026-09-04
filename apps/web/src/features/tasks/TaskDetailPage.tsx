import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import styled, { keyframes } from "styled-components";
import { Button } from "@ai-pixel-office/ui";
import type {
  Agent,
  Skill,
  TaskStatus,
  TaskWorkflowStep,
  WorkflowPreset,
  Workspace,
} from "@ai-pixel-office/domain/entities";
import { activityApi } from "../activity/api.ts";
import { agentApi } from "../agents/api.ts";
import { skillApi } from "../skills/api.ts";
import { workflowApi } from "../workflows/api.ts";
import { taskApi, type TaskDetail, type TaskExecutionContext } from "./api.ts";
import { PetPreview } from "../office/PetPreview.tsx";
import { STATUS } from "../../shared/config/presentation.ts";
import { useConfirmDialog } from "../../shared/hooks/useFeedbackDialog.ts";
import { messageOf } from "../../shared/lib/errors.ts";
import { ConfirmDialog } from "../../shared/ui/FeedbackDialogs.tsx";
import { Empty, ErrorBanner, FullScreenMessage } from "../../shared/ui/common.tsx";
import { BaseLayout } from "../../shared/ui/BaseLayout.tsx";
import { ProjectDirectorySelect, ProjectSelect } from "../projects/ProjectSelect.tsx";

const pixelWork = keyframes`
  from {
    height: 8px;
    opacity: 0.45;
  }
  to {
    height: 31px;
    opacity: 1;
  }
`;

const STATUS_ACCENT: Record<TaskStatus, string> = {
  todo: "#c19a54",
  working: "#4c8a75",
  needs_review: "#8b68b5",
  needs_input: "#487fad",
  blocked: "#c85f58",
  failed: "#a54349",
  done: "#599875",
};

const RUN_DOT_COLOR: Record<TaskDetail["runs"][number]["status"], string> = {
  queued: "#9a9189",
  running: "#54a076",
  completed: "#4f8c75",
  waiting: "#9a9189",
  failed: "#c65b56",
  cancelled: "#c65b56",
};

const RunRow = styled.summary`
  display: grid;
  grid-template-columns: 12px 90px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 10px 3px;
  border-bottom: 1px solid #e8dfd1;
  font-size: 11px;

  time {
    color: ${({ theme }) => theme.colors.muted};
  }

  @media (max-width: 760px) {
    grid-template-columns: 12px 70px 1fr;

    time {
      display: none;
    }
  }
`;

const RunDot = styled.span<{ $status: TaskDetail["runs"][number]["status"] }>`
  width: 8px;
  height: 8px;
  background: ${({ $status }) => RUN_DOT_COLOR[$status]};

  ${({ $status }) =>
    $status === "running" &&
    `
      box-shadow: 0 0 0 3px #d7eadf;
    `}
`;

const RunExpandIcon = styled.span`
  position: absolute;
  right: 6px;
  color: #9a5d57;
  font-size: 20px;
  line-height: 1;
  transition: transform 0.15s ease-out;
`;

const RunEntry = styled.details<{ $failed: boolean }>`
  border-bottom: 1px solid #e8dfd1;

  ${RunRow} {
    position: relative;
    padding-right: 25px;
    border-bottom: 0;
    cursor: pointer;
    list-style: none;

    &::-webkit-details-marker {
      display: none;
    }
  }

  &[open] ${RunExpandIcon} {
    transform: rotate(90deg);
  }

  &[open] ${RunRow} {
    background: ${({ $failed }) => ($failed ? "#fff5f1" : "#f4f7f4")};
  }
`;

const Styled = {
  Heading: styled.div`
    margin: 25px 0 28px;

    h1 {
      margin: 5px 0 0;
      color: #3d3632;
      font-size: clamp(29px, 4vw, 42px);
      letter-spacing: -0.045em;
    }

    p {
      color: ${({ theme }) => theme.colors.muted};
      max-width: 720px;
    }
  `,
  StatusPill: styled.span<{ $status: TaskStatus }>`
    display: inline-block;
    padding: 5px 9px;
    border: 2px solid currentColor;
    border-top-color: ${({ $status }) => STATUS_ACCENT[$status]};
    background: #fff8ed;
    font: 800 10px monospace;
  `,
  DetailLayout: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(260px, 0.65fr);
    gap: 20px;
    align-items: start;

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  DetailMain: styled.div`
    min-width: 0;
    display: grid;
    gap: 20px;
  `,
  ResultPanel: styled.section`
    padding: 21px;
    min-height: 340px;
  `,
  MarkdownResult: styled.div<{ $size?: "default" | "compact" | "small" }>`
    font-size: ${({ $size }) => ($size === "compact" ? "12px" : $size === "small" ? "11px" : "14px")};
    line-height: 1.75;

    h1,
    h2,
    h3 {
      margin: 1.25em 0 0.55em;
      color: #403832;
      line-height: 1.35;
    }

    h1 {
      font-size: 22px;
      border-bottom: 2px solid #e2d6c5;
      padding-bottom: 8px;
    }

    h2 {
      font-size: 18px;
    }

    h3 {
      font-size: 15px;
    }

    p {
      margin: 0.7em 0;
    }

    ul,
    ol {
      padding-left: 22px;
    }

    li {
      margin: 0.32em 0;
    }

    code {
      padding: 2px 5px;
      background: #eee5d8;
      border: 1px solid #d4c5b3;
      font: 12px monospace;
    }

    pre {
      padding: 13px;
      overflow: auto;
      background: #292b31;
      color: #f5eee3;
      border: 2px solid #17191e;
    }

    pre code {
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
    }

    blockquote {
      margin-left: 0;
      padding-left: 13px;
      border-left: 4px solid #779a8b;
      color: #71675f;
    }

    table {
      width: 100%;
      border-collapse: collapse;
    }

    th,
    td {
      padding: 7px;
      border: 1px solid #d6c9b8;
      text-align: left;
    }
  `,
  CurrentRunRequest: styled.div`
    display: grid;
    gap: 5px;
    margin: 14px 0 4px;
    padding: 11px 13px;
    border-left: 4px solid #5d8e79;
    background: #edf5f0;

    span {
      color: #46715f;
      font-size: 9px;
      font-weight: 900;
    }

    p {
      margin: 0;
      color: #5f655f;
      font-size: 11px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
  `,
  PreviousResult: styled.details`
    margin-top: 16px;
    border: 1px solid #d5c9b9;
    background: #faf6ef;

    > summary {
      padding: 10px 12px;
      color: #6c625a;
      font-size: 10px;
      font-weight: 800;
      cursor: pointer;
    }

    > div {
      padding: 2px 13px 13px;
      border-top: 1px solid #ded3c4;
    }
  `,
  TaskBriefEditor: styled.div`
    margin-top: 18px;
    display: grid;
    gap: 7px;

    label {
      color: #4c625a;
      font-size: 12px;
      font-weight: 900;
    }

    p {
      margin: 0;
      color: ${({ theme }) => theme.colors.muted};
      font-size: 11px;
      line-height: 1.55;
    }

    textarea {
      width: 100%;
      min-height: 180px;
      resize: vertical;
      line-height: 1.55;
      background: #fffdf8;
    }
  `,
  TaskBriefActions: styled.div`
    margin-top: 3px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    small {
      margin: 0;
      color: ${({ theme }) => theme.colors.muted};
      font-size: 11px;
      line-height: 1.55;
    }

    @media (max-width: 760px) {
      align-items: flex-start;
      flex-direction: column;
    }
  `,
  WorkProgress: styled.div<{ $waiting: boolean }>`
    min-height: 230px;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 11px;
    text-align: center;

    strong {
      font-size: 17px;
      color: #3f6d5d;
    }

    p {
      max-width: 420px;
      margin: 0;
      color: #81756c;
      font-size: 11px;
      line-height: 1.6;
    }

    ${({ $waiting }) =>
      $waiting &&
      `
        .progress-pixels span {
          background: #7b63a0;
        }
      `}
  `,
  ProgressPixels: styled.div`
    display: flex;
    align-items: end;
    gap: 5px;
    height: 34px;

    span {
      width: 10px;
      height: 10px;
      background: #568d78;
      animation: ${pixelWork} 0.9s infinite alternate;

      &:nth-child(2) {
        animation-delay: 0.15s;
      }

      &:nth-child(3) {
        animation-delay: 0.3s;
      }

      &:nth-child(4) {
        animation-delay: 0.45s;
      }
    }
  `,
  FailureState: styled.div`
    min-height: 230px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 25px;

    > span {
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      width: 44px;
      height: 44px;
      background: #c75f58;
      color: #fff;
      border: 3px solid #773d39;
      box-shadow: 3px 3px 0 #d8a49c;
      font: 900 23px monospace;
    }

    div {
      max-width: 560px;
    }

    strong {
      color: #863f3b;
    }

    p {
      margin: 7px 0 0;
      color: #725c57;
      font: 11px/1.6 monospace;
      white-space: pre-wrap;
      word-break: break-word;
    }
  `,
  SessionLimitState: styled.div`
    display: grid;
    grid-template-columns: 42px 1fr;
    gap: 13px;
    margin-top: 18px;
    padding: 18px;
    border: 2px solid #b18a50;
    background: #fff3d6;

    > span {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: #d49a43;
      color: #fff;
      font-size: 21px;
      font-weight: 900;
    }

    strong {
      color: #6c4a20;
    }

    p {
      margin: 5px 0 13px;
      color: #755f42;
      font-size: 12px;
      line-height: 1.6;
    }
  `,
  SessionLimitActions: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  RunProgress: styled.div`
    margin-top: 4px;
    padding-top: 14px;
    border-top: 2px dashed #d6c9b7;
  `,
  RunProgressHeading: styled.div`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    color: #4a695e;
    font-size: 11px;

    span {
      padding: 2px 6px;
      background: #e0ece6;
      font: 800 9px monospace;
    }
  `,
  RunProgressList: styled.div`
    max-height: 230px;
    overflow: auto;
    display: grid;
  `,
  ProgressEvent: styled.div<{ $type: string }>`
    display: grid;
    grid-template-columns: 18px 1fr;
    gap: 6px;
    padding: 7px 3px;
    border-bottom: 1px solid #e8ded0;

    > span {
      color: #588472;
      font: 800 11px monospace;

      ${({ $type }) => $type === "permission_requested" && `color: #a45a4f;`}
    }

    div {
      min-width: 0;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 3px 8px;
    }

    p {
      margin: 0;
      color: #615850;
      font-size: 10px;
      line-height: 1.45;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    code {
      grid-column: 1 / -1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #806b5d;
      font-size: 9px;
    }

    time {
      grid-column: 2;
      grid-row: 1;
      color: #9a9087;
      font-size: 8px;
    }
  `,
  Artifact: styled.div`
    margin-top: 12px;
    padding: 12px;
    display: flex;
    gap: 11px;
    border: 1px solid #d3c6b6;
    background: #f5ecdf;

    div {
      display: grid;
      gap: 3px;
    }

    small {
      color: ${({ theme }) => theme.colors.muted};
    }
  `,
  ReviewBox: styled.div`
    display: grid;
    gap: 12px;
    margin-top: 23px;
    padding: 16px;
    border: 2px solid #a5b9ae;
    background: #f3f8f4;
    box-shadow: 3px 3px 0 #d0ddd6;
  `,
  ReviewCopy: styled.div`
    display: grid;
    gap: 4px;

    strong {
      color: #355e50;
      font-size: 13px;
    }

    p {
      margin: 0;
      color: #6f7e77;
      font-size: 10px;
      line-height: 1.5;
    }
  `,
  ReviewFollowup: styled.form`
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;

    input {
      min-width: 0;
    }

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  ReviewFinish: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 11px;
    border-top: 1px solid #cedbd4;

    span {
      color: #7a8780;
      font-size: 9px;
    }

    @media (max-width: 760px) {
      align-items: flex-start;
    }
  `,
  WorkflowPanel: styled.section`
    margin-bottom: 18px;
    padding-bottom: 16px;
    border-bottom: 2px solid #e6dbcb;
  `,
  AssignmentModeSwitch: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
    margin-bottom: 12px;
    padding: 4px;
    border: 1px solid #cbbdac;
    background: #eee5d8;

    button {
      min-width: 0;
      padding: 8px 5px;
      border: 1px solid transparent;
      background: transparent;
      color: #766a61;
      font-size: 9px;
      font-weight: 800;
      cursor: pointer;

      &.selected {
        border-color: #557d6d;
        background: #fffdfa;
        color: #355e50;
        box-shadow: 2px 2px 0 #bdcec5;
      }

      &:disabled {
        cursor: not-allowed;
        opacity: 0.48;
      }
    }
  `,
  WorkflowEditor: styled.div`
    display: grid;
    gap: 9px;
    margin: 0;
    padding: 0;
  `,
  WorkflowEditorStep: styled.div`
    min-width: 0;
    padding: 8px;
    border: 1px solid #d2c5b4;
    background: #faf5ed;
    display: grid;
    gap: 7px;
  `,
  WorkflowStepMain: styled.div`
    min-width: 0;
    display: grid;
    grid-template-columns: 25px minmax(0, 1fr);
    gap: 7px;
    align-items: center;

    > span {
      width: 23px;
      height: 23px;
      border: 1px solid #7d6a5d;
      background: #eee3d2;
      display: grid;
      place-items: center;
      font: 800 9px monospace;
    }

    select {
      width: 100%;
      min-width: 0;
      height: 34px;
      padding: 4px 7px;
      border: 1px solid #bcae9c;
      background: #fffdfa;
      font-size: 9px;
    }
  `,
  WorkflowStepControls: styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;

    > span {
      min-width: 0;
      margin-right: auto;
      color: ${({ theme }) => theme.colors.muted};
      font-size: 8px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    button {
      flex: 0 0 27px;
      width: 27px;
      height: 26px;
      padding: 0;
      border: 1px solid #c7b9a7;
      background: #f4eadb;
      cursor: pointer;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.35;
      }
    }
  `,
  WorkflowPresetPicker: styled.div`
    display: grid;
    gap: 5px;
    padding: 9px;
    border: 1px solid #9fb4aa;
    background: #edf4f0;

    label {
      color: #4f675d;
      font-size: 9px;
      font-weight: 800;
    }

    > div {
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 5px;
    }

    select {
      min-width: 0;
      height: 32px;
      padding: 4px 6px;
      border-width: 1px;
      font-size: 9px;
    }
  `,
  WorkflowPresetDelete: styled.button`
    padding: 0 7px;
    border: 1px solid #c5a09b;
    background: #fff8f4;
    color: #8d514d;
    font-size: 8px;
    cursor: pointer;

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  `,
  WorkflowAddStep: styled.button`
    width: 100%;
    padding: 8px;
    border: 1px dashed #8ca598;
    background: #f6faf7;
    color: #426c5b;
    font-size: 9px;
    font-weight: 800;
    cursor: pointer;
  `,
  WorkflowPresetSave: styled.form`
    min-width: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 5px;

    input {
      min-width: 0;
      padding: 7px;
      border-width: 1px;
      font-size: 9px;
    }

    button {
      padding: 7px 8px;
      font-size: 8px;
      white-space: nowrap;
    }
  `,
  WorkflowEditorActions: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-top: 2px;

    button {
      padding: 7px 9px;
      font-size: 9px;
    }
  `,
  WorkflowMessage: styled.small`
    display: block;
    margin: 6px 0 0;
    color: #8d514d;
    font-size: 9px;
    line-height: 1.5;
  `,
  WorkflowEmpty: styled.p`
    margin: 6px 0 0;
    color: #8d514d;
    font-size: 9px;
    line-height: 1.5;
  `,
  WorkflowSummary: styled.div`
    display: grid;
    gap: 9px;

    ol {
      display: grid;
      gap: 5px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    li {
      min-width: 0;
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      align-items: center;
      gap: 7px;
      padding: 6px 8px;
      background: #f4ede2;

      span {
        color: #557d6d;
        font: 800 9px monospace;
      }

      strong {
        overflow: hidden;
        font-size: 9px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  `,
  WorkflowProgressList: styled.ol`
    display: grid;
    gap: 9px;
    margin: 0;
    padding: 0;
    list-style: none;

    li {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      position: relative;

      > span {
        width: 23px;
        height: 23px;
        border: 1px solid #7d6a5d;
        background: #eee3d2;
        display: grid;
        place-items: center;
        font: 800 9px monospace;
      }

      > div {
        min-width: 0;
        display: grid;
        gap: 2px;
        padding-bottom: 8px;
      }

      strong {
        font-size: 10px;
      }

      small {
        color: ${({ theme }) => theme.colors.muted};
        font-size: 8px;
      }

      p {
        max-height: 34px;
        margin: 3px 0 0;
        overflow: hidden;
        color: #756960;
        font-size: 8px;
        line-height: 1.4;
      }

      &.has-result {
        cursor: pointer;

        &:hover > div strong {
          color: #356551;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
      }

      &:not(:last-child)::after {
        content: "";
        position: absolute;
        left: 11px;
        top: 24px;
        width: 2px;
        height: calc(100% - 14px);
        background: #cbbdac;
      }

      &[data-status="working"] > span {
        border-color: #3f715d;
        background: #dcece3;
      }

      &[data-status="completed"] > span {
        border-color: #3f715d;
        background: #6fa389;
        color: white;
      }

      &[data-status="failed"] > span {
        border-color: #8d514d;
        background: #d5685e;
        color: white;
      }
    }
  `,
  WorkflowStepJump: styled.button`
    position: absolute;
    z-index: 2;
    inset: 0;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;

    &:focus-visible {
      outline: 2px dashed #426e60;
      outline-offset: 3px;
    }
  `,
  WorkflowResults: styled.div`
    display: grid;
    gap: 18px;
  `,
  WorkflowFinalResult: styled.section`
    padding: 15px;
    border: 2px solid #8eaa9b;
    background: #f6faf7;
  `,
  WorkflowResultLabel: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #cddbd3;

    strong {
      color: #3e6657;
      font-size: 12px;
    }

    span {
      color: ${({ theme }) => theme.colors.muted};
      font-size: 9px;
      font-weight: 800;
    }
  `,
  WorkflowStepResults: styled.section`
    display: grid;
    gap: 8px;
    padding-top: 15px;
    border-top: 2px dashed #d6c9b7;
  `,
  WorkflowStepResultsHeading: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 2px;

    strong {
      color: #3e6657;
      font-size: 12px;
    }

    span {
      color: ${({ theme }) => theme.colors.muted};
      font-size: 9px;
      font-weight: 800;
    }
  `,
  WorkflowResultStep: styled.details`
    scroll-margin-top: 24px;
    border: 1px solid #d4c8b9;
    background: #fbf7f0;

    summary {
      min-width: 0;
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr) auto;
      align-items: center;
      gap: 9px;
      padding: 10px;
      cursor: pointer;
      list-style: none;

      &::-webkit-details-marker {
        display: none;
      }

      > span {
        width: 25px;
        height: 25px;
        display: grid;
        place-items: center;
        background: #6f9a87;
        color: white;
        font: 800 9px monospace;
      }

      > div {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      strong,
      small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      strong {
        color: #4e4842;
        font-size: 11px;
      }

      small {
        color: ${({ theme }) => theme.colors.muted};
        font-size: 8px;
      }

      b {
        color: #557d6d;
        font-size: 0;

        &::after {
          content: "결과 보기";
          font-size: 9px;
        }
      }
    }

    &[open] summary {
      border-bottom: 1px solid #d8cdbf;
      background: #f3ede3;

      b::after {
        content: "결과 닫기";
      }
    }
  `,
  WorkflowResultBody: styled.div`
    padding: 4px 13px 13px;
  `,
  AssignmentPanel: styled.div`
    margin-bottom: 14px;
    padding: 12px;
    border: 2px solid #8eaa9b;
    background: #f3f8f4;
    display: grid;
    gap: 7px;

    strong {
      color: #355e50;
      font-size: 12px;
    }

    span {
      color: #6f7e77;
      font-size: 9px;
      line-height: 1.5;
    }
  `,
  AssignmentLink: styled(Button).attrs({ $variant: "secondary" as const })`
    display: inline-block;
    width: fit-content;
    font-size: 10px;
  `,
  DetailAgent: styled.div`
    display: flex;
    gap: 13px;
    align-items: center;
    padding-bottom: 16px;
    border-bottom: 2px solid #e6dbcb;

    div {
      display: grid;
      gap: 4px;
    }

    span {
      color: ${({ theme }) => theme.colors.muted};
      font-size: 11px;
    }

    small {
      font: 800 9px monospace;
      color: #4c7b6b;
    }
  `,
  AgentSkillList: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 3px;

    span {
      padding: 3px 5px;
      border: 1px solid #91ad9f;
      background: #e2eee7;
      color: #396655;
      font-size: 8px;
      font-weight: 800;
    }
  `,
  ExecutionContext: styled.section`
    display: grid;
    gap: 8px;
    margin: 16px 0;
    padding: 12px;
    border: 1px solid #b9c9c0;
    background: #f5f9f6;

    > small,
    > p {
      margin: 0;
      color: #78847e;
      font-size: 8px;
      line-height: 1.5;
    }
  `,
  ExecutionContextHeading: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;

    strong {
      color: #3f6254;
      font-size: 11px;
    }

    span {
      color: #789187;
      font: 800 8px monospace;
    }
  `,
  ExecutionContextError: styled.small`
    color: #9a4f49;
  `,
  ExecutionContextItem: styled.details`
    border: 1px solid #c9d5ce;
    background: #fffdfa;

    > summary {
      display: grid;
      grid-template-columns: 22px minmax(0, 1fr);
      gap: 7px;
      align-items: center;
      padding: 8px;
      cursor: pointer;
      list-style: none;

      &::-webkit-details-marker {
        display: none;
      }

      > span {
        width: 20px;
        height: 20px;
        display: grid;
        place-items: center;
        background: #dfeae4;
        color: #416454;
        font: 800 8px monospace;
      }

      > div {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }

      strong {
        font-size: 9px;
      }

      small {
        color: #4f7666;
        font: 800 8px monospace;
      }
    }
  `,
  ExecutionContextBody: styled.div`
    display: grid;
    gap: 9px;
    padding: 9px;
    border-top: 1px solid #d8e0dc;

    > code {
      overflow: hidden;
      color: #6b756f;
      font-size: 8px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `,
  ExecutionContextGroup: styled.div`
    display: grid;
    gap: 4px;

    > b {
      color: #68766f;
      font-size: 8px;
    }

    > div {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    span {
      padding: 3px 5px;
      border: 1px solid #adc1b7;
      background: #e8f1ec;
      color: #416656;
      font-size: 8px;
      font-weight: 800;
    }

    small {
      color: #8b918d;
      font-size: 8px;
    }
  `,
  PermissionWarning: styled.div`
    margin: 14px 0;
    padding: 12px;
    border: 2px solid #d18a62;
    background: #fff0dc;
    display: grid;
    gap: 8px;

    strong {
      color: #8c4d36;
      font-size: 12px;
    }

    span {
      color: #765e51;
      font-size: 10px;
      line-height: 1.5;
    }
  `,
  RuntimeApproval: styled.div`
    margin: 14px 0;
    padding: 13px;
    border: 3px solid #6d5a91;
    background: #eee8fa;
    box-shadow: 3px 3px 0 #b8a9ce;
    display: grid;
    gap: 8px;

    > strong {
      color: #55436f;
      font-size: 13px;
    }

    p {
      margin: 0;
      color: #6e6278;
      font-size: 10px;
      line-height: 1.5;
    }

    pre {
      max-height: 150px;
      margin: 0;
      padding: 9px;
      overflow: auto;
      border: 1px solid #b9aacb;
      background: #292531;
      color: #f3ebff;
      font: 9px/1.5 monospace;
      white-space: pre-wrap;
      word-break: break-all;
    }

    > div {
      display: flex;
      gap: 8px;
    }
  `,
  TaskMeta: styled.aside`
    padding: 21px;

    > h2 {
      font-size: 14px;
      margin: 0 0 13px;
    }

    dl {
      margin: 16px 0;
      display: grid;
      gap: 9px;

      div {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
      }

      dt {
        color: ${({ theme }) => theme.colors.muted};
      }

      dd {
        margin: 0;
        font-weight: 800;
        text-align: right;
      }
    }
  `,
  TaskDangerZone: styled.div`
    margin-top: 17px;
    padding-top: 14px;
    border-top: 2px dashed #dfc5c1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 11px;
    align-items: center;

    > div {
      min-width: 0;
      display: grid;
      gap: 3px;
    }

    strong {
      color: #884640;
      font-size: 11px;
    }

    span {
      color: #8d7b75;
      font-size: 8px;
      line-height: 1.4;
    }

    @media (max-width: 760px) {
      grid-template-columns: 1fr;
    }
  `,
  TaskRemoveButton: styled(Button).attrs({ $variant: "danger" as const })`
    padding: 8px 11px;
    font-size: 10px;
    white-space: nowrap;

    @media (max-width: 760px) {
      width: 100%;
    }
  `,
  RunHistory: styled.section`
    padding: 21px;
    margin-top: 0;
  `,
  RunRow,
  RunDot,
  RunExpandIcon,
  RunEntry,
  RunEntryBody: styled.div<{ $failed: boolean }>`
    display: grid;
    gap: 11px;
    padding: 2px 12px 13px 20px;
    background: ${({ $failed }) => ($failed ? "#fff9f5" : "#fafbf8")};

    section {
      display: grid;
      gap: 6px;

      > strong {
        color: #4e6f60;
        font-size: 10px;
      }
    }

    dl {
      display: grid;
      gap: 3px;
      margin: 0;

      div {
        min-width: 0;
        display: grid;
        grid-template-columns: 65px minmax(0, 1fr);
        gap: 8px;
        font-size: 8px;
      }

      dt {
        color: ${({ theme }) => theme.colors.muted};
      }

      dd {
        margin: 0;
        overflow-wrap: anywhere;
        font-family: monospace;
      }
    }

    > small {
      color: #615850;
    }
  `,
  RunRequestSnapshot: styled.section`
    p {
      margin: 0;
      color: #655d56;
      font-size: 10px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
  `,
  RunResultSnapshot: styled.section`
    padding: 10px;
    border: 1px solid #d3ded7;
    background: #fff;
  `,
  RunErrorSnapshot: styled.section`
    > strong {
      color: #914943;
    }

    pre {
      max-height: 220px;
      margin: 0;
      padding: 10px;
      overflow: auto;
      border: 1px solid #dfb1aa;
      background: #402f2e;
      color: #ffe9e3;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: 10px/1.55 monospace;
    }
  `,
  RunEntryEvents: styled.div`
    max-height: 180px;
    overflow: auto;
    border: 1px solid #ead2cc;
    background: #fffdf9;

    > div {
      display: grid;
      grid-template-columns: 70px minmax(0, 1fr);
      gap: 8px;
      padding: 6px 8px;
      border-bottom: 1px solid #eee2d9;
      font-size: 9px;
      line-height: 1.45;

      &:last-child {
        border-bottom: 0;
      }
    }

    time {
      color: ${({ theme }) => theme.colors.muted};
    }

    span {
      overflow-wrap: anywhere;
      color: #665c54;
    }
  `,
};

export function TaskDetailPage({ workspace }: { workspace: Workspace }) {
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { confirm, dialogProps } = useConfirmDialog();
  const task = useQuery({
    queryKey: ["task", id],
    queryFn: () => taskApi.get(id),
    refetchInterval: (query) =>
      ["working", "needs_input"].includes(query.state.data?.status ?? "") ? 1500 : false,
  });
  const executionContexts = useQuery({
    queryKey: ["task-execution-context", id],
    queryFn: () => taskApi.executionContexts(id),
  });
  const agents = useQuery({
    queryKey: ["agents", workspace.id],
    queryFn: () => agentApi.list(workspace.id),
  });
  const skills = useQuery({
    queryKey: ["skills", workspace.id],
    queryFn: () => skillApi.list(workspace.id),
  });
  const activities = useQuery({
    queryKey: ["activities", workspace.id],
    queryFn: () => activityApi.list(workspace.id),
  });
  const workflowPresets = useQuery({
    queryKey: ["workflow-presets", workspace.id],
    queryFn: () => workflowApi.listPresets(workspace.id),
  });
  const [feedback, setFeedback] = useState("");
  const [taskBrief, setTaskBrief] = useState("");
  useEffect(() => {
    if (task.data?.status === "todo") setTaskBrief(task.data.description ?? "");
  }, [task.data?.description, task.data?.id, task.data?.status]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["task", id] });
    void queryClient.invalidateQueries({ queryKey: ["task-execution-context", id] });
    void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
  };
  const run = useMutation({
    mutationFn: async () => {
      const description = taskBrief.trim();
      if (description !== (task.data?.description ?? "").trim()) {
        await taskApi.update(id, { description });
      }
      return taskApi.run(id);
    },
    onSuccess: refresh,
  });
  const retry = useMutation({ mutationFn: () => taskApi.retry(id), onSuccess: refresh });
  const continueSession = useMutation({
    mutationFn: () => taskApi.continue(id),
    onSuccess: refresh,
  });
  const extendSession = useMutation({
    mutationFn: () => taskApi.extendSession(id),
    onSuccess: refresh,
  });
  const approve = useMutation({ mutationFn: () => taskApi.approve(id), onSuccess: refresh });
  const changes = useMutation({
    mutationFn: () => taskApi.requestChanges(id, feedback),
    onSuccess: () => {
      setFeedback("");
      refresh();
    },
  });
  const cancel = useMutation({
    mutationFn: (runId: string) => taskApi.cancelRun(runId),
    onSuccess: refresh,
  });
  const resolveApproval = useMutation({
    mutationFn: ({
      runId,
      requestId,
      decision,
    }: {
      runId: string;
      requestId: string;
      decision: "accept" | "cancel";
    }) => taskApi.resolveApproval(runId, requestId, decision),
    onSuccess: refresh,
  });
  const updateAssignment = useMutation({
    mutationFn: (assigneeAgentId: string) => taskApi.update(id, { assigneeAgentId }),
    onSuccess: refresh,
  });
  const updateBrief = useMutation({
    mutationFn: () => taskApi.update(id, { description: taskBrief.trim() }),
    onSuccess: refresh,
  });
  const updateWorkingDirectory = useMutation({
    mutationFn: (workingDirectory: string) => taskApi.update(id, { workingDirectory }),
    onSuccess: refresh,
  });
  const updateProject = useMutation({
    mutationFn: (projectId: string) => taskApi.update(id, { projectId }),
    onSuccess: refresh,
  });
  const updateWorkflow = useMutation({
    mutationFn: (agentIds: string[]) => workflowApi.setTaskWorkflow(id, agentIds),
    onSuccess: refresh,
  });
  const createWorkflowPreset = useMutation({
    mutationFn: ({ name, agentIds }: { name: string; agentIds: string[] }) =>
      workflowApi.createPreset({ workspaceId: workspace.id, name, agentIds }),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["workflow-presets", workspace.id] }),
  });
  const deleteWorkflowPreset = useMutation({
    mutationFn: (presetId: string) => workflowApi.deletePreset(presetId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["workflow-presets", workspace.id] }),
  });
  const remove = useMutation({
    mutationFn: () => taskApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks", workspace.id] });
      navigate("/");
    },
  });
  const item = task.data;
  const agent = agents.data?.find((entry) => entry.id === item?.assigneeAgentId);
  const missingRuntimePermissions = Boolean(
    agent &&
    (agent.mode === "chat" ||
      agent.permissions.fileRead !== true ||
      agent.permissions.terminal !== true),
  );
  const agentSkills = (skills.data ?? []).filter((skill) => agent?.skillIds.includes(skill.id));
  const repairPermissions = useMutation({
    mutationFn: () =>
      agentApi.update(agent!.id, {
        mode: "worker",
        permissions: {
          ...agent!.permissions,
          fileRead: true,
          fileWrite: true,
          terminal: true,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents", workspace.id] });
      void queryClient.invalidateQueries({ queryKey: ["agent", agent?.id] });
    },
  });
  const latestRun = item?.runs[0];
  const runActivities = (activities.data ?? []).filter(
    (activity) => activity.runId === latestRun?.id,
  );
  const pendingApproval =
    latestRun?.status === "waiting"
      ? runActivities.find((activity) => {
          if (activity.type !== "approval_requested") return false;
          const requestId = String(activity.metadata?.requestId ?? "");
          return !runActivities.some(
            (candidate) =>
              candidate.type === "approval_resolved" &&
              String(candidate.metadata?.requestId ?? "") === requestId &&
              candidate.createdAt > activity.createdAt,
          );
        })
      : undefined;
  const actionError =
    run.error ??
    retry.error ??
    extendSession.error ??
    continueSession.error ??
    approve.error ??
    changes.error ??
    cancel.error ??
    resolveApproval.error ??
    repairPermissions.error ??
    updateBrief.error ??
    updateAssignment.error ??
    updateProject.error ??
    updateWorkflow.error ??
    createWorkflowPreset.error ??
    deleteWorkflowPreset.error ??
    updateWorkingDirectory.error ??
    remove.error;
  if (task.isPending) return <FullScreenMessage>작업을 불러오는 중...</FullScreenMessage>;
  if (!item || task.isError)
    return <FullScreenMessage error>{messageOf(task.error)}</FullScreenMessage>;
  const sessionLimitReason = sessionLimitFrom(latestRun?.error);
  const active = ["working", "needs_input"].includes(item.status);
  return (
    <BaseLayout>
      <button className="back-button" onClick={() => navigate(-1)}>
        ← 작업 목록
      </button>
      <Styled.Heading>
        <Styled.StatusPill $status={item.status}>{STATUS[item.status].label}</Styled.StatusPill>
        <h1>{item.title}</h1>
        <p>
          {item.status === "todo"
            ? "담당자와 요청 내용을 확인한 뒤 작업을 시작하세요."
            : item.description || "추가 설명이 없습니다."}
        </p>
      </Styled.Heading>
      <Styled.DetailLayout>
        <Styled.DetailMain>
          <Styled.ResultPanel className="panel">
            <div className="section-heading compact">
              <h2>
                {item.status === "todo"
                  ? "작업 요청"
                  : item.workflow.length > 0
                    ? "협업 결과"
                    : "작업 결과"}
              </h2>
              <span>
                {item.status === "todo"
                  ? "BEFORE START"
                  : item.workflow.length > 0
                    ? `${item.workflow.filter((step) => step.result).length}/${item.workflow.length} STEPS`
                    : item.result
                      ? "RESULT"
                      : "WAITING"}
              </span>
            </div>
            {active && latestRun?.request && <CurrentRunRequest request={latestRun.request} />}
            {item.status === "todo" ? (
              <Styled.TaskBriefEditor>
                <label htmlFor="task-brief">에이전트에게 전달할 내용</label>
                <p>
                  배경, 원하는 결과, 지켜야 할 조건을 적어 주세요. 제목과 함께 첫 요청으로
                  전달됩니다.
                </p>
                <textarea
                  id="task-brief"
                  value={taskBrief}
                  onChange={(event) => setTaskBrief(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      (event.ctrlKey || event.metaKey) &&
                      event.key === "Enter" &&
                      !event.nativeEvent.isComposing &&
                      !updateBrief.isPending &&
                      taskBrief.trim() !== (item.description ?? "").trim()
                    ) {
                      event.preventDefault();
                      updateBrief.mutate();
                    }
                  }}
                  placeholder="예: 현재 UI 구조를 먼저 확인하고, 기존 컴포넌트 스타일을 유지하면서 개선해 주세요."
                  rows={8}
                />
                <Styled.TaskBriefActions>
                  <small>
                    {taskBrief.trim() === (item.description ?? "").trim()
                      ? "저장된 내용입니다."
                      : "작업 시작 시 변경 내용도 함께 저장됩니다."}
                  </small>
                  <Button
                    type="button"
                    $variant="secondary"
                    disabled={
                      updateBrief.isPending || taskBrief.trim() === (item.description ?? "").trim()
                    }
                    onClick={() => updateBrief.mutate()}
                  >
                    {updateBrief.isPending ? "저장 중…" : "요청 저장"}
                  </Button>
                </Styled.TaskBriefActions>
              </Styled.TaskBriefEditor>
            ) : sessionLimitReason ? (
              <SessionLimitState
                reason={sessionLimitReason}
                canExtend={Boolean(latestRun?.runtimeThreadId)}
                extendPending={extendSession.isPending}
                newSessionPending={continueSession.isPending}
                onExtend={() => extendSession.mutate()}
                onNewSession={() => continueSession.mutate()}
              />
            ) : item.workflow.length > 0 ? (
              <WorkflowResults task={item} agents={agents.data ?? []} error={latestRun?.error} />
            ) : active ? (
              <>
                <WorkInProgress waiting={item.status === "needs_input"} />
                <RunProgress events={item.progress} />
                {item.result && <PreviousResult result={item.result} />}
              </>
            ) : item.result ? (
              <TaskResultView result={item.result} />
            ) : item.status === "failed" ? (
              <FailureState error={latestRun?.error} />
            ) : (
              <Empty>작업을 시작하면 여기에 결과가 나타납니다.</Empty>
            )}
            {item.status === "needs_review" && (
              <Styled.ReviewBox>
                <Styled.ReviewCopy>
                  <strong>이어서 요청할 내용이 있나요?</strong>
                  <p>같은 작업 흐름에서 추가 요청을 바로 전달할 수 있어요.</p>
                </Styled.ReviewCopy>
                <Styled.ReviewFollowup
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (feedback.trim() && !changes.isPending) changes.mutate();
                  }}
                >
                  <input
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="추가로 요청할 내용을 입력하세요."
                  />
                  <Button
                    type="submit"
                    $variant="primary"
                    disabled={!feedback.trim() || changes.isPending}
                  >
                    이어서 요청
                  </Button>
                </Styled.ReviewFollowup>
                <Styled.ReviewFinish>
                  <span>결과가 충분하다면 이 작업을 마무리하세요.</span>
                  <Button
                    $variant="secondary"
                    onClick={() => approve.mutate()}
                    disabled={approve.isPending}
                  >
                    세션 종료
                  </Button>
                </Styled.ReviewFinish>
              </Styled.ReviewBox>
            )}
            {actionError && <ErrorBanner>{messageOf(actionError)}</ErrorBanner>}
          </Styled.ResultPanel>
          <RunHistory runs={item.runs} progressByRun={item.progressByRun} />
        </Styled.DetailMain>
        <Styled.TaskMeta className="panel">
          <WorkflowPanel
            task={item}
            agents={agents.data ?? []}
            saving={updateWorkflow.isPending}
            onSave={(agentIds) => updateWorkflow.mutate(agentIds)}
            presets={workflowPresets.data ?? []}
            presetSaving={createWorkflowPreset.isPending || deleteWorkflowPreset.isPending}
            onCreatePreset={(name, agentIds) => createWorkflowPreset.mutate({ name, agentIds })}
            onDeletePreset={async (preset) => {
              if (
                await confirm({
                  title: "협업 그룹을 삭제할까요?",
                  description: `'${preset.name}' 그룹만 삭제되며 Task에 이미 설정된 순서는 유지됩니다.`,
                  confirmLabel: "그룹 삭제",
                  tone: "danger",
                })
              ) {
                deleteWorkflowPreset.mutate(preset.id);
              }
            }}
            singleAssignment={
              item.status === "todo" ? (
                <Styled.AssignmentPanel>
                  <strong>
                    {agent ? "담당자를 변경할 수 있어요" : "먼저 담당자를 배치해 주세요"}
                  </strong>
                  <span>
                    {agent
                      ? "작업을 시작하기 전까지 변경할 수 있습니다."
                      : "작업에 맞는 에이전트를 선택하면 시작할 수 있습니다."}
                  </span>
                  {(agents.data?.length ?? 0) > 0 ? (
                    <select
                      value={item.assigneeAgentId ?? ""}
                      disabled={updateAssignment.isPending}
                      onChange={(event) => updateAssignment.mutate(event.target.value)}
                    >
                      <option value="">아직 정하지 않음</option>
                      {(agents.data ?? []).map((candidate) => (
                        <option value={candidate.id} key={candidate.id}>
                          {candidate.name} · {candidate.model.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Styled.AssignmentLink as={Link} to="/agents">
                      첫 에이전트 만들기
                    </Styled.AssignmentLink>
                  )}
                </Styled.AssignmentPanel>
              ) : null
            }
          />
          <h2>현재 담당 에이전트</h2>
          {agent ? (
            <Styled.DetailAgent>
              <PetPreview petId={agent.avatarId ?? ""} size={88} />
              <div>
                <strong>{agent.name}</strong>
                <span>{agent.role}</span>
                <small>{agent.model.toUpperCase()}</small>
                <Styled.AgentSkillList>
                  {agentSkills.map((skill) => (
                    <span key={skill.id}>{skill.name}</span>
                  ))}
                  {agentSkills.length === 0 && (
                    <span>{agent.mode === "worker" ? "기본 업무" : "업무 전환 필요"}</span>
                  )}
                </Styled.AgentSkillList>
              </div>
            </Styled.DetailAgent>
          ) : (
            <Empty>담당자가 없습니다.</Empty>
          )}
          <ExecutionContextPanel
            contexts={executionContexts.data ?? []}
            agents={agents.data ?? []}
            skills={skills.data ?? []}
            loading={executionContexts.isPending}
            error={executionContexts.isError ? messageOf(executionContexts.error) : undefined}
          />
          {missingRuntimePermissions && (
            <Styled.PermissionWarning>
              <strong>{agent?.model.toUpperCase()} 실행 권한이 부족합니다.</strong>
              <span>프로젝트 작업을 위해 파일 읽기·수정과 터미널 사용을 허용해 주세요.</span>
              <Button
                $variant="secondary"
                $fullWidth
                onClick={() => repairPermissions.mutate()}
                disabled={repairPermissions.isPending}
              >
                기본 업무 모드로 전환
              </Button>
            </Styled.PermissionWarning>
          )}
          {pendingApproval && (
            <RuntimeApproval
              activity={pendingApproval}
              pending={resolveApproval.isPending}
              onDecision={(decision) =>
                resolveApproval.mutate({
                  runId: latestRun!.id,
                  requestId: String(pendingApproval.metadata?.requestId),
                  decision,
                })
              }
            />
          )}
          <dl>
            <div>
              <dt>우선순위</dt>
              <dd>{item.priority ?? "medium"}</dd>
            </div>
            <div>
              <dt>생성</dt>
              <dd>{new Date(item.createdAt).toLocaleString("ko-KR")}</dd>
            </div>
            <div>
              <dt>최근 실행</dt>
              <dd>{latestRun?.status ?? "없음"}</dd>
            </div>
          </dl>
          {item.status === "todo" && (
            <ProjectSelect
              workspaceId={workspace.id}
              value={item.projectId ?? ""}
              onChange={(value) => updateProject.mutate(value)}
            />
          )}
          <details className="technical-details">
            <summary>개발자 옵션</summary>
            <ProjectDirectorySelect
              workspaceId={workspace.id}
              value={item.workingDirectory ?? ""}
              onChange={(value) => updateWorkingDirectory.mutate(value)}
              label="실행 폴더 덮어쓰기"
              emptyLabel="프로젝트/에이전트 기본값"
            />
            {latestRun?.usage && (
              <dl>
                <div>
                  <dt>입력 토큰</dt>
                  <dd>{latestRun.usage.inputTokens?.toLocaleString() ?? "-"}</dd>
                </div>
                <div>
                  <dt>출력 토큰</dt>
                  <dd>{latestRun.usage.outputTokens?.toLocaleString() ?? "-"}</dd>
                </div>
              </dl>
            )}
          </details>
          {item.status === "todo" && (
            <Button
              $variant="primary"
              $fullWidth
              disabled={!agent || missingRuntimePermissions || run.isPending}
              onClick={() => run.mutate()}
            >
              ▶ 작업 시작
            </Button>
          )}
          {item.status === "failed" && (
            <Button
              $variant="primary"
              $fullWidth
              disabled={!agent || missingRuntimePermissions || retry.isPending}
              onClick={() => retry.mutate()}
            >
              ↻ 실패한 작업 다시 실행
            </Button>
          )}
          {latestRun && ["queued", "running", "waiting"].includes(latestRun.status) && (
            <Button $variant="danger" $fullWidth onClick={() => cancel.mutate(latestRun.id)}>
              실행 취소
            </Button>
          )}
          <Styled.TaskDangerZone>
            <div>
              <strong>이 할 일 삭제</strong>
              <span>실행 기록과 결과도 함께 삭제됩니다.</span>
            </div>
            <Styled.TaskRemoveButton
              type="button"
              disabled={
                remove.isPending ||
                Boolean(latestRun && ["queued", "running", "waiting"].includes(latestRun.status))
              }
              onClick={async () => {
                if (
                  await confirm({
                    title: "할 일을 삭제할까요?",
                    description: `'${item.title}'의 실행 기록과 결과도 함께 삭제됩니다.`,
                    confirmLabel: "할 일 삭제",
                    tone: "danger",
                  })
                )
                  remove.mutate();
              }}
            >
              {remove.isPending ? "삭제 중…" : "할 일 삭제"}
            </Styled.TaskRemoveButton>
          </Styled.TaskDangerZone>
        </Styled.TaskMeta>
      </Styled.DetailLayout>
      <ConfirmDialog {...dialogProps} />
    </BaseLayout>
  );
}

function WorkflowPanel({
  task,
  agents,
  saving,
  onSave,
  presets,
  presetSaving,
  onCreatePreset,
  onDeletePreset,
  singleAssignment,
}: {
  task: TaskDetail;
  agents: Agent[];
  saving: boolean;
  onSave: (agentIds: string[]) => void;
  presets: WorkflowPreset[];
  presetSaving: boolean;
  onCreatePreset: (name: string, agentIds: string[]) => void;
  onDeletePreset: (preset: WorkflowPreset) => void;
  singleAssignment: ReactNode;
}) {
  const [agentIds, setAgentIds] = useState(() => task.workflow.map((step) => step.agentId));
  const [editing, setEditing] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const editable = task.status === "todo" && task.runs.length === 0;
  useEffect(() => {
    setAgentIds(task.workflow.map((step) => step.agentId));
    setEditing(false);
  }, [task.workflow]);
  const startConfiguring = () => {
    const first = task.assigneeAgentId ?? agents[0]?.id;
    const second = agents.find((agent) => agent.id !== first)?.id;
    setAgentIds([first, second].filter((id): id is string => Boolean(id)));
    setEditing(true);
  };
  const updateAgent = (position: number, agentId: string) => {
    setSelectedPresetId("");
    setAgentIds((current) => current.map((id, index) => (index === position ? agentId : id)));
  };
  const move = (position: number, direction: -1 | 1) => {
    setSelectedPresetId("");
    setAgentIds((current) => {
      const target = position + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[position], next[target]] = [next[target]!, next[position]!];
      return next;
    });
  };
  const hasDuplicates = new Set(agentIds).size !== agentIds.length;
  const sequential = task.workflow.length > 0 || editing;
  const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);
  const cancelEditing = () => {
    setAgentIds(task.workflow.map((step) => step.agentId));
    setEditing(false);
  };
  const chooseSingle = () => {
    if (task.workflow.length > 0) onSave([]);
    else cancelEditing();
  };

  return (
    <Styled.WorkflowPanel>
      <div className="section-heading compact">
        <h2>담당 방식</h2>
      </div>
      {editable && (
        <Styled.AssignmentModeSwitch aria-label="담당 방식 선택">
          <button
            type="button"
            className={!sequential ? "selected" : ""}
            onClick={chooseSingle}
            disabled={saving}
          >
            한 명에게 맡기기
          </button>
          <button
            type="button"
            className={sequential ? "selected" : ""}
            onClick={() => {
              if (!sequential) startConfiguring();
              else if (task.workflow.length > 0) setEditing(true);
            }}
            disabled={agents.length < 2 || saving}
          >
            순차 협업
          </button>
        </Styled.AssignmentModeSwitch>
      )}
      {!sequential ? (
        (singleAssignment ?? (
          <Styled.WorkflowEmpty>한 명이 이 작업을 담당합니다.</Styled.WorkflowEmpty>
        ))
      ) : task.workflow.length > 0 && !editable ? (
        <Styled.WorkflowProgressList>
          {task.workflow.map((step) => (
            <WorkflowProgressStep
              key={step.id}
              step={step}
              agent={agents.find((a) => a.id === step.agentId)}
            />
          ))}
        </Styled.WorkflowProgressList>
      ) : editing ? (
        <Styled.WorkflowEditor>
          <Styled.WorkflowPresetPicker>
            <label htmlFor="workflow-preset">저장된 협업 그룹</label>
            <div>
              <select
                id="workflow-preset"
                value={selectedPresetId}
                onChange={(event) => {
                  const preset = presets.find((entry) => entry.id === event.target.value);
                  setSelectedPresetId(event.target.value);
                  if (preset) setAgentIds(preset.agentIds);
                }}
              >
                <option value="">직접 순서 구성</option>
                {presets.map((preset) => (
                  <option
                    key={preset.id}
                    value={preset.id}
                    disabled={preset.agentIds.some(
                      (id) => !agents.some((agent) => agent.id === id),
                    )}
                  >
                    {preset.name} · {preset.agentIds.length}명
                  </option>
                ))}
              </select>
              <Styled.WorkflowPresetDelete
                type="button"
                disabled={!selectedPreset || presetSaving}
                onClick={() => selectedPreset && onDeletePreset(selectedPreset)}
                aria-label="선택한 협업 그룹 삭제"
              >
                삭제
              </Styled.WorkflowPresetDelete>
            </div>
          </Styled.WorkflowPresetPicker>
          {agentIds.map((agentId, position) => (
            <Styled.WorkflowEditorStep key={`${position}-${agentId}`}>
              <Styled.WorkflowStepMain>
                <span>{position + 1}</span>
                <select
                  value={agentId}
                  onChange={(event) => updateAgent(position, event.target.value)}
                >
                  {agents.map((agent) => (
                    <option value={agent.id} key={agent.id}>
                      {agent.name} · {agent.role}
                    </option>
                  ))}
                </select>
              </Styled.WorkflowStepMain>
              <Styled.WorkflowStepControls>
                <span>
                  {position === agentIds.length - 1 ? "최종 단계" : "완료 후 다음 단계로 전달"}
                </span>
                <button
                  type="button"
                  onClick={() => move(position, -1)}
                  disabled={position === 0}
                  aria-label="앞 단계로 이동"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(position, 1)}
                  disabled={position === agentIds.length - 1}
                  aria-label="뒤 단계로 이동"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPresetId("");
                    setAgentIds((current) => current.filter((_, index) => index !== position));
                  }}
                  disabled={agentIds.length <= 2}
                  title={agentIds.length <= 2 ? "순차 협업에는 최소 2명이 필요합니다." : undefined}
                  aria-label="단계 삭제"
                >
                  ×
                </button>
              </Styled.WorkflowStepControls>
            </Styled.WorkflowEditorStep>
          ))}
          <Styled.WorkflowAddStep
            type="button"
            disabled={agentIds.length >= Math.min(8, agents.length)}
            onClick={() => {
              const next = agents.find((agent) => !agentIds.includes(agent.id));
              if (next) {
                setSelectedPresetId("");
                setAgentIds((current) => [...current, next.id]);
              }
            }}
          >
            + 다음 단계 추가
          </Styled.WorkflowAddStep>
          <Styled.WorkflowPresetSave
            onSubmit={(event) => {
              event.preventDefault();
              if (presetName.trim() && agentIds.length >= 2 && !hasDuplicates && !presetSaving) {
                onCreatePreset(presetName, agentIds);
                setPresetName("");
              }
            }}
          >
            <input
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="이 순서의 그룹 이름"
              aria-label="협업 그룹 이름"
            />
            <Button
              type="submit"
              $variant="secondary"
              disabled={!presetName.trim() || agentIds.length < 2 || hasDuplicates || presetSaving}
            >
              그룹 저장
            </Button>
          </Styled.WorkflowPresetSave>
          <Styled.WorkflowEditorActions>
            <Button type="button" $variant="secondary" onClick={cancelEditing}>
              편집 취소
            </Button>
            <Button
              type="button"
              $variant="primary"
              disabled={saving || agentIds.length < 2 || hasDuplicates}
              onClick={() => onSave(agentIds)}
            >
              순서 저장
            </Button>
          </Styled.WorkflowEditorActions>
          {hasDuplicates && (
            <Styled.WorkflowMessage>
              같은 에이전트를 중복 배치할 수 없습니다.
            </Styled.WorkflowMessage>
          )}
        </Styled.WorkflowEditor>
      ) : task.workflow.length > 0 ? (
        <Styled.WorkflowSummary>
          <ol>
            {task.workflow.map((step) => (
              <li key={step.id}>
                <span>{step.position + 1}</span>
                <strong>
                  {agents.find((agent) => agent.id === step.agentId)?.name ?? "삭제된 에이전트"}
                </strong>
              </li>
            ))}
          </ol>
          <Button type="button" $variant="secondary" $fullWidth onClick={() => setEditing(true)}>
            협업 순서 편집
          </Button>
        </Styled.WorkflowSummary>
      ) : (
        <Styled.WorkflowEmpty>
          {agents.length < 2
            ? "순차 협업에는 에이전트가 2명 이상 필요합니다."
            : "이 작업은 단일 에이전트로 진행됩니다."}
        </Styled.WorkflowEmpty>
      )}
    </Styled.WorkflowPanel>
  );
}

function CurrentRunRequest({ request }: { request: string }) {
  return (
    <Styled.CurrentRunRequest>
      <span>현재 요청</span>
      <p>{request}</p>
    </Styled.CurrentRunRequest>
  );
}

function PreviousResult({ result }: { result: NonNullable<TaskDetail["result"]> }) {
  return (
    <Styled.PreviousResult>
      <summary>이전 결과 보기</summary>
      <div>
        <TaskResultView result={result} />
      </div>
    </Styled.PreviousResult>
  );
}

function ExecutionContextPanel({
  contexts,
  agents,
  skills,
  loading,
  error,
}: {
  contexts: TaskExecutionContext[];
  agents: Agent[];
  skills: Skill[];
  loading: boolean;
  error?: string;
}) {
  return (
    <Styled.ExecutionContext>
      <Styled.ExecutionContextHeading>
        <strong>실행 컨텍스트</strong>
        <span>PROJECT</span>
      </Styled.ExecutionContextHeading>
      {loading ? (
        <small>프로젝트 지침을 확인하는 중입니다.</small>
      ) : error ? (
        <Styled.ExecutionContextError>{error}</Styled.ExecutionContextError>
      ) : contexts.length === 0 ? (
        <small>담당자를 정하면 실행 컨텍스트를 확인할 수 있습니다.</small>
      ) : (
        contexts.map((context) => {
          const contextAgent = agents.find((candidate) => candidate.id === context.agentId);
          const mappedSkills = skills.filter((skill) => contextAgent?.skillIds.includes(skill.id));
          return (
            <Styled.ExecutionContextItem
              key={context.workflowStepId ?? context.agentId}
              open={contexts.length === 1}
            >
              <summary>
                <span>{context.position === undefined ? "1" : context.position + 1}</span>
                <div>
                  <strong>{context.agentName}</strong>
                  <small>{context.runtime.toUpperCase()}</small>
                </div>
              </summary>
              <Styled.ExecutionContextBody>
                <code title={context.workingDirectory}>{context.workingDirectory}</code>
                <ContextGroup label={`${context.runtime.toUpperCase()} 프로젝트 지침`}>
                  {context.instructionFiles.length > 0 ? (
                    context.instructionFiles.map((path) => (
                      <span title={path} key={path}>
                        {fileName(path)} 감지됨
                      </span>
                    ))
                  ) : (
                    <small>설정된 프로젝트 지침이 없습니다.</small>
                  )}
                </ContextGroup>
                <ContextGroup label="프로젝트 스킬">
                  {context.projectSkills.length > 0 ? (
                    context.projectSkills.map((skill) => (
                      <span title={skill.path} key={skill.path}>
                        {skill.name}
                      </span>
                    ))
                  ) : (
                    <small>감지된 프로젝트 스킬이 없습니다.</small>
                  )}
                </ContextGroup>
                <ContextGroup label="동료에게 매핑된 스킬">
                  {mappedSkills.length > 0 ? (
                    mappedSkills.map((skill) => <span key={skill.id}>{skill.name}</span>)
                  ) : (
                    <small>기본 업무 능력으로 실행합니다.</small>
                  )}
                </ContextGroup>
              </Styled.ExecutionContextBody>
            </Styled.ExecutionContextItem>
          );
        })
      )}
      <p>파일 존재 여부만 표시하며, 실제 해석과 적용은 각 런타임이 담당합니다.</p>
    </Styled.ExecutionContext>
  );
}

function ContextGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Styled.ExecutionContextGroup>
      <b>{label}</b>
      <div>{children}</div>
    </Styled.ExecutionContextGroup>
  );
}

function fileName(path: string): string {
  return path.split(/[\\/]/).at(-1) ?? path;
}

function RunHistory({
  runs,
  progressByRun,
}: {
  runs: TaskDetail["runs"];
  progressByRun: TaskDetail["progressByRun"];
}) {
  const statusLabel: Record<TaskDetail["runs"][number]["status"], string> = {
    queued: "대기",
    running: "실행 중",
    waiting: "입력 대기",
    completed: "완료",
    failed: "실패",
    cancelled: "취소",
  };
  return (
    <Styled.RunHistory className="panel">
      <div className="section-heading compact">
        <h2>실행 기록</h2>
        <span>{runs.length}</span>
      </div>
      {runs.map((entry) => {
        const progress = progressByRun[entry.id] ?? [];
        return (
          <Styled.RunEntry $failed={entry.status === "failed"} key={entry.id}>
            <Styled.RunRow>
              <Styled.RunDot $status={entry.status} />
              <strong>{entry.runtime.toUpperCase()}</strong>
              <span>{statusLabel[entry.status]}</span>
              <time>{new Date(entry.createdAt).toLocaleString("ko-KR")}</time>
              <Styled.RunExpandIcon aria-hidden="true">›</Styled.RunExpandIcon>
            </Styled.RunRow>
            <Styled.RunEntryBody $failed={entry.status === "failed"}>
              {entry.request && (
                <Styled.RunRequestSnapshot>
                  <strong>요청</strong>
                  <p>{entry.request}</p>
                </Styled.RunRequestSnapshot>
              )}
              {entry.result && (
                <Styled.RunResultSnapshot>
                  <strong>이 실행의 결과</strong>
                  <TaskResultView result={entry.result} size="small" />
                </Styled.RunResultSnapshot>
              )}
              {entry.status === "failed" && (
                <Styled.RunErrorSnapshot>
                  <strong>실패 로그</strong>
                  <pre>{entry.error || "기록된 오류 메시지가 없습니다."}</pre>
                </Styled.RunErrorSnapshot>
              )}
              {progress.length > 0 && (
                <Styled.RunEntryEvents>
                  {progress.slice(-12).map((event) => (
                    <div key={event.id}>
                      <time>{new Date(event.createdAt).toLocaleTimeString("ko-KR")}</time>
                      <span>{event.message}</span>
                    </div>
                  ))}
                </Styled.RunEntryEvents>
              )}
              <dl>
                {entry.workingDirectory && (
                  <div>
                    <dt>작업 폴더</dt>
                    <dd>{entry.workingDirectory}</dd>
                  </div>
                )}
                <div>
                  <dt>실행 ID</dt>
                  <dd>{entry.id}</dd>
                </div>
                {entry.runtimeThreadId && (
                  <div>
                    <dt>세션 ID</dt>
                    <dd>{entry.runtimeThreadId}</dd>
                  </div>
                )}
                {entry.eventLogRef && (
                  <div>
                    <dt>상세 로그</dt>
                    <dd>{entry.eventLogRef}</dd>
                  </div>
                )}
              </dl>
              {!entry.request &&
                !entry.result &&
                entry.status !== "failed" &&
                progress.length === 0 && (
                  <small>이전 버전에서 생성되어 상세 스냅샷이 없는 실행입니다.</small>
                )}
            </Styled.RunEntryBody>
          </Styled.RunEntry>
        );
      })}
      {runs.length === 0 && <Empty>실행 기록이 없습니다.</Empty>}
    </Styled.RunHistory>
  );
}

function WorkflowResults({
  task,
  agents,
  error,
}: {
  task: TaskDetail;
  agents: Agent[];
  error?: string;
}) {
  const completedSteps = task.workflow.filter((step) => step.result);
  const finalReady = ["needs_review", "done"].includes(task.status) && task.result;
  return (
    <Styled.WorkflowResults>
      {finalReady ? (
        <Styled.WorkflowFinalResult>
          <Styled.WorkflowResultLabel>
            <strong>최종 결과</strong>
            <span>{agents.find((agent) => agent.id === task.workflow.at(-1)?.agentId)?.name}</span>
          </Styled.WorkflowResultLabel>
          <TaskResultView result={task.result!} />
        </Styled.WorkflowFinalResult>
      ) : task.status === "failed" ? (
        <FailureState error={error} />
      ) : (
        <>
          <WorkInProgress waiting={task.status === "needs_input"} />
          <RunProgress events={task.progress} />
        </>
      )}
      <Styled.WorkflowStepResults>
        <Styled.WorkflowStepResultsHeading>
          <strong>단계별 결과</strong>
          <span>
            {completedSteps.length}/{task.workflow.length}
          </span>
        </Styled.WorkflowStepResultsHeading>
        {completedSteps.map((step) => {
          const stepAgent = agents.find((agent) => agent.id === step.agentId);
          return (
            <Styled.WorkflowResultStep key={step.id} id={`workflow-result-${step.id}`}>
              <summary>
                <span>{step.position + 1}</span>
                <div>
                  <strong>{stepAgent?.name ?? "삭제된 에이전트"}</strong>
                  <small>{stepAgent?.role ?? "역할 정보 없음"}</small>
                </div>
                <b>결과 보기</b>
              </summary>
              <Styled.WorkflowResultBody>
                <TaskResultView result={step.result!} size="compact" />
              </Styled.WorkflowResultBody>
            </Styled.WorkflowResultStep>
          );
        })}
        {completedSteps.length === 0 && <Empty>첫 번째 단계 결과를 기다리는 중입니다.</Empty>}
      </Styled.WorkflowStepResults>
    </Styled.WorkflowResults>
  );
}

function TaskResultView({
  result,
  size = "default",
}: {
  result: NonNullable<TaskDetail["result"]>;
  size?: "default" | "compact" | "small";
}) {
  return (
    <>
      <Styled.MarkdownResult $size={size}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{result.summary}</ReactMarkdown>
      </Styled.MarkdownResult>
      {result.artifacts?.map((artifact) => (
        <Styled.Artifact key={artifact.name}>
          <span>▤</span>
          <div>
            <strong>{artifact.name}</strong>
            <small>{artifact.path ?? artifact.url ?? artifact.type}</small>
          </div>
        </Styled.Artifact>
      ))}
    </>
  );
}

function WorkflowProgressStep({ step, agent }: { step: TaskWorkflowStep; agent?: Agent }) {
  const labels: Record<TaskWorkflowStep["status"], string> = {
    pending: "대기",
    working: "작업 중",
    completed: "완료",
    failed: "실패",
  };
  return (
    <li data-status={step.status} className={step.result ? "has-result" : undefined}>
      <span>{step.position + 1}</span>
      <div>
        <strong>{agent?.name ?? "삭제된 에이전트"}</strong>
        <small>{labels[step.status]}</small>
        {step.result && <p>{step.result.summary}</p>}
      </div>
      {step.result && (
        <Styled.WorkflowStepJump
          type="button"
          aria-label={`${step.position + 1}단계 ${agent?.name ?? "에이전트"} 결과로 이동`}
          title="단계 결과 펼쳐보기"
          onClick={() => revealWorkflowResult(step.id)}
        />
      )}
    </li>
  );
}

function revealWorkflowResult(stepId: string): void {
  const result = document.getElementById(`workflow-result-${stepId}`);
  if (!(result instanceof HTMLDetailsElement)) return;
  result.open = true;
  result.scrollIntoView({ behavior: "smooth", block: "start" });
  window.requestAnimationFrame(() => {
    result.querySelector("summary")?.focus({ preventScroll: true });
  });
}

function WorkInProgress({ waiting }: { waiting: boolean }) {
  return (
    <Styled.WorkProgress $waiting={waiting}>
      <Styled.ProgressPixels className="progress-pixels">
        <span />
        <span />
        <span />
        <span />
      </Styled.ProgressPixels>
      <strong>
        {waiting ? "에이전트가 승인을 기다리고 있어요" : "에이전트가 작업하고 있어요"}
      </strong>
      <p>
        {waiting
          ? "오른쪽의 승인 요청을 확인하면 작업이 계속됩니다."
          : "파일을 살펴보고 결과를 정리하는 중입니다. 이 화면은 자동으로 갱신됩니다."}
      </p>
    </Styled.WorkProgress>
  );
}
function RunProgress({ events }: { events: Awaited<ReturnType<typeof taskApi.get>>["progress"] }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [events.length]);
  return (
    <Styled.RunProgress>
      <Styled.RunProgressHeading>
        <strong>실시간 진행</strong>
        <span>{events.length}</span>
      </Styled.RunProgressHeading>
      <Styled.RunProgressList ref={listRef}>
        {events.slice(-30).map((event) => (
          <Styled.ProgressEvent $type={event.type} key={event.id}>
            <span>
              {event.type === "tool_started"
                ? "▶"
                : event.type === "tool_completed"
                  ? "✓"
                  : event.type === "permission_requested"
                    ? "!"
                    : "·"}
            </span>
            <div>
              <p>{event.message}</p>
              {typeof event.metadata?.detail === "string" && <code>{event.metadata.detail}</code>}
              <time>{new Date(event.createdAt).toLocaleTimeString("ko-KR")}</time>
            </div>
          </Styled.ProgressEvent>
        ))}
        {events.length === 0 && <Empty>첫 번째 실행 이벤트를 기다리는 중...</Empty>}
      </Styled.RunProgressList>
    </Styled.RunProgress>
  );
}
function SessionLimitState({
  reason,
  canExtend,
  extendPending,
  newSessionPending,
  onExtend,
  onNewSession,
}: {
  reason: "capacity" | "inactivity" | "duration";
  canExtend: boolean;
  extendPending: boolean;
  newSessionPending: boolean;
  onExtend: () => void;
  onNewSession: () => void;
}) {
  const descriptions = {
    capacity:
      "현재 진행 내용과 변경된 파일을 보존했습니다. 기존 대화를 유지한 채 세션 한도를 늘려 계속할 수 있습니다.",
    inactivity:
      "5분 동안 새로운 진행이 없어 안전하게 중단했습니다. 기존 대화와 작업 폴더를 그대로 유지해 다시 시작할 수 있습니다.",
    duration:
      "20분 실행 한도에 도달했습니다. 기존 대화와 현재까지의 변경 내용을 유지한 채 계속할 수 있습니다.",
  } as const;
  return (
    <Styled.SessionLimitState>
      <span>↻</span>
      <div>
        <strong>작업 세션이 일시 중단되었습니다.</strong>
        <p>{descriptions[reason]}</p>
        <Styled.SessionLimitActions>
          {canExtend && (
            <Button
              $variant="primary"
              disabled={extendPending || newSessionPending}
              onClick={onExtend}
            >
              {extendPending ? "기존 세션 다시 여는 중…" : "같은 세션 한도 늘려 계속"}
            </Button>
          )}
          <Button
            $variant="secondary"
            disabled={extendPending || newSessionPending}
            onClick={onNewSession}
          >
            {newSessionPending ? "새 세션 준비 중…" : "새 세션에서 이어가기"}
          </Button>
        </Styled.SessionLimitActions>
      </div>
    </Styled.SessionLimitState>
  );
}
function sessionLimitFrom(error?: string): "capacity" | "inactivity" | "duration" | undefined {
  const match = error?.match(/^SESSION_LIMIT:(capacity|inactivity|duration):/);
  return match?.[1] as "capacity" | "inactivity" | "duration" | undefined;
}
function FailureState({ error }: { error?: string }) {
  return (
    <Styled.FailureState>
      <span>!</span>
      <div>
        <strong>작업을 완료하지 못했습니다.</strong>
        <p>
          {error || "실행이 예기치 않게 종료되었습니다. 실행 기록을 확인한 뒤 다시 시도해 주세요."}
        </p>
      </div>
    </Styled.FailureState>
  );
}
function RuntimeApproval({
  activity,
  pending,
  onDecision,
}: {
  activity: Awaited<ReturnType<typeof activityApi.list>>[number];
  pending: boolean;
  onDecision: (decision: "accept" | "cancel") => void;
}) {
  const details = (activity.metadata?.details ?? {}) as Record<string, unknown>;
  const reason =
    typeof details.reason === "string"
      ? details.reason
      : "에이전트가 명령 실행 권한을 요청했습니다.";
  const command = typeof details.command === "string" ? details.command : undefined;
  return (
    <Styled.RuntimeApproval>
      <span className="kicker">APPROVAL REQUIRED</span>
      <strong>작업을 계속하려면 승인이 필요합니다.</strong>
      <p>{reason}</p>
      {command && <pre>{command}</pre>}
      <div>
        <Button $variant="primary" disabled={pending} onClick={() => onDecision("accept")}>
          이번만 승인
        </Button>
        <Button $variant="danger" disabled={pending} onClick={() => onDecision("cancel")}>
          거절
        </Button>
      </div>
    </Styled.RuntimeApproval>
  );
}
