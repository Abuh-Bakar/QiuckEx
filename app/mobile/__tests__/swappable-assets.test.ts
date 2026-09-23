import {
  DEFAULT_SWAPPABLE_ASSETS,
  resolveSwappableAssets,
  isAssetSwappable,
} from "../services/swappable-assets";
import { buildPathPaymentOperation } from "../services/path-payment";

describe("buildPathPaymentOperation", () => {
  it("uses the configured issuer for a non-native asset code", () => {
    const op = buildPathPaymentOperation({
      sourceAsset: "USDC",
      sourceAmount: "10",
      destinationAsset: "XLM",
      destinationAmount: "2",
      destinationAccount: "GCGCJQAE6H7A6V5C7Q3V4L66JZ7R5XJCV2K5W6KQ7",
      sourceAccountSequence: 1,
    });

    expect(op.type).toBe("pathPaymentStrictReceive");
    expect(op.sendAsset.code).toBe("USDC");
    expect(op.sendAsset.issuer).toBe(
      "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    );
    expect(op.destAsset.isNative()).toBe(true);
  });

  it("accepts code:issuer strings without forcing the same issuer onto every asset", () => {
    const issuer = "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA";
    const op = buildPathPaymentOperation({
      sourceAsset: `AQUA:${issuer}`,
      sourceAmount: "10",
      destinationAsset: "XLM",
      destinationAmount: "2",
      destinationAccount: "GCGCJQAE6H7A6V5C7Q3V4L66JZ7R5XJCV2K5W6KQ7",
      sourceAccountSequence: 1,
    });

    expect(op.sendAsset.code).toBe("AQUA");
    expect(op.sendAsset.issuer).toBe(issuer);
  });
});

describe("resolveSwappableAssets", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("uses the config-supplied list when provided", () => {
    const configList = ["XLM", "USDC", "AQUA", "yXLM"];

    const result = resolveSwappableAssets(configList);

    expect(result).toEqual(configList);
    // A valid runtime list must not trigger the fallback log.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("reflects assets added backend-side without any code change", () => {
    // Simulate the backend adding a brand new asset to the runtime config.
    const result = resolveSwappableAssets(["XLM", "USDC", "EURC"]);

    expect(result).toContain("EURC");
  });

  it("falls back to the conservative default and logs when config is missing", () => {
    const result = resolveSwappableAssets(undefined);

    expect(result).toEqual([...DEFAULT_SWAPPABLE_ASSETS]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back and logs when config is null", () => {
    const result = resolveSwappableAssets(null);

    expect(result).toEqual([...DEFAULT_SWAPPABLE_ASSETS]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("falls back and logs when config is an empty array", () => {
    const result = resolveSwappableAssets([]);

    expect(result).toEqual([...DEFAULT_SWAPPABLE_ASSETS]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("drops malformed entries and keeps valid ones", () => {
    // Malformed entries (blank / non-string) are filtered out.
    const result = resolveSwappableAssets([
      "XLM",
      "",
      "  ",
      // @ts-expect-error exercising a malformed runtime payload
      42,
      "USDC",
    ]);

    expect(result).toEqual(["XLM", "USDC"]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("returns a copy of the default so callers cannot mutate it", () => {
    const result = resolveSwappableAssets(undefined);

    result.push("MUTATED");

    expect(DEFAULT_SWAPPABLE_ASSETS).not.toContain("MUTATED");
  });
});

describe("isAssetSwappable", () => {
  it("returns true for an asset in the whitelist", () => {
    const whitelist = resolveSwappableAssets(["XLM", "USDC", "AQUA"]);

    expect(isAssetSwappable("AQUA", whitelist)).toBe(true);
  });

  it("returns false when an unsupported asset is selected", () => {
    const whitelist = resolveSwappableAssets(["XLM", "USDC"]);

    // "DOGE" is not part of the runtime whitelist and must be rejected.
    expect(isAssetSwappable("DOGE", whitelist)).toBe(false);
  });

  it("rejects an asset that is absent from the conservative default", () => {
    const whitelist = resolveSwappableAssets(undefined);

    // yXLM is in the old hardcoded list but not the conservative default,
    // so without runtime config it must not be considered swappable.
    expect(isAssetSwappable("yXLM", whitelist)).toBe(false);
  });
});
