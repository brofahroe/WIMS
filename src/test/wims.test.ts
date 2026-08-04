import { describe, it, expect } from "vitest";
import {
  normalizeText,
  normalizeType,
  compareText,
  asDateInput,
  currentTime,
  formatNumber,
  formatRowId,
  movementSign,
  transactionBucket,
  classifyLeftover,
} from "../lib/wims";

describe("normalizeText", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeText("  Hello   World  ")).toBe("Hello World");
  });

  it("replaces non-breaking spaces", () => {
    expect(normalizeText("Hello\u00a0World")).toBe("Hello World");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});

describe("normalizeType", () => {
  it("uppercases trimmed text", () => {
    expect(normalizeType("  inbound  ")).toBe("INBOUND");
  });
});

describe("compareText", () => {
  it("is case-insensitive", () => {
    expect(compareText("Malang", "malang")).toBe(true);
    expect(compareText("  ABC  ", "abc")).toBe(true);
  });
});

describe("asDateInput", () => {
  it("returns today when empty", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(asDateInput("")).toBe(today);
    expect(asDateInput(null)).toBe(today);
  });

  it("parses ISO date", () => {
    expect(asDateInput("2026-07-15T12:00:00Z")).toBe("2026-07-15");
  });
});

describe("currentTime", () => {
  it("returns HH:MM format", () => {
    const time = currentTime();
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe("formatNumber", () => {
  it("formats numbers with 1 decimal", () => {
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(0)).toBe("0");
  });
});

describe("formatRowId", () => {
  it("pads to 3 digits", () => {
    expect(formatRowId(1)).toBe("001");
    expect(formatRowId(12)).toBe("012");
    expect(formatRowId(123)).toBe("123");
  });
});

describe("movementSign", () => {
  it("returns 1 for positive types", () => {
    expect(movementSign("INBOUND")).toBe(1);
    expect(movementSign("BORROW IN")).toBe(1);
    expect(movementSign("TRANSFER IN")).toBe(1);
  });

  it("returns -1 for negative types", () => {
    expect(movementSign("OUTBOUND")).toBe(-1);
    expect(movementSign("BORROW OUT")).toBe(-1);
    expect(movementSign("TRANSFER OUT")).toBe(-1);
  });

  it("returns 0 for unknown types", () => {
    expect(movementSign("UNKNOWN")).toBe(0);
    expect(movementSign(null)).toBe(0);
  });
});

describe("transactionBucket", () => {
  it("maps transaction types to inventory buckets", () => {
    expect(transactionBucket("INBOUND")).toBe("inboundCalc");
    expect(transactionBucket("OUTBOUND")).toBe("outboundCalc");
    expect(transactionBucket("TRANSFER IN")).toBe("transferInCalc");
    expect(transactionBucket("TRANSFER OUT")).toBe("transferOutCalc");
    expect(transactionBucket("BORROW IN")).toBe("borrowInCalc");
    expect(transactionBucket("BORROW OUT")).toBe("borrowOutCalc");
    expect(transactionBucket("UNKNOWN")).toBeNull();
  });
});

describe("classifyLeftover", () => {
  it("classifies by qty thresholds", () => {
    expect(classifyLeftover(2500)).toBe(">2000");
    expect(classifyLeftover(1750)).toBe(">1500");
    expect(classifyLeftover(1200)).toBe(">1000");
    expect(classifyLeftover(750)).toBe(">500");
    expect(classifyLeftover(300)).toBe(">250");
    expect(classifyLeftover(150)).toBe(">100");
    expect(classifyLeftover(50)).toBe("<100");
  });
});
