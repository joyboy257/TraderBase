import SwiftUI

struct SignalsView: View {
    @StateObject private var viewModel = SignalsViewModel()
    @State private var searchText = ""
    @State private var selectedFilter: SignalFilter = .all

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgBase.ignoresSafeArea()
                VStack(spacing: 0) {
                    // Filter chips
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(SignalFilter.allCases, id: \.self) { filter in
                                FilterChip(
                                    title: filter.title,
                                    isSelected: selectedFilter == filter
                                ) {
                                    selectedFilter = filter
                                }
                            }
                        }
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                    }

                    if viewModel.isLoading {
                        Spacer()
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .accentGreen))
                        Spacer()
                    } else if viewModel.signals.isEmpty {
                        Spacer()
                        EmptyStateView(
                            icon: "waveform.path.ecg",
                            title: "No signals yet",
                            message: "Signals from traders you follow will appear here"
                        )
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(viewModel.signals, id: \.signal.id) { item in
                                    SignalCard(
                                        signal: item.signal,
                                        trader: item.trader,
                                        onCopy: {
                                            Task { await viewModel.copySignal(signalId: item.signal.id) }
                                        },
                                        onFollow: {
                                            Task { await viewModel.toggleFollow(traderId: item.trader.id) }
                                        }
                                    )
                                }
                            }
                            .padding(.horizontal, 16)
                            .padding(.bottom, 24)
                        }
                        .refreshable {
                            await viewModel.refresh(filter: selectedFilter)
                        }
                    }
                }
            }
            .navigationTitle("Signals")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.bgBase, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
        }
        .task {
            await viewModel.load()
        }
        .onChange(of: selectedFilter) { _, newFilter in
            Task { await viewModel.refresh(filter: newFilter) }
        }
    }
}

enum SignalFilter: CaseIterable {
    case all, buys, sells

    var title: String {
        switch self {
        case .all: return "All"
        case .buys: return "BUY"
        case .sells: return "SELL"
        }
    }

    var action: SignalAction? {
        switch self {
        case .all: return nil
        case .buys: return .BUY
        case .sells: return .SELL
        }
    }
}

struct FilterChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.system(.subheadline, design: .default, weight: .semibold))
                .foregroundColor(isSelected ? .black : .textSecondary)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(isSelected ? Color.accentGreen : Color.bgElevated)
                .cornerRadius(20)
        }
    }
}

@MainActor
class SignalsViewModel: ObservableObject {
    @Published var signals: [SignalWithTrader] = []
    @Published var isLoading = true

    private let signalsService = SignalsService()
    private let copyTradingService = CopyTradingService()

    func load() async {
        isLoading = true
        await refresh(filter: .all)
        isLoading = false
    }

    func refresh(filter: SignalFilter) async {
        do {
            signals = try await signalsService.fetchSignals(action: filter.action)
        } catch {
            print("Signals fetch error: \(error)")
        }
    }

    func copySignal(signalId: String) async {
        do {
            _ = try await copyTradingService.copySignal(signalId: signalId)
        } catch {
            print("Copy error: \(error)")
        }
    }

    func toggleFollow(traderId: String) async {
        do {
            let isFollowing = await copyTradingService.isFollowing(leaderId: traderId)
            if isFollowing {
                try await copyTradingService.unfollowTrader(leaderId: traderId)
            } else {
                try await copyTradingService.followTrader(leaderId: traderId)
            }
        } catch {
            print("Follow error: \(error)")
        }
    }
}
