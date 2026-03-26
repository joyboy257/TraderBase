import SwiftUI

struct TradersView: View {
    @StateObject private var viewModel = TradersViewModel()
    @State private var searchText = ""

    var filteredTraders: [PublicProfile] {
        if searchText.isEmpty {
            return viewModel.traders
        }
        return viewModel.traders.filter {
            $0.username.localizedCaseInsensitiveContains(searchText) ||
            ($0.displayName?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.bgBase.ignoresSafeArea()
                if viewModel.isLoading {
                    ProgressView()
                        .progressViewStyle(CircularProgressViewStyle(tint: .accentGreen))
                } else if filteredTraders.isEmpty {
                    EmptyStateView(
                        icon: "person.2",
                        title: "No traders found",
                        message: searchText.isEmpty ? "No traders have joined yet" : "Try a different search"
                    )
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(filteredTraders) { trader in
                                NavigationLink(destination: TraderProfileView(traderId: trader.id)) {
                                    TraderRow(trader: trader)
                                }
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
            .navigationTitle("Traders")
            .navigationBarTitleDisplayMode(.large)
            .toolbarBackground(Color.bgBase, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .searchable(text: $searchText, prompt: "Search traders")
        }
        .task {
            await viewModel.load()
        }
    }
}

struct TraderRow: View {
    let trader: PublicProfile

    var body: some View {
        HStack(spacing: 12) {
            TraderAvatar(avatarUrl: trader.avatarUrl, displayName: trader.displayName ?? trader.username, size: 52)
            VStack(alignment: .leading, spacing: 4) {
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
                if let bio = trader.bio, !bio.isEmpty {
                    Text(bio)
                        .font(.system(.caption, design: .default))
                        .foregroundColor(.textSecondary)
                        .lineLimit(1)
                }
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                if let returnPct = trader.returnPct {
                    HStack(spacing: 2) {
                        Image(systemName: returnPct >= 0 ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 10, weight: .bold))
                        Text("\(returnPct >= 0 ? "+" : "")\(returnPct, specifier: "%.1f")%")
                            .font(.system(.caption, design: .monospaced, weight: .semibold))
                    }
                    .foregroundColor(returnPct >= 0 ? .colorBuy : .colorSell)
                }
                HStack(spacing: 4) {
                    Image(systemName: "person.2.fill")
                        .font(.system(size: 10))
                    Text("\(trader.followersCount)")
                        .font(.system(.caption2, design: .default))
                }
                .foregroundColor(.textSecondary)
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.textSecondary)
        }
        .padding(14)
        .background(Color.bgSurface)
        .cornerRadius(14)
    }
}

@MainActor
class TradersViewModel: ObservableObject {
    @Published var traders: [PublicProfile] = []
    @Published var isLoading = true

    private let tradersService = TradersService()

    func load() async {
        isLoading = true
        await refresh()
        isLoading = false
    }

    func refresh() async {
        do {
            traders = try await tradersService.fetchTraders()
        } catch {
            print("Traders fetch error: \(error)")
        }
    }
}
