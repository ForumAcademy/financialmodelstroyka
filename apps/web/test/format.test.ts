import { describe, expect, it } from "vitest";
import { inputNumber } from "../lib/format";

describe("числа в полях ввода", () => {
  it("разряды через пробел, дробная часть через запятую, без округления", () => {
    expect(inputNumber(5834907660)).toBe("5 834 907 660");
    expect(inputNumber(1260033986.66)).toBe("1 260 033 986,66");
    expect(inputNumber(0.015)).toBe("0,015");
    expect(inputNumber(-1200)).toBe("-1 200");
    expect(inputNumber(862)).toBe("862");
  });
});
