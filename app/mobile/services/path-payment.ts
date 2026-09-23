import {
  Keypair,
  TransactionBuilder,
  Operation,
  Networks,
  Asset,
  BASE_FEE,
  Account,
} from "stellar-sdk";
import type { PathPreviewRow } from "./link-metadata";

const KNOWN_ASSET_ISSUERS: Record<string, string> = {
  USDC: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  AQUA: "GBNZILSTVQZ4R7IKQDGHYGY2QXL5QOFJYQMXPKWRRM5PAV7Y4M67AQUA",
  yXLM: "GARDNV3Q7YGT4AKSDF25LT32YSCCW4EV22Y2TV3I2PU2MMXJTEDL5T55",
};

function resolveAsset(asset: string): Asset {
  const trimmed = asset.trim();

  if (!trimmed || trimmed.toUpperCase() === "XLM") {
    return Asset.native();
  }

  const [code, ...issuerParts] = trimmed.split(":");
  const normalizedCode = code.trim().toUpperCase();
  const issuer = issuerParts.join(":").trim();

  if (!normalizedCode) {
    throw new Error(`Invalid asset selector: "${asset}"`);
  }

  if (issuer) {
    return new Asset(normalizedCode, issuer);
  }

  const knownIssuer = KNOWN_ASSET_ISSUERS[normalizedCode];
  if (!knownIssuer) {
    throw new Error(
      `Unsupported non-native asset: "${asset}". Use a code like XLM or USDC:ISSUER.`,
    );
  }

  return new Asset(normalizedCode, knownIssuer);
}

export interface PathPaymentOptions {
  sourceAsset: string;
  sourceAmount: string;
  destinationAsset: string;
  destinationAmount: string;
  destinationAccount: string;
  sourceAccountSequence: number;
  memo?: string;
  memoType?: string;
  network?: "public" | "testnet";
}

export interface PathPaymentRoute {
  path: string[];
}

/**
 * Builds a PathPaymentStrictReceive operation.
 * This operation allows paying with any asset and having the amount received be exact.
 * Used for in-app transaction building (when user has connected passkey/wallet).
 */
export function buildPathPaymentOperation(
  options: PathPaymentOptions,
): ReturnType<typeof Operation.pathPaymentStrictReceive> {
  const {
    sourceAsset,
    sourceAmount,
    destinationAsset,
    destinationAmount,
    destinationAccount,
  } = options;

  const srcAsset = resolveAsset(sourceAsset);
  const dstAsset = resolveAsset(destinationAsset);

  return Operation.pathPaymentStrictReceive({
    destination: destinationAccount,
    destAmount: destinationAmount,
    destAsset: dstAsset,
    sendMax: sourceAmount,
    sendAsset: srcAsset,
    path: [], // Path is determined by Stellar network at transaction submission time
  });
}

/**
 * Builds a full path payment transaction for submitting directly to the network.
 * This requires the user's secret key and is NOT currently used in the mobile app
 * (which delegates to external wallets). Provided for future in-app signing support.
 *
 * @throws Error if transaction building fails
 */
export function buildPathPaymentTransaction(
  secretKey: string,
  userAccount: {
    accountId: string;
    sequenceNumber: number;
  },
  options: PathPaymentOptions,
): string {
  const keypair = Keypair.fromSecret(secretKey);

  if (keypair.publicKey() !== userAccount.accountId) {
    throw new Error("Secret key does not match user account");
  }

  const networkPassphrase =
    options.network === "public" ? Networks.PUBLIC : Networks.TESTNET;

  const transaction = new TransactionBuilder(
    new Account(userAccount.accountId, String(userAccount.sequenceNumber)),
    {
      fee: String(BASE_FEE),
      networkPassphrase,
    },
  )
    .addOperation(buildPathPaymentOperation(options))
    .setTimeout(300)
    .build();

  transaction.sign(keypair);
  return transaction.toEnvelope().toXDR("base64");
}

/**
 * Formats a swap path display string for UI.
 * Example: "USDC → XLM → USD"
 */
export function formatSwapPathDisplay(path: string[]): string {
  if (path.length === 0) {
    return "Direct";
  }
  return path.join(" → ");
}

/**
 * Calculates the effective exchange rate from a path payment.
 */
export function calculateExchangeRate(
  sourceAmount: string,
  destinationAmount: string,
): number {
  const src = parseFloat(sourceAmount);
  const dst = parseFloat(destinationAmount);

  if (!Number.isFinite(src) || !Number.isFinite(dst) || src === 0) {
    return 0;
  }

  return dst / src;
}

/**
 * Calculates estimated slippage (spread) from a path payment.
 * Slippage occurs when intermediary hops convert between assets.
 */
export function calculateSlippage(
  sourceAmount: string,
  destinationAmount: string,
  hopCount: number,
): number {
  if (hopCount === 0) {
    return 0; // No slippage on direct payments
  }

  const src = parseFloat(sourceAmount);
  const dst = parseFloat(destinationAmount);

  if (!Number.isFinite(src) || !Number.isFinite(dst) || src === 0) {
    return 0;
  }

  // Estimate base slippage: 0.1% per hop (typical Stellar spread)
  const estimatedBaseSlippage = hopCount * 0.001;

  return Math.min(estimatedBaseSlippage, 0.05); // Cap at 5%
}
