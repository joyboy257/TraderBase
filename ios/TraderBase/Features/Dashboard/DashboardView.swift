import SwiftUI

struct DashboardView: View {
    @EnvironmentObject var authManager: AuthManager
    @StateObject private var viewModel = DashboardViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgBase.ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 20) {
                        // Portfolio Summary
                        PortfolioSummaryCard(
                            totalValue: viewModel.totalValue,
                            dayPnL: viewModel.dayPnL,
                            dayPnLPct: viewModel.dayPnLPct
                        )

                        // Live Signals from Followed Traders
                        if !viewModel.followedSignals.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Text("Live Signals")
                                        .font(.system(.headline, design: .default, weight: .bold))
                                        .foregroundColor(.textPrimary)
                                    Circle()
                                        .fill(Color.accentGreen)
                                        .frame(width: 8, height: 8)
                                    Text("LIVE")
                                        .font(.system(.caption2, design: .default, weight: .bold))
                                        .foregroundColor(.accentGreen)
                                }
                                ForEach(viewModel.followedSignals, id: \.signal.id) { item in
                                    SignalCard(
                                        signal: item.signal,
                                        trader: item.trader,
                                        onCopy: {
                                            Task { await viewModel.copySignal(signalId: item.signal.id) }
                                        }
                                    )
                                }
                            }
                        } else {
                            EmptyStateView(
                                icon: "person.2.slash",
                                title: "No signals yet",
                                message: "Follow traders to see their live signals here"
                            )
                            .background(Color.bgSurface)
                            .cornerRadius(16)
                        }

                        // Recent Activity
                        if !viewModel.recentTrades.isEmpty {
                            VStack(alignment: .leading, spacing: 12) {
                                Text("Recent Activity")
                                    .font(.system(.headline, design: .default, weight: .bold))
                                    .foregroundColor(.textPrimary)
                                ForEach(viewModel.recentTrades, id: \.id) { trade in
                                    TradeRow(trade: trade)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
                .refreshable {
                    await viewModel.refresh()
                }
            }
            .navigationTitle("Dashboard")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.bgBase, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await viewModel.load(authManager: authManager)
        }
    }
}

struct PortfolioSummaryCard: View {
    let totalValue: Double
    let dayPnL: Double
    let dayPnLPct: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Portfolio Value")
                    .font(.system(.subheadline, design: .default))
                    .foregroundColor(.textSecondary)
                Text("$\(totalValue, specifier: "%,.2f")")
                    .font(.system(.largeTitle, design: .monospaced, weight: .bold))
                    .foregroundColor(.textPrimary)
            }
            HStack(spacing: 8) {
                HStack(spacing: 4) {
                    Image(systemName: dayPnL >= 0 ? "arrow.up.right" : "arrow.down.right")
                        .font(.system(size: 12, weight: .bold))
                    Text("\(dayPnL >= 0 ? "+" : "")\(dayPnL, specifier: "%.2f")")
                        .font(.system(.subheadline, design: .monospaced, weight: .semibold))
                }
                .foregroundColor(dayPnL >= 0 ? .colorBuy : .colorSell)
                Text("(\(dayPnLPct >= 0 ? "+" : "")\(dayPnLPct, specifier: "%.2f")%)")
                    .font(.system(.subheadline, design: .monospaced, weight: .medium))
                    .foregroundColor(dayPnLPct >= 0 ? .colorBuy : .colorSell)
                Text("today")
                    .font(.system(.subheadline, design: .default))
                    .foregroundColor(.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(
            LinearGradient(
                colors: [Color.bgSurface, Color.bgElevated],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        )
        .cornerRadius(20)
    }
}

struct TradeRow: View {
    let trade: Trade

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 8) {
                    TickerBadge(ticker: trade.ticker)
                    ActionBadge(action: trade.action)
                }
                Text(trade.executedAt.formatted(.relative(presentation: .named)))
                    .font(.system(.caption2, design: .default))
                    .foregroundColor(.textSecondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("\(trade.action == .BUY ? "-" : "+")$\(trade.price * trade.quantity, specifier: "%.2f")")
                    .font(.system(.subheadline, design: .monospaced, weight: .medium))
                    .foregroundColor(trade.action == .BUY ? .colorSell : .colorBuy)
                Text("\(trade.quantity, specifier: "%.4f") @ $\(trade.price, specifier: "%.2f")")
                    .font(.system(.caption2, design: .monospaced))
                    .foregroundColor(.textSecondary)
            }
        }
        .padding(14)
        .background(Color.bgSurface)
        .cornerRadius(12)
    }
}

@MainActor
class DashboardViewModel: ObservableObject {
    @Published var totalValue: Double = 0
    @Published var dayPnL: Double = 0
    @Published var dayPnLPct: Double = 0
    @Published var followedSignals: [SignalWithTrader] = []
    @Published var recentTrades: [Trade] = []

    private let portfolioService = PortfolioService()
    private let signalsService = SignalsService()
    private let copyTradingService = CopyTradingService()

    func load(authManager: AuthManager) async {
        await refresh()
    }

    func refresh() async {
        do {
            async let positionsTask = portfolioService.fetchPositions()
            async let tradesTask = portfolioService.fetchRecentTrades()
            async let signalsTask = signalsService.fetchSignals()

            let (positions, trades, signals) = try await (positionsTask, tradesTask, signalsTask)

            totalValue = positions.reduce(0) { $0 + ($1.currentPrice * $1.quantity) }
            dayPnL = positions.reduce(0) { $0 + $1.unrealizedPnl }
            let prevValue = positions.reduce(0) { $0 + ($1.averageCost * $1.quantity) }
            dayPnLPct = prevValue > 0 ? (dayPnL / prevValue) * 100 : 0

            recentTrades = Array(trades.prefix(5))
            followedSignals = Array(signals.prefix(10))
        } catch {
            print("Dashboard load error: \(error)")
        }
    }

    func copySignal(signalId: String) async {
        do {
            _ = try await copyTradingService.copySignal(signalId: signalId)
        } catch {
            print("Copy signal error: \(error)")
        }
    }
}
