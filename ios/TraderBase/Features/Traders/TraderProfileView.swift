import SwiftUI

struct TraderProfileView: View {
    let traderId: String
    @StateObject private var viewModel = TraderProfileViewModel()
    @EnvironmentObject var authManager: AuthManager
    @State private var isFollowing = false

    var body: some View {
        ZStack {
            Color.bgBase.ignoresSafeArea()
            if viewModel.isLoading {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .accentGreen))
            } else if let trader = viewModel.trader {
                ScrollView {
                    VStack(spacing: 20) {
                        // Profile Header
                        VStack(spacing: 16) {
                            TraderAvatar(
                                avatarUrl: trader.avatarUrl,
                                displayName: trader.displayName ?? trader.username,
                                size: 80
                            )
                            VStack(spacing: 6) {
                                HStack(spacing: 6) {
                                    Text(trader.displayName ?? trader.username)
                                        .font(.system(.title2, design: .default, weight: .bold))
                                        .foregroundColor(.textPrimary)
                                    if trader.isVerified {
                                        Image(systemName: "checkmark.seal.fill")
                                            .font(.system(size: 16))
                                            .foregroundColor(.accentGreen)
                                    }
                                }
                                Text("@\(trader.username)")
                                    .font(.system(.subheadline, design: .default))
                                    .foregroundColor(.textSecondary)
                                if let bio = trader.bio, !bio.isEmpty {
                                    Text(bio)
                                        .font(.system(.subheadline, design: .default))
                                        .foregroundColor(.textSecondary)
                                        .multilineTextAlignment(.center)
                                        .padding(.top, 4)
                                }
                            }

                            // Stats Row
                            HStack(spacing: 32) {
                                StatColumn(value: "\(trader.followersCount)", label: "Followers")
                                StatColumn(value: "\(trader.signalsCount)", label: "Signals")
                                if let returnPct = trader.returnPct {
                                    StatColumn(
                                        value: "\(returnPct >= 0 ? "+" : "")\(returnPct, specifier: "%.1f")%",
                                        label: "Return"
                                    )
                                }
                                if let winRate = trader.winRate {
                                    StatColumn(value: "\(winRate, specifier: "%.0f")%", label: "Win Rate")
                                }
                            }
                            .padding(.top, 4)

                            // Follow + Copy buttons
                            HStack(spacing: 12) {
                                FollowButton(isFollowing: isFollowing) {
                                    Task { await toggleFollow() }
                                }
                                CopyButton(ticker: "") {}
                            }
                        }
                        .padding(20)
                        .background(Color.bgSurface)
                        .cornerRadius(20)

                        // Signals
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Recent Signals")
                                .font(.system(.headline, design: .default, weight: .bold))
                                .foregroundColor(.textPrimary)
                            if viewModel.signals.isEmpty {
                                Text("No signals yet")
                                    .font(.system(.subheadline, design: .default))
                                    .foregroundColor(.textSecondary)
                                    .padding(.vertical, 20)
                            } else {
                                ForEach(viewModel.signals, id: \.id) { signal in
                                    SignalRow(signal: signal)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
            } else {
                Text("Trader not found")
                    .foregroundColor(.textSecondary)
            }
        }
        .navigationTitle("")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load(traderId: traderId)
            isFollowing = await CopyTradingService().isFollowing(leaderId: traderId)
        }
    }

    private func toggleFollow() async {
        do {
            if isFollowing {
                try await CopyTradingService().unfollowTrader(leaderId: traderId)
            } else {
                try await CopyTradingService().followTrader(leaderId: traderId)
            }
            isFollowing.toggle()
        } catch {
            print("Follow toggle error: \(error)")
        }
    }
}

struct StatColumn: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.system(.headline, design: .default, weight: .bold))
                .foregroundColor(.textPrimary)
            Text(label)
                .font(.system(.caption2, design: .default))
                .foregroundColor(.textSecondary)
        }
    }
}

struct SignalRow: View {
    let signal: Signal

    var body: some View {
        HStack {
            TickerBadge(ticker: signal.ticker)
            ActionBadge(action: signal.action)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("$\(signal.entryPrice, specifier: "%.2f")")
                    .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                    .foregroundColor(.textPrimary)
                Text(signal.createdAt.formatted(.relative(presentation: .named)))
                    .font(.system(.caption2, design: .default))
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(14)
        .background(Color.bgSurface)
        .cornerRadius(12)
    }
}

@MainActor
class TraderProfileViewModel: ObservableObject {
    @Published var trader: PublicProfile?
    @Published var signals: [Signal] = []
    @Published var isLoading = true

    private let tradersService = TradersService()
    private let signalsService = SignalsService()

    func load(traderId: String) async {
        isLoading = true
        do {
            // Fetch trader and signals in parallel
            async let traderTask: () = fetchTrader(id: traderId)
            async let signalsTask: () = fetchSignals(userId: traderId)
            _ = await (traderTask, signalsTask)
        }
        isLoading = false
    }

    private func fetchTrader(id: String) async {
        // We don't have a direct fetch by ID, use fetchTraders and filter
        do {
            let traders = try await tradersService.fetchTraders(limit: 100)
            trader = traders.first { $0.id == id }
        } catch {
            print("Fetch trader error: \(error)")
        }
    }

    private func fetchSignals(userId: String) async {
        do {
            signals = try await signalsService.fetchTraderSignals(userId: userId)
        } catch {
            print("Fetch signals error: \(error)")
        }
    }
}
