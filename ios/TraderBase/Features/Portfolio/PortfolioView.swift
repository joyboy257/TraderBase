import SwiftUI

struct PortfolioView: View {
    @StateObject private var viewModel = PortfolioViewModel()
    @State private var selectedSegment = 0

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgBase.ignoresSafeArea()
                VStack(spacing: 0) {
                    // Segment Control
                    Picker("", selection: $selectedSegment) {
                        Text("Positions").tag(0)
                        Text("History").tag(1)
                        Text("Copied").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)

                    if viewModel.isLoading {
                        Spacer()
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .accentGreen))
                        Spacer()
                    } else {
                        TabView(selection: $selectedSegment) {
                            // Positions Tab
                            positionsTab
                                .tag(0)

                            // History Tab
                            historyTab
                                .tag(1)

                            // Copied Trades Tab
                            copiedTab
                                .tag(2)
                        }
                        .tabViewStyle(.page(indexDisplayMode: .never))
                    }
                }
            }
            .navigationTitle("Portfolio")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.bgBase, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await viewModel.load()
        }
    }

    @ViewBuilder
    private var positionsTab: some View {
        if viewModel.positions.isEmpty {
            Spacer()
            EmptyStateView(
                icon: "chart.pie",
                title: "No positions",
                message: "Connect a brokerage to see your positions"
            )
            Spacer()
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(viewModel.positions) { position in
                        PositionCard(position: position, currentPrice: viewModel.prices[position.ticker])
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .refreshable {
                await viewModel.refresh()
            }
        }
    }

    @ViewBuilder
    private var historyTab: some View {
        if viewModel.recentTrades.isEmpty {
            Spacer()
            EmptyStateView(
                icon: "clock",
                title: "No trade history",
                message: "Your executed trades will appear here"
            )
            Spacer()
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(viewModel.recentTrades, id: \.id) { trade in
                        TradeRow(trade: trade)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
    }

    @ViewBuilder
    private var copiedTab: some View {
        if viewModel.copiedTrades.isEmpty {
            Spacer()
            EmptyStateView(
                icon: "arrow.triangle.2.circlepath",
                title: "No copied trades",
                message: "Copy a signal to see executed trades here"
            )
            Spacer()
        } else {
            ScrollView {
                LazyVStack(spacing: 10) {
                    ForEach(viewModel.copiedTrades, id: \.id) { trade in
                        CopiedTradeRow(trade: trade)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
    }
}

struct CopiedTradeRow: View {
    let trade: CopiedTrade

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
                HStack(spacing: 6) {
                    Circle()
                        .fill(trade.status == .executed ? Color.colorBuy : Color.colorSell)
                        .frame(width: 8, height: 8)
                    Text(trade.status.rawValue.capitalized)
                        .font(.system(.caption, design: .default, weight: .medium))
                        .foregroundColor(trade.status == .executed ? .colorBuy : .colorSell)
                }
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
class PortfolioViewModel: ObservableObject {
    @Published var positions: [Position] = []
    @Published var recentTrades: [Trade] = []
    @Published var copiedTrades: [CopiedTrade] = []
    @Published var prices: [String: TickerPrice] = [:]
    @Published var isLoading = true

    private let portfolioService = PortfolioService()

    func load() async {
        isLoading = true
        await refresh()
        isLoading = false
    }

    func refresh() async {
        do {
            async let positionsTask = portfolioService.fetchPositions()
            async let tradesTask = portfolioService.fetchRecentTrades()
            async let copiedTask = portfolioService.fetchCopiedTrades()

            let (positionsResult, tradesResult, copiedResult) = try await (positionsTask, tradesTask, copiedTask)

            positions = positionsResult
            recentTrades = tradesResult
            copiedTrades = copiedResult

            // Fetch live prices for tickers
            let tickers = Set(positionsResult.map { $0.ticker })
            // TODO: Integrate Polygon.io WebSocket for real-time prices on iOS
            for ticker in tickers {
                prices[ticker] = TickerPrice(ticker: ticker, price: positionsResult.first { $0.ticker == ticker }?.currentPrice ?? 0, change: 0, changePercent: 0)
            }
        } catch {
            print("Portfolio load error: \(error)")
        }
    }
}
