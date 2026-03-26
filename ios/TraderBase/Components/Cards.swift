import SwiftUI

struct SignalCard: View {
    let signal: Signal
    let trader: PublicProfile
    var onCopy: (() -> Void)?
    var onFollow: (() -> Void)?

    private let signalsService = SignalsService()
    @State private var isFollowing = false
    @State private var isCopying = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header: avatar + name + ticker + action
            HStack {
                NavigationLink(destination: TraderProfileView(traderId: trader.id)) {
                    HStack(spacing: 10) {
                        TraderAvatar(avatarUrl: trader.avatarUrl, displayName: trader.displayName ?? trader.username, size: 36)
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(spacing: 4) {
                                Text(trader.displayName ?? trader.username)
                                    .font(.system(.subheadline, design: .default, weight: .semibold))
                                    .foregroundColor(.textPrimary)
                                if trader.isVerified {
                                    Image(systemName: "checkmark.seal.fill")
                                        .font(.system(size: 12))
                                        .foregroundColor(.accentGreen)
                                }
                            }
                            Text("@\(trader.username)")
                                .font(.system(.caption, design: .default))
                                .foregroundColor(.textSecondary)
                        }
                    }
                }
                Spacer()
                ActionBadge(action: signal.action)
            }

            // Ticker + Price
            HStack(alignment: .bottom, spacing: 12) {
                TickerBadge(ticker: signal.ticker)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Entry")
                        .font(.system(.caption2, design: .default))
                        .foregroundColor(.textSecondary)
                    Text("$\(signal.entryPrice, specifier: "%.2f")")
                        .font(.system(.body, design: .monospaced, weight: .bold))
                        .foregroundColor(.textPrimary)
                }
                if let stopLoss = signal.stopLoss {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Stop")
                            .font(.system(.caption2, design: .default))
                            .foregroundColor(.textSecondary)
                        Text("$\(stopLoss, specifier: "%.2f")")
                            .font(.system(.caption, design: .monospaced, weight: .medium))
                            .foregroundColor(.colorSell)
                    }
                }
                if let takeProfit = signal.takeProfit {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Target")
                            .font(.system(.caption2, design: .default))
                            .foregroundColor(.textSecondary)
                        Text("$\(takeProfit, specifier: "%.2f")")
                            .font(.system(.caption, design: .monospaced, weight: .medium))
                            .foregroundColor(.colorBuy)
                    }
                }
                Spacer()
            }

            // Rationale
            if let rationale = signal.rationale, !rationale.isEmpty {
                Text(rationale)
                    .font(.system(.subheadline, design: .default))
                    .foregroundColor(.textSecondary)
                    .lineLimit(3)
            }

            // Actions
            HStack(spacing: 12) {
                if let onCopy = onCopy {
                    CopyButton(ticker: signal.ticker, action: onCopy)
                }
                if let onFollow = onFollow {
                    FollowButton(isFollowing: isFollowing, action: {
                        onFollow()
                        isFollowing.toggle()
                    })
                }
                Spacer()
                Text(signal.createdAt.formatted(.relative(presentation: .named)))
                    .font(.system(.caption2, design: .default))
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(16)
        .background(Color.bgSurface)
        .cornerRadius(16)
    }
}

struct PositionCard: View {
    let position: Position
    let currentPrice: TickerPrice?

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                TickerBadge(ticker: position.ticker)
                Text("\(position.quantity, specifier: "%.4f") shares")
                    .font(.system(.caption, design: .default))
                    .foregroundColor(.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("$\(currentPrice?.price ?? position.currentPrice, specifier: "%.2f")")
                    .font(.system(.body, design: .monospaced, weight: .semibold))
                    .foregroundColor(.textPrimary)
                let pnl = position.unrealizedPnl
                let pnlPct = position.unrealizedPnlPct
                HStack(spacing: 4) {
                    Image(systemName: pnl >= 0 ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 10, weight: .bold))
                    Text("\(pnl >= 0 ? "+" : "")\(pnl, specifier: "%.2f") (\(pnlPct >= 0 ? "+" : "")\(pnlPct, specifier: "%.1f")%)")
                        .font(.system(.caption, design: .monospaced, weight: .medium))
                }
                .foregroundColor(pnl >= 0 ? .colorBuy : .colorSell)
            }
        }
        .padding(14)
        .background(Color.bgSurface)
        .cornerRadius(12)
    }
}
