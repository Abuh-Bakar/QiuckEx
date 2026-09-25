import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useMarketplaceDetail } from "../../hooks/useMarketplaceDetail";
import { useTheme } from "../../src/theme/ThemeContext";
import {
  type MarketplaceBid,
  type MarketplaceListingDetail,
  formatPublicKey,
} from "../../services/marketplace";
import type { ThemeTokens } from "../../src/theme/tokens";

/**
 * Listing detail screen — reads from GET /marketplace/:listingId/detail.
 *
 * SCOPE NOTE: Bid placement is excluded from this screen. The backend endpoint
 * POST /marketplace/:listingId/bid exists, but the on-device wallet-signing
 * flow required to safely submit a bid is not yet implemented in mobile.
 * See PR notes for the dependency.
 */
export default function MarketplaceDetailScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, refresh } = useMarketplaceDetail(id);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Back button */}
      <View style={[styles.navBar, { borderBottomColor: theme.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={[styles.backText, { color: theme.link }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: theme.textPrimary }]}>Listing Detail</Text>
        <View style={styles.navRight} />
      </View>

      {state.status === "loading" && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            Loading listing…
          </Text>
        </View>
      )}

      {state.status === "error" && (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: theme.status.error }]}>
            {state.notFound ? "This listing was not found." : state.error}
          </Text>
          {!state.notFound && (
            <Pressable
              style={[styles.retryButton, { backgroundColor: theme.buttonPrimaryBg }]}
              onPress={() => void refresh()}
            >
              <Text style={[styles.retryText, { color: theme.buttonPrimaryText }]}>
                Retry
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {state.status === "success" && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <DetailContent detail={state.detail as MarketplaceListingDetail} theme={theme} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type Theme = ReturnType<typeof useTheme>["theme"];

function DetailContent({
  detail,
  theme,
}: {
  detail: MarketplaceListingDetail;
  theme: ThemeTokens;
}) {
  const { listing, bids, seller, state_hints } = detail;

  const statusLabel =
    listing.status === "active" ? "Active" : listing.status === "sold" ? "Sold" : "Cancelled";

  const statusColor =
    listing.status === "active"
      ? theme.status.success
      : listing.status === "sold"
      ? theme.status.warning ?? theme.textSecondary
      : theme.status.error;

  const pendingBids = bids.filter((b) => b.status === "pending");

  return (
    <>
      {/* Header card */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardTop}>
          <Text style={[styles.username, { color: theme.textPrimary }]}>
            @{listing.username}
          </Text>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Row label="Asking price" value={`${Number(listing.asking_price).toLocaleString()} USDC`} theme={theme} />

        <Row label="Seller" value={seller.display_key} theme={theme} />

        <Row
          label="Listed"
          value={new Date(listing.created_at).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          theme={theme}
        />

        {listing.status === "sold" && listing.sold_at ? (
          <Row
            label="Sold"
            value={new Date(listing.sold_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
            theme={theme}
          />
        ) : null}

        {listing.status === "sold" && listing.final_price ? (
          <Row
            label="Final price"
            value={`${Number(listing.final_price).toLocaleString()} USDC`}
            theme={theme}
          />
        ) : null}
      </View>

      {/* Availability hints */}
      {listing.status === "active" && (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Availability</Text>
          <Row
            label="Min bid"
            value={`${state_hints.minimum_bid_amount.toLocaleString()} USDC`}
            theme={theme}
          />
          {!state_hints.is_available && state_hints.unavailable_reason ? (
            <Text style={[styles.hint, { color: theme.status.error }]}>
              {state_hints.unavailable_reason}
            </Text>
          ) : null}
          <Text style={[styles.bidNote, { color: theme.textMuted }]}>
            Bid placement is not yet available in the mobile app.
          </Text>
        </View>
      )}

      {/* Bid history */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
          Bid History ({pendingBids.length} active)
        </Text>

        {bids.length === 0 ? (
          <Text style={[styles.emptyBids, { color: theme.textSecondary }]}>
            No bids placed yet.
          </Text>
        ) : (
          bids.map((bid: MarketplaceBid) => (
            <BidRow key={bid.id} bid={bid} theme={theme} />
          ))
        )}
      </View>
    </>
  );
}

function Row({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textMuted }]}>{label}</Text>
      <Text style={[styles.valueText, { color: theme.textSecondary }]}>{value}</Text>
    </View>
  );
}

function BidRow({ bid, theme }: { bid: MarketplaceBid; theme: ThemeTokens }) {
  const statusColors: Record<MarketplaceBid["status"], string> = {
    pending: theme.status.success,
    accepted: theme.primary,
    rejected: theme.status.error,
    cancelled: theme.textMuted,
  };

  return (
    <View style={[styles.bidRow, { borderBottomColor: theme.borderLight ?? theme.border }]}>
      <View style={styles.bidLeft}>
        <Text style={[styles.bidder, { color: theme.textPrimary }]}>
          {formatPublicKey(bid.bidder_public_key)}
        </Text>
        <Text style={[styles.bidDate, { color: theme.textMuted }]}>
          {new Date(bid.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </Text>
      </View>
      <View style={styles.bidRight}>
        <Text style={[styles.bidAmount, { color: theme.textPrimary }]}>
          {Number(bid.bid_amount).toLocaleString()} USDC
        </Text>
        <Text style={[styles.bidStatus, { color: statusColors[bid.status] }]}>
          {bid.status.charAt(0).toUpperCase() + bid.status.slice(1)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
  },
  navTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  navRight: { width: 60 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 32,
  },
  stateText: {
    fontSize: 15,
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    textAlign: "center",
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "700",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginBottom: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  username: {
    fontSize: 26,
    fontWeight: "800",
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  valueText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
  },
  bidNote: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  emptyBids: {
    fontSize: 14,
  },
  bidRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bidLeft: { gap: 2, flex: 1 },
  bidRight: { alignItems: "flex-end", gap: 2 },
  bidder: {
    fontSize: 14,
    fontWeight: "600",
  },
  bidDate: {
    fontSize: 12,
  },
  bidAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  bidStatus: {
    fontSize: 12,
    fontWeight: "600",
  },
});
