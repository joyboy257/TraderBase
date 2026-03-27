import { PlaidApi, Configuration, Products, CountryCode } from "plaid";
import axios from "axios";
import { createHmac } from "crypto";
import { decrypt } from "@/lib/crypto";

function getBasePath(): string {
  switch (process.env.PLAID_ENV) {
    case "production":
      return "https://production.plaid.com";
    case "development":
      return "https://development.plaid.com";
    default:
      return "https://sandbox.plaid.com";
  }
}

const config = new Configuration({
  basePath: getBasePath(),
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
      "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
    },
    timeout: 30_000,
  },
});

export const plaidClient = new PlaidApi(config);

export async function createLinkToken(userId: string) {
  const response = await plaidClient.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "TraderBase",
    products: [Products.Investments],
    country_codes: [CountryCode.Us],
    language: "en",
  });
  return response.data;
}

export async function exchangePublicToken(publicToken: string) {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  return response.data;
}

export async function getInvestmentHoldings(accessToken: string) {
  // If the token appears to be encrypted (contains :), decrypt it
  const token = accessToken.includes(":") ? decrypt(accessToken) : accessToken;
  const response = await plaidClient.investmentsHoldingsGet({
    access_token: token,
  });
  return response.data;
}

export async function getAccounts(accessToken: string) {
  const token = accessToken.includes(":") ? decrypt(accessToken) : accessToken;
  const response = await plaidClient.accountsGet({
    access_token: token,
  });
  return response.data;
}

export interface InvestmentOrder {
  security_id: string;
  quantity: number;
  type: "market";
  side: "BUY" | "SELL";
}

export interface InvestmentsOrdersPostResponse {
  request_id: string;
  order_id: string;
}

/**
 * Place an investment order via Plaid's /investments/orders/post endpoint.
 * The Plaid SDK does not expose this endpoint, so we call it directly via axios.
 */
export async function postInvestmentOrder(
  accessToken: string,
  accountId: string,
  orders: InvestmentOrder[]
): Promise<InvestmentsOrdersPostResponse> {
  const token = accessToken.includes(":") ? decrypt(accessToken) : accessToken;
  const basePath = getBasePath();
  const response = await axios.post<InvestmentsOrdersPostResponse>(
    `${basePath}/investments/orders/post`,
    {
      access_token: token,
      account_id: accountId,
      orders,
    },
    {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    }
  );
  return response.data;
}

/**
 * Verify a Plaid webhook is legitimate by calling /item/webhook/get.
 * The Plaid SDK does not expose this endpoint, so we call it directly.
 */
export async function verifyPlaidWebhook(accessToken: string): Promise<boolean> {
  try {
    const basePath = getBasePath();
    const response = await axios.post(
      `${basePath}/item/webhook/get`,
      { access_token: accessToken },
      {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
          "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
          "Content-Type": "application/json",
        },
        timeout: 30_000,
      }
    );
    return response.status === 200;
  } catch {
    return false;
  }
}

interface PlaidWebhookVerificationKey {
  key: string;
  key_id: string;
}

/**
 * Fetch the public key used to verify Plaid webhook JWTs.
 * Cached to avoid repeated fetches.
 */
let cachedVerificationKey: PlaidWebhookVerificationKey | null = null;

export async function getPlaidWebhookVerificationKey(): Promise<PlaidWebhookVerificationKey> {
  if (cachedVerificationKey) return cachedVerificationKey;

  const basePath = getBasePath();
  const response = await axios.post<PlaidWebhookVerificationKey>(
    `${basePath}/webhook_verification_key/get`,
    {},
    {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID ?? "",
        "PLAID-SECRET": process.env.PLAID_SECRET ?? "",
        "Content-Type": "application/json",
      },
      timeout: 30_000,
    }
  );
  cachedVerificationKey = response.data;
  return response.data;
}

/**
 * Verify a Plaid webhook is authentic by validating the Plaid-Verification JWT.
 * The JWT payload contains {PLAID-CLIENT-ID, PCA-REQUEST-ID, item_id, date}
 * signed with the webhook verification key.
 */
export async function verifyWebhookToken(
  payload: string,
  verificationHeader: string,
  itemId: string
): Promise<boolean> {
  try {
    const { key, key_id } = await getPlaidWebhookVerificationKey();

    // The verification header format is: key_id.signature (both base64url)
    const lastDotIdx = verificationHeader.lastIndexOf(".");
    if (lastDotIdx === -1) return false;
    const providedKeyId = verificationHeader.slice(0, lastDotIdx);
    const signature = verificationHeader.slice(lastDotIdx + 1);

    if (!providedKeyId || !signature) return false;
    if (providedKeyId !== key_id) return false;

    // Verify HMAC
    const expected = createHmac("sha256", Buffer.from(key, "base64"))
      .update(payload)
      .digest("base64");

    return expected === signature;
  } catch (err) {
    console.error("[Webhook] Verification failed:", err);
    return false;
  }
}

/**
 * Transform Plaid holdings data into positions table rows.
 * Shared by exchange-token, connections, and webhook handlers.
 * Guards against securities.find() returning undefined for stale Plaid data.
 */
export function transformHoldingsToPositions(
  accounts: Awaited<ReturnType<typeof getInvestmentHoldings>>["accounts"],
  holdings: Awaited<ReturnType<typeof getInvestmentHoldings>>["holdings"],
  securities: Awaited<ReturnType<typeof getInvestmentHoldings>>["securities"],
  userId: string,
  connectionId: string
): Array<{
  user_id: string;
  brokerage_connection_id: string;
  ticker: string;
  quantity: number;
  average_cost: number;
  current_price: number;
  unrealized_pnl: number;
}> {
  return accounts.flatMap((account) => {
    const accountHoldings = holdings.filter(
      (h) => h.account_id === account.account_id && h.quantity > 0
    );

    return accountHoldings.map((holding) => {
      const security = securities.find(
        (s) => s.security_id === holding.security_id
      );

      // Skip holdings with no matching security (Stale Plaid data edge case)
      if (!security) return null;

      const quantity = holding.quantity;
      const lastPrice = holding.institution_price ?? 0;
      const costBasis = holding.institution_value ?? 0;
      const ticker = security.ticker_symbol ?? security.name ?? "UNKNOWN";

      if (ticker === "UNKNOWN" || quantity <= 0) return null;

      return {
        user_id: userId,
        brokerage_connection_id: connectionId,
        ticker,
        quantity,
        average_cost: quantity > 0 ? costBasis / quantity : 0,
        current_price: lastPrice,
        unrealized_pnl: lastPrice * quantity - costBasis,
      };
    });
  }).filter((p): p is NonNullable<typeof p> => p !== null);
}
