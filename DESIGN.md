---
name: AngelFleet PRD
description: A calm reading surface for the complete control-plane design.
colors:
  ink: "#172f33"
  muted: "#52696d"
  accent: "#006e73"
  rail: "#143b40"
  paper: "#ffffff"
  ground: "#f3f7f7"
  line: "#d8e3e4"
  code: "#edf3f4"
  notice: "#77400f"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.95
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, sans-serif"
    fontSize: "clamp(27px, 2.5vw, 38px)"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.025em"
rounded:
  control: "4px"
  code: "5px"
  search: "10px"
spacing:
  compact: "8px"
  standard: "16px"
  section: "36px"
components:
  search-trigger:
    backgroundColor: "#235058"
    textColor: "#f5ffff"
    rounded: "6px"
    padding: "10px 12px"
  contents-active:
    backgroundColor: "#f0f7f7"
    textColor: "#163e44"
    rounded: "{rounded.control}"
    padding: "8px 11px"
---

# Design system

## Overview

This is a documentation reading surface. A deep teal chapter rail holds navigation and search; a white article area keeps long Chinese prose, protocol diagrams, code and migration tables readable. The running header preserves repository and download access.

## Colors

The palette and CSS custom properties are defined in `src/site.css`. Teal identifies navigation and links. Brown is reserved for design-status and publication context. Focus uses a visible orange outline; text selection uses pale teal. Never use color alone to represent acceptance status.

## Typography

Use the system Chinese reading stack for headings and prose. Monospace is limited to source, protocol values and keyboard shortcuts. Body text is 15 px at 1.95 line height on desktop, 14 px on narrow screens. The chapter, subsection and detail heading levels remain visibly distinct.

## Layout

Desktop uses a 276 px chapter rail and a flexible reading area, with an article maximum width of 1000 px to accommodate technical tables. The rail is 292 px at 1500 px and above, 238 px at 1050 px and below. At 760 px and below it becomes an explicit menu. The header is 68 px high on desktop and 60 px on mobile. Wide tables and diagrams scroll within their own regions.

## Components

- The active chapter has a pale background and darker, heavier text; all entries remain normal document links.
- Search opens a native dialog with labelled input, live result count, keyboard shortcut and explicit close control.
- Code blocks have a copy action; diagrams expose their source as a fallback.
- Tables use a restrained tinted header, alternating rows and tabular numerals.
- Printing removes navigation and controls while retaining the full article and diagrams.

## Motion

The mobile directory transition is 180 ms ease-out. Reduced-motion preferences disable transitions and smooth scrolling. Content is visible without entrance animation.

## Evidence

The parent task verified desktop and 390 × 844 mobile rendering, all eight diagrams, full-page overflow, search navigation and mobile chapter selection. Mechanical detector returned no findings. This record was extracted from the completed source; it does not imply platform implementation or capacity acceptance.
